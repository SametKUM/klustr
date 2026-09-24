package kube

import (
	"os"
	"path/filepath"
	"strings"
)

// GUI launches on macOS (Finder, Dock, Spotlight) get a minimal PATH without
// Homebrew and similar prefixes, so exec credential helpers (aws,
// gke-gcloud-auth-plugin, kubelogin) fail to resolve. Add their usual
// directories at import time.
func init() {
	augmentExecPath()
}

func augmentExecPath() {
	candidates := []string{
		"/opt/homebrew/bin",
		"/opt/homebrew/sbin",
		"/usr/local/bin",
		"/usr/local/sbin",
	}
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates,
			filepath.Join(home, "bin"),
			filepath.Join(home, ".rd", "bin"),
			filepath.Join(home, ".docker", "bin"),
			filepath.Join(home, "google-cloud-sdk", "bin"),
			filepath.Join(home, ".krew", "bin"),
			filepath.Join(home, ".local", "bin"),
		)
	}

	current := os.Getenv("PATH")
	present := make(map[string]bool)
	for _, p := range filepath.SplitList(current) {
		present[p] = true
	}

	additions := make([]string, 0, len(candidates))
	for _, dir := range candidates {
		if dir == "" || present[dir] {
			continue
		}
		if info, err := os.Stat(dir); err != nil || !info.IsDir() {
			continue
		}
		additions = append(additions, dir)
		present[dir] = true
	}
	if len(additions) == 0 {
		return
	}

	merged := strings.Join(additions, string(filepath.ListSeparator))
	if current != "" {
		merged = merged + string(filepath.ListSeparator) + current
	}
	_ = os.Setenv("PATH", merged)
}
