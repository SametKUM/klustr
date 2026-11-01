//go:build perfprobe

package app

import (
	"encoding/json"
	"testing"
)

func TestPerfEventGroup(t *testing.T) {
	cases := map[string]string{
		"pod:logs:line:abc": "pod:logs:line",
		"exec:out:s-1":      "exec:out",
		"term:close:x":      "term:close",
		"kube:change":       "kube:change",
		"pf:update":         "pf:update",
	}
	for name, want := range cases {
		if got := perfEventGroup(name); got != want {
			t.Errorf("perfEventGroup(%q) = %q, want %q", name, got, want)
		}
	}
}

func TestProbeArgsAppendsStamp(t *testing.T) {
	args := []any{"ctx", "Pod", map[string]int{"gen": 1}}
	raw, _ := json.Marshal(args)

	got := probeArgs("kube:change", args)
	if len(got) != len(args)+1 {
		t.Fatalf("got %d args, want %d", len(got), len(args)+1)
	}
	marker, ok := got[len(got)-1].(perfMarker)
	if !ok {
		t.Fatalf("last arg is %T, want perfMarker", got[len(got)-1])
	}
	if marker.Stamp.Bytes != len(raw) {
		t.Errorf("Bytes = %d, want %d", marker.Stamp.Bytes, len(raw))
	}
	if marker.Stamp.T <= 0 {
		t.Errorf("T = %d, want a Unix microsecond time", marker.Stamp.T)
	}

	// The frontend keys on this exact JSON shape.
	enc, _ := json.Marshal(marker)
	var shape map[string]map[string]int64
	if err := json.Unmarshal(enc, &shape); err != nil || shape["__klustrPerf"]["bytes"] != int64(len(raw)) {
		t.Errorf("marker encodes as %s", enc)
	}
}
