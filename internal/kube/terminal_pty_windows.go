//go:build windows

package kube

import (
	"context"
	"strings"
	"sync"
	"time"

	"klustr/internal/conpty"

	"golang.org/x/sys/windows"
)

// conptyDrainDelay allows output of exited shell to reach
// reader before the pseudo console is closed.
const conptyDrainDelay = 200 * time.Millisecond

type conptyPTY struct {
	cpty *conpty.ConPty
	once sync.Once
	done chan struct{}
}

func startPTY(ctx context.Context, shell string, args, env []string, dir string, cols, rows uint16) (ptyProcess, error) {
	cpty, err := conpty.Start(
		windows.ComposeCommandLine(append([]string{shell}, args...)),
		conpty.ConPtyDimensions(int(cols), int(rows)),
		conpty.ConPtyEnv(dedupEnv(env)),
		conpty.ConPtyWorkDir(dir),
	)
	if err != nil {
		return nil, err
	}
	p := &conptyPTY{cpty: cpty, done: make(chan struct{})}
	go func() {
		_, _ = cpty.Wait(context.Background())
		close(p.done)
		time.Sleep(conptyDrainDelay)
		_ = p.Close()
	}()
	go func() {
		select {
		case <-ctx.Done():
			_ = p.Close()
		case <-p.done:
		}
	}()
	return p, nil
}

func (p *conptyPTY) Read(b []byte) (int, error)  { return p.cpty.Read(b) }
func (p *conptyPTY) Write(b []byte) (int, error) { return p.cpty.Write(b) }
func (p *conptyPTY) Kill() error                 { return p.Close() }

func (p *conptyPTY) Close() error {
	var err error
	p.once.Do(func() { err = p.cpty.Close() })
	return err
}

func (p *conptyPTY) Wait() error {
	<-p.done
	return nil
}

func (p *conptyPTY) Resize(cols, rows uint16) error {
	return p.cpty.Resize(int(cols), int(rows))
}

// dedupEnv keeps the last value per name (case-insensitive)
func dedupEnv(env []string) []string {
	last := make(map[string]int, len(env))
	for i, e := range env {
		name, _, _ := strings.Cut(e, "=")
		last[strings.ToUpper(name)] = i
	}
	out := make([]string, 0, len(last))
	for i, e := range env {
		name, _, _ := strings.Cut(e, "=")
		if last[strings.ToUpper(name)] == i {
			out = append(out, e)
		}
	}
	return out
}
