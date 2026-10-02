//go:build windows

package kube

import (
	"os/exec"
	"unsafe"

	"golang.org/x/sys/windows"
)

// startInNewConsole starts argv in a console window of its own, with env and
// dir, and calls onExit once the process ends. Klustr is a GUI app, so a bare
// powershell.exe would otherwise start with no console. exec.Cmd can't do
// this: it always sets STARTF_USESTDHANDLES and passes NUL for nil stdio,
// which wins over the new console, so PowerShell reads EOF and exits at once.
// Windows hands a visible new console to the default terminal app, and the
// process stays klustr's child, so env and the exit wait still apply.
func startInNewConsole(argv, env []string, dir string, onExit func()) error {
	cmdLine, err := windows.UTF16PtrFromString(windows.ComposeCommandLine(argv))
	if err != nil {
		return err
	}
	var cwd *uint16
	if dir != "" {
		if cwd, err = windows.UTF16PtrFromString(dir); err != nil {
			return err
		}
	}
	// As in createAttachedProcess: Environ dedups names case-insensitively,
	// last wins.
	block, err := envBlock((&exec.Cmd{Env: env}).Environ())
	if err != nil {
		return err
	}
	var si windows.StartupInfo
	si.Cb = uint32(unsafe.Sizeof(si))
	var pi windows.ProcessInformation
	flags := uint32(windows.CREATE_NEW_CONSOLE | windows.CREATE_UNICODE_ENVIRONMENT)
	if err := windows.CreateProcess(nil, cmdLine, nil, nil, false, flags, block, cwd, &si, &pi); err != nil {
		return err
	}
	_ = windows.CloseHandle(pi.Thread)
	go func() {
		_, _ = windows.WaitForSingleObject(pi.Process, windows.INFINITE)
		_ = windows.CloseHandle(pi.Process)
		onExit()
	}()
	return nil
}
