//go:build !windows

package kube

import "errors"

func startInNewConsole([]string, []string, string, func()) error {
	return errors.New("a new console window is Windows-only")
}
