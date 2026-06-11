package kube

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

const shellEnvTimeout = 5 * time.Second

// shellEnvAllowlist is the set of variables imported from the user's login
// shell besides PATH. Everything else in the dump is dropped: importing the
// full environment would let a single stray variable (DYLD_*, LD_PRELOAD,
// GOFLAGS, …) change process behavior in ways we never tested, and the
// variables credential helpers actually need are a short, known list.
var shellEnvAllowlist = []string{
	"AWS_VAULT_BACKEND",
	"AWS_PROFILE",
	"AWS_CONFIG_FILE",
	"AWS_SHARED_CREDENTIALS_FILE",
	"AWS_CA_BUNDLE",
	"SSL_CERT_FILE",
	"CLOUDSDK_CONFIG",
	"AZURE_CONFIG_DIR",
	"HTTPS_PROXY",
	"HTTP_PROXY",
	"NO_PROXY",
	"https_proxy",
	"http_proxy",
	"no_proxy",
	"KUBECONFIG",
}

// importShellEnv spawns the user's interactive login shell, dumps its
// environment between sentinel markers and merges PATH plus the allowlist
// into the process env. GUI launches (Finder, Dock, .desktop) skip the
// shell rc entirely, so exec credential helpers configured there — extra
// PATH entries, AWS_VAULT_BACKEND, proxies — are otherwise invisible to
// klustr. Terminal launches (wails dev, a shell-started binary) already
// have the full environment and are skipped via the TERM heuristic.
func importShellEnv(timeout time.Duration) {
	if runtime.GOOS == "windows" {
		return
	}
	if os.Getenv("TERM") != "" || os.Getenv("TERM_PROGRAM") != "" {
		return
	}
	env, err := captureShellEnv(timeout)
	if err != nil {
		return
	}
	mergeShellEnv(env)
}

func captureShellEnv(timeout time.Duration) (map[string]string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return nil, err
	}
	sentinel := "_KLUSTR_ENV_" + hex.EncodeToString(buf) + "_"
	script := fmt.Sprintf("echo %s; command env; echo %s", sentinel, sentinel)

	shell := userShell()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, shell, shellEnvArgs(shell, script)...)
	// An interactive shell may leave background children holding stdout
	// open past the kill; WaitDelay stops Output() from blocking on them.
	cmd.WaitDelay = time.Second
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return parseShellEnv(string(out), sentinel)
}

// shellEnvArgs returns flags that make the shell source its interactive rc
// files (where users export PATH and helper config) and run the dump script.
func shellEnvArgs(shell, script string) []string {
	switch filepath.Base(shell) {
	case "zsh", "bash", "fish":
		return []string{"-i", "-l", "-c", script}
	default:
		return []string{"-l", "-c", script}
	}
}

var envLineRe = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*=`)

// parseShellEnv extracts KEY=VALUE pairs between the first and last sentinel
// occurrences. rc files are free to print anything before, after or even in
// between (motd, direnv, …) — non-matching lines and continuation lines of
// multi-line values simply fail the KEY= regex and drop out, which is safe
// because only allowlisted single-line variables are consumed.
func parseShellEnv(output, sentinel string) (map[string]string, error) {
	first := strings.Index(output, sentinel)
	last := strings.LastIndex(output, sentinel)
	if first == -1 || last <= first {
		return nil, fmt.Errorf("shell env dump missing sentinel")
	}
	section := output[first+len(sentinel) : last]

	env := make(map[string]string)
	for line := range strings.SplitSeq(section, "\n") {
		if !envLineRe.MatchString(line) {
			continue
		}
		key, value, _ := strings.Cut(line, "=")
		env[key] = value
	}
	if len(env) == 0 {
		return nil, fmt.Errorf("shell env dump empty")
	}
	return env, nil
}

func mergeShellEnv(env map[string]string) {
	if shellPath := env["PATH"]; shellPath != "" {
		_ = os.Setenv("PATH", mergePathLists(shellPath, os.Getenv("PATH")))
	}
	for _, key := range shellEnvAllowlist {
		if v := env[key]; v != "" {
			_ = os.Setenv(key, v)
		}
	}
}

// mergePathLists puts the shell's PATH first (it is the user's intended
// order) and appends any current-process entries not already present, so the
// hardcoded fallback dirs from augmentExecPath survive when the shell dump
// lacks them.
func mergePathLists(shellPath, currentPath string) string {
	seen := make(map[string]bool)
	merged := make([]string, 0)
	for _, list := range []string{shellPath, currentPath} {
		for _, dir := range filepath.SplitList(list) {
			if dir == "" || seen[dir] {
				continue
			}
			seen[dir] = true
			merged = append(merged, dir)
		}
	}
	return strings.Join(merged, string(filepath.ListSeparator))
}
