//go:build windows

package kube

import (
	"context"
	"io"
	"strings"
	"testing"
	"time"
)

func ptyOutput(t *testing.T, args, env []string) string {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	proc, err := startPTY(ctx, "cmd.exe", args, env, "", 80, 24)
	if err != nil {
		t.Fatalf("startPTY: %v", err)
	}
	defer proc.Close()

	outCh := make(chan string, 1)
	go func() {
		b, _ := io.ReadAll(proc)
		outCh <- string(b)
	}()
	_ = proc.Wait()
	select {
	case out := <-outCh:
		return out
	case <-time.After(10 * time.Second):
		t.Fatal("reader never reached EOF after the shell exited")
		return ""
	}
}

func TestConPTYRunsCommandAndExits(t *testing.T) {
	if out := ptyOutput(t, []string{"/c", "echo klustr-conpty-ok"}, nil); !strings.Contains(out, "klustr-conpty-ok") {
		t.Errorf("output %q missing marker", out)
	}
}

func TestConPTYNilEnvInheritsEnvironment(t *testing.T) {
	t.Setenv("KLUSTR_PTY_INHERIT", "inherited-value")
	if out := ptyOutput(t, []string{"/c", "echo %KLUSTR_PTY_INHERIT%"}, nil); !strings.Contains(out, "inherited-value") {
		t.Errorf("output %q missing the inherited variable", out)
	}
}

func TestConPTYEnvLastValueWinsCaseInsensitive(t *testing.T) {
	env := []string{"KLUSTR_PTY_DUP=first-value", "klustr_pty_dup=last-value"}
	out := ptyOutput(t, []string{"/c", "echo %KLUSTR_PTY_DUP%"}, env)
	if !strings.Contains(out, "last-value") || strings.Contains(out, "first-value") {
		t.Errorf("output %q, want only the last duplicate", out)
	}
}

func TestConPTYCallsAfterCloseFail(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	proc, err := startPTY(ctx, "cmd.exe", nil, nil, "", 80, 24)
	if err != nil {
		t.Fatalf("startPTY: %v", err)
	}
	go func() { _, _ = io.Copy(io.Discard, proc) }()

	if err := proc.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	if err := proc.Resize(100, 30); err == nil {
		t.Error("Resize after Close succeeded")
	}
	if _, err := proc.Write([]byte("dir\r")); err == nil {
		t.Error("Write after Close succeeded")
	}
	_ = proc.Kill()
	_ = proc.Wait()
}

func TestHasEnvKeyIgnoresCaseOnWindows(t *testing.T) {
	if !hasEnvKey([]string{"Term=dumb"}, "TERM") {
		t.Error("Term=dumb not seen as TERM")
	}
}
