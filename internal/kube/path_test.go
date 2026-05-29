package kube

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestAugmentExecPathPrependsExistingDirectoriesOnce(t *testing.T) {
	home := t.TempDir()
	binDir := filepath.Join(home, "bin")
	if err := os.Mkdir(binDir, 0o755); err != nil {
		t.Fatalf("mkdir bin: %v", err)
	}

	t.Setenv("HOME", home)
	t.Setenv("PATH", "/usr/bin")

	augmentExecPath()

	got := os.Getenv("PATH")
	parts := filepath.SplitList(got)

	if parts[len(parts)-1] != "/usr/bin" {
		t.Fatalf("original PATH should be preserved as suffix, got %q", got)
	}
	if !slices.Contains(parts, binDir) {
		t.Fatalf("expected %q in PATH, got %q", binDir, got)
	}

	augmentExecPath()

	count := 0
	for _, p := range filepath.SplitList(os.Getenv("PATH")) {
		if p == binDir {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("expected %q to appear once after double-call, got %d", binDir, count)
	}
}

func TestAugmentExecPathSkipsMissingDirectories(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("PATH", "")

	augmentExecPath()

	for _, p := range filepath.SplitList(os.Getenv("PATH")) {
		if strings.Contains(p, home) {
			info, err := os.Stat(p)
			if err != nil || !info.IsDir() {
				t.Fatalf("non-existent directory %q ended up in PATH", p)
			}
		}
	}
}
