package main

import (
	"strconv"
	"strings"
)

// minimumWebView2 is the oldest WebView2 runtime Klustr starts on: the floor
// Wails v2 enforced (WebView2 SDK 1.0.992.28). Wails v3 itself needs 86 or
// later.
const minimumWebView2 = "94.0.992.31"

// compareVersions compares dotted numeric versions such as 120.0.2210.91 and
// returns -1, 0 or 1. ok is false when either is not one.
func compareVersions(a, b string) (cmp int, ok bool) {
	pa, oka := parseVersion(a)
	pb, okb := parseVersion(b)
	if !oka || !okb {
		return 0, false
	}
	for i := range max(len(pa), len(pb)) {
		var x, y int
		if i < len(pa) {
			x = pa[i]
		}
		if i < len(pb) {
			y = pb[i]
		}
		switch {
		case x < y:
			return -1, true
		case x > y:
			return 1, true
		}
	}
	return 0, true
}

func parseVersion(v string) ([]int, bool) {
	if v == "" {
		return nil, false
	}
	parts := strings.Split(v, ".")
	out := make([]int, len(parts))
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return nil, false
		}
		out[i] = n
	}
	return out, true
}
