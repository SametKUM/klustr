package kube

import (
	"log"
	"os"
	"time"
)

// perfTraceEnabled gates the dev-only list timing logs. Read once at startup so
// the hot path never touches the environment; KLUSTR_PERF_TRACE=1 turns it on.
var perfTraceEnabled = os.Getenv("KLUSTR_PERF_TRACE") != ""

// TraceList logs how long a list binding spent building its projection result.
// It measures Go build time only (it returns before Wails marshals the slice);
// cross-referencing this against the frontend's "roundtrip" measurement isolates
// the bridge + JSON-parse slice. No-op unless KLUSTR_PERF_TRACE is set.
func TraceList(kind string, n int, start time.Time) {
	if !perfTraceEnabled {
		return
	}
	log.Printf("[perf] list kind=%s n=%d build=%s", kind, n, time.Since(start))
}
