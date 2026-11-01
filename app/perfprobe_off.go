//go:build !perfprobe

package app

import "context"

// The perf probe (perfprobe.go) is compiled in only with -tags perfprobe.
// These stand-ins keep every other build free of it.

func probeArgs(_ string, args []any) []any { return args }

func probeStartup(context.Context) {}
