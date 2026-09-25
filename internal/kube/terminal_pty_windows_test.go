//go:build windows

package kube

import (
	"context"
	"io"
	"strings"
	"testing"
	"time"
)

func TestDedupEnvKeepsLastCaseInsensitive(t *testing.T) {
	got := dedupEnv([]string{"Kubeconfig=a", "PATH=p", "KUBECONFIG=b"})
	if len(got) != 2 || got[0] != "PATH=p" || got[1] != "KUBECONFIG=b" {
		t.Errorf("dedupEnv = %v", got)
	}
}

func TestConPTYRunsCommandAndExits(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	proc, err := startPTY(ctx, "cmd.exe", []string{"/c", "echo klustr-conpty-ok"}, nil, "", 80, 24)
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
		if !strings.Contains(out, "klustr-conpty-ok") {
			t.Errorf("output %q missing marker", out)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("reader never reached EOF after the shell exited")
	}
}
