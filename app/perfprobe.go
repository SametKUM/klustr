//go:build perfprobe

package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// The perf probe measures the Wails bridge for hack/perf. It is compiled in
// only with -tags perfprobe, together with a frontend built with
// VITE_KLUSTR_PERF=1 (src/perf/). Every emitted event gets a trailing stamp
// argument with its emit time and JSON size; the frontend strips it before any
// handler sees the event, records the delivery latency, drives the scenario
// and sends its report back as a perf:report event, which ends up in the file
// named by KLUSTR_PERF_OUT.

// perfMarker is the trailing argument. The frontend recognizes it by the
// __klustrPerf key.
type perfMarker struct {
	Stamp perfStamp `json:"__klustrPerf"`
}

type perfStamp struct {
	T     int64 `json:"t"`     // emit time, Unix microseconds
	Bytes int   `json:"bytes"` // JSON size of the event's own arguments
}

var perfProbe = struct {
	mu     sync.Mutex
	emits  map[string]int
	bytes  map[string]int64
	start  time.Time
	out    string
	report sync.Once
}{
	emits: map[string]int{},
	bytes: map[string]int64{},
	start: time.Now(),
}

// perfStreamPrefixes name the per-session events, whose names end in a session
// id, so they are counted per kind rather than per session.
var perfStreamPrefixes = []string{
	"pod:logs:line:", "pod:logs:close:",
	"exec:out:", "exec:close:",
	"term:out:", "term:close:",
}

func perfEventGroup(name string) string {
	for _, p := range perfStreamPrefixes {
		if strings.HasPrefix(name, p) {
			return strings.TrimSuffix(p, ":")
		}
	}
	return name
}

// probeArgs appends the stamp. args is never the caller's backing array with
// spare capacity (emit allocates it at its exact length), so the append
// cannot write into memory the caller still uses.
func probeArgs(name string, args []any) []any {
	size := 0
	if len(args) > 0 {
		if raw, err := json.Marshal(args); err == nil {
			size = len(raw)
		}
	}
	group := perfEventGroup(name)
	perfProbe.mu.Lock()
	perfProbe.emits[group]++
	perfProbe.bytes[group] += int64(size)
	perfProbe.mu.Unlock()
	return append(args, perfMarker{perfStamp{T: time.Now().UnixMicro(), Bytes: size}})
}

func probeStartup(_ context.Context) {
	// A probe run must only ever see the perf cluster. Without KUBECONFIG
	// client-go falls back to ~/.kube/config and its real contexts.
	kubeconfig := filepath.ToSlash(os.Getenv("KUBECONFIG"))
	if !strings.HasSuffix(kubeconfig, "hack/perf/kubeconfig") {
		log.Fatalf("[perf] KUBECONFIG is %q; a probe build only runs against hack/perf/kubeconfig", kubeconfig)
	}
	// importShellEnv would replace KUBECONFIG with the login shell's when the
	// app is not started from a terminal; it skips itself when TERM is set.
	if os.Getenv("TERM") == "" && os.Getenv("TERM_PROGRAM") == "" {
		_ = os.Setenv("TERM", "dumb")
	}

	perfProbe.out = os.Getenv("KLUSTR_PERF_OUT")
	if perfProbe.out == "" {
		perfProbe.out = "klustr-perf-" + time.Now().Format("20060102-150405") + ".json"
	}
	log.Printf("[perf] probe on, report goes to %s", perfProbe.out)

	app := application.Get()
	// hack/perf/run.sh polls this file to start the cluster-side churn when
	// the scenario reaches that phase.
	app.Event.On("perf:phase", func(e *application.CustomEvent) {
		phase := fmt.Sprint(e.Data)
		log.Printf("[perf] phase %s", phase)
		if err := os.WriteFile(perfProbe.out+".phase", []byte(phase+"\n"), 0o644); err != nil {
			log.Printf("[perf] write phase: %v", err)
		}
	})

	app.Event.On("perf:report", func(e *application.CustomEvent) {
		perfProbe.report.Do(func() {
			if err := writePerfReport(e.Data); err != nil {
				log.Printf("[perf] report: %v", err)
			} else {
				log.Printf("[perf] report written to %s", perfProbe.out)
			}
			app.Quit()
		})
	})
}

func writePerfReport(data any) error {
	frontend, ok := data.(string)
	if !ok || !json.Valid([]byte(frontend)) {
		return fmt.Errorf("perf:report payload is not a JSON string")
	}

	perfProbe.mu.Lock()
	emits := make(map[string]int, len(perfProbe.emits))
	for k, v := range perfProbe.emits {
		emits[k] = v
	}
	bytes := make(map[string]int64, len(perfProbe.bytes))
	for k, v := range perfProbe.bytes {
		bytes[k] = v
	}
	perfProbe.mu.Unlock()

	report := struct {
		Meta       perfMeta         `json:"meta"`
		GoEmits    map[string]int   `json:"goEmits"`
		GoBytes    map[string]int64 `json:"goBytes"`
		Frontend   json.RawMessage  `json:"frontend"`
		GoMemStats perfGoMem        `json:"goMem"`
	}{
		Meta:       newPerfMeta(),
		GoEmits:    emits,
		GoBytes:    bytes,
		Frontend:   json.RawMessage(frontend),
		GoMemStats: newPerfGoMem(),
	}
	raw, err := json.MarshalIndent(report, "", " ")
	if err != nil {
		return err
	}
	return os.WriteFile(perfProbe.out, raw, 0o644)
}

type perfMeta struct {
	Label     string `json:"label"`
	Started   string `json:"started"`
	Finished  string `json:"finished"`
	GOOS      string `json:"goos"`
	GOARCH    string `json:"goarch"`
	NumCPU    int    `json:"numCPU"`
	GoVersion string `json:"goVersion"`
	Wails     string `json:"wails"`
	Tags      string `json:"tags"`
	Revision  string `json:"revision"`
}

func newPerfMeta() perfMeta {
	m := perfMeta{
		Label:     os.Getenv("KLUSTR_PERF_LABEL"),
		Started:   perfProbe.start.Format(time.RFC3339),
		Finished:  time.Now().Format(time.RFC3339),
		GOOS:      runtime.GOOS,
		GOARCH:    runtime.GOARCH,
		NumCPU:    runtime.NumCPU(),
		GoVersion: runtime.Version(),
	}
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, dep := range info.Deps {
			if strings.HasPrefix(dep.Path, "github.com/wailsapp/wails/") {
				m.Wails = dep.Path + "@" + dep.Version
			}
		}
		for _, s := range info.Settings {
			switch s.Key {
			case "-tags":
				m.Tags = s.Value
			case "vcs.revision":
				m.Revision = s.Value
			}
		}
	}
	// wails build leaves the VCS settings out; hack/perf/run.sh passes it.
	if rev := os.Getenv("KLUSTR_PERF_REV"); rev != "" {
		m.Revision = rev
	}
	return m
}

// perfGoMem is the Go heap at report time. Process RSS, the webview's
// included, is sampled from outside by hack/perf/run.sh.
type perfGoMem struct {
	HeapAllocMB float64 `json:"heapAllocMB"`
	SysMB       float64 `json:"sysMB"`
	NumGC       uint32  `json:"numGC"`
}

func newPerfGoMem() perfGoMem {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	return perfGoMem{
		HeapAllocMB: float64(ms.HeapAlloc) / (1 << 20),
		SysMB:       float64(ms.Sys) / (1 << 20),
		NumGC:       ms.NumGC,
	}
}
