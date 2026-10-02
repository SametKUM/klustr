//go:build windows

package kube

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// conptyDrainDelay allows output of exited shell to reach
// reader before the pseudo console is closed.
const conptyDrainDelay = 200 * time.Millisecond

type conPTY struct {
	in     *os.File
	out    *os.File
	exited chan struct{}

	// mu guards the raw handles: a session keeps calling Resize and Kill
	// after they are released, and Windows recycles freed handle values.
	mu      sync.Mutex
	hpc     windows.Handle
	process windows.Handle
}

func startPTY(ctx context.Context, shell string, args, env []string, dir string, cols, rows uint16) (ptyProcess, error) {
	inR, inW, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	outR, outW, err := os.Pipe()
	if err != nil {
		_ = inR.Close()
		_ = inW.Close()
		return nil, err
	}
	var hpc windows.Handle
	err = windows.CreatePseudoConsole(windows.Coord{X: int16(cols), Y: int16(rows)}, windows.Handle(inR.Fd()), windows.Handle(outW.Fd()), 0, &hpc)
	// The console holds its own duplicates of its pipe ends.
	_ = inR.Close()
	_ = outW.Close()
	if err != nil {
		_ = inW.Close()
		_ = outR.Close()
		return nil, err
	}
	process, err := createAttachedProcess(hpc, shell, args, env, dir)
	if err != nil {
		// Nothing drains the output, so break the pipe before
		// ClosePseudoConsole waits on it.
		_ = outR.Close()
		_ = inW.Close()
		windows.ClosePseudoConsole(hpc)
		return nil, err
	}

	p := &conPTY{in: inW, out: outR, exited: make(chan struct{}), hpc: hpc, process: process}
	context.AfterFunc(ctx, func() { _ = p.Kill() })
	go func() {
		_, _ = windows.WaitForSingleObject(process, windows.INFINITE)
		p.mu.Lock()
		_ = windows.CloseHandle(process)
		p.process = 0
		p.mu.Unlock()
		close(p.exited)
		time.Sleep(conptyDrainDelay)
		_ = p.Close()
	}()
	return p, nil
}

func createAttachedProcess(hpc windows.Handle, shell string, args, env []string, dir string) (windows.Handle, error) {
	cmdLine, err := windows.UTF16PtrFromString(windows.ComposeCommandLine(append([]string{shell}, args...)))
	if err != nil {
		return 0, err
	}
	var cwd *uint16
	if dir != "" {
		if cwd, err = windows.UTF16PtrFromString(dir); err != nil {
			return 0, err
		}
	}
	// Environ dedups names case-insensitively (last wins, the hidden =C:
	// entries kept) and falls back to klustr's own environment for nil.
	block, err := envBlock((&exec.Cmd{Env: env}).Environ())
	if err != nil {
		return 0, err
	}

	attrs, err := windows.NewProcThreadAttributeList(1)
	if err != nil {
		return 0, err
	}
	defer attrs.Delete()
	// The attribute value is the HPCON itself, not a pointer to it. Reading
	// its bits through &hpc keeps vet's unsafeptr check, which can't tell a
	// handle from a uintptr-held Go address, from rejecting the conversion.
	hpcValue := *(*unsafe.Pointer)(unsafe.Pointer(&hpc))
	if err := attrs.Update(windows.PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, hpcValue, unsafe.Sizeof(hpc)); err != nil {
		return 0, err
	}
	si := windows.StartupInfoEx{ProcThreadAttributeList: attrs.List()}
	si.Cb = uint32(unsafe.Sizeof(si))
	// Null std handles under STARTF_USESTDHANDLES keep the child from
	// inheriting klustr's own stdio in place of the pseudo console.
	si.Flags = windows.STARTF_USESTDHANDLES

	var pi windows.ProcessInformation
	flags := uint32(windows.EXTENDED_STARTUPINFO_PRESENT | windows.CREATE_UNICODE_ENVIRONMENT)
	if err := windows.CreateProcess(nil, cmdLine, nil, nil, false, flags, block, cwd, &si.StartupInfo, &pi); err != nil {
		return 0, err
	}
	_ = windows.CloseHandle(pi.Thread)
	return pi.Process, nil
}

// envBlock encodes env as the NUL-separated, double-NUL-terminated UTF-16
// block CreateProcess takes with CREATE_UNICODE_ENVIRONMENT.
func envBlock(env []string) (*uint16, error) {
	var block []uint16
	for _, kv := range env {
		u, err := windows.UTF16FromString(kv)
		if err != nil {
			return nil, err
		}
		block = append(block, u...)
	}
	if len(block) == 0 {
		block = append(block, 0)
	}
	block = append(block, 0)
	return &block[0], nil
}

func (p *conPTY) Read(b []byte) (int, error)  { return p.out.Read(b) }
func (p *conPTY) Write(b []byte) (int, error) { return p.in.Write(b) }

// Close runs while the session reader still drains out, which
// ClosePseudoConsole needs to flush its final frame without blocking.
func (p *conPTY) Close() error {
	p.mu.Lock()
	hpc := p.hpc
	p.hpc = 0
	p.mu.Unlock()
	if hpc == 0 {
		return nil
	}
	windows.ClosePseudoConsole(hpc)
	return errors.Join(p.in.Close(), p.out.Close())
}

func (p *conPTY) Kill() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.process == 0 {
		return nil
	}
	return windows.TerminateProcess(p.process, 1)
}

func (p *conPTY) Wait() error {
	<-p.exited
	return nil
}

func (p *conPTY) Resize(cols, rows uint16) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.hpc == 0 {
		return os.ErrClosed
	}
	return windows.ResizePseudoConsole(p.hpc, windows.Coord{X: int16(cols), Y: int16(rows)})
}
