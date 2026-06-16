package kube

import (
	"net/http"
	_ "net/http/pprof" // registers /debug/pprof handlers on http.DefaultServeMux
	"os"
	"strings"
	"time"
)

// StartPprofServer starts a loopback-only pprof server when KLUSTR_PPROF is set
// (e.g. KLUSTR_PPROF=127.0.0.1:6060, or just :6060). It is a no-op otherwise,
// so production builds pay nothing. Loopback-only on purpose: profiles can leak
// goroutine stacks and memory layout, so they must never be reachable off-box.
func StartPprofServer() {
	addr := strings.TrimSpace(os.Getenv("KLUSTR_PPROF"))
	if addr == "" {
		return
	}
	if strings.HasPrefix(addr, ":") {
		addr = "127.0.0.1" + addr
	}
	if !strings.HasPrefix(addr, "127.0.0.1:") && !strings.HasPrefix(addr, "localhost:") {
		// Refuse a non-loopback bind rather than expose profiles on a routable
		// interface; pin to loopback on the requested port instead.
		if i := strings.LastIndex(addr, ":"); i >= 0 {
			addr = "127.0.0.1" + addr[i:]
		} else {
			addr = "127.0.0.1:" + addr
		}
	}
	go func() {
		srv := &http.Server{
			Addr:              addr,
			Handler:           nil, // DefaultServeMux carries the pprof handlers
			ReadHeaderTimeout: 5 * time.Second,
		}
		_ = srv.ListenAndServe()
	}()
}
