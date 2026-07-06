package kube

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/creack/pty"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

type TerminalDataFunc func(data string)
type TerminalCloseFunc func(err error)

type terminalSession struct {
	id         string
	context    string
	cmd        *exec.Cmd
	ptmx       *os.File
	cancel     context.CancelFunc
	kubeconfig string
	once       sync.Once
}

func (s *terminalSession) close() {
	s.once.Do(func() {
		s.cancel()
		if s.ptmx != nil {
			_ = s.ptmx.Close()
		}
		if s.cmd != nil && s.cmd.Process != nil {
			_ = s.cmd.Process.Kill()
		}
		if s.kubeconfig != "" {
			_ = os.Remove(s.kubeconfig)
		}
	})
}

type terminalSessionManager struct {
	mu       sync.Mutex
	sessions map[string]*terminalSession
	counter  uint64
}

func newTerminalSessionManager() *terminalSessionManager {
	return &terminalSessionManager{sessions: make(map[string]*terminalSession)}
}

// start spawns a host login shell with KUBECONFIG pointing at a minified
// single-context copy of the user's kubeconfig. The shell inherits the
// user's existing environment so PATH-resolved kubectl, helm, stern, etc.
// talk to the right cluster without any further interactive setup.
func (mgr *terminalSessionManager) start(
	parent context.Context,
	rules *clientcmd.ClientConfigLoadingRules,
	contextName string,
	cols, rows uint16,
	onData TerminalDataFunc,
	onClose TerminalCloseFunc,
) (string, error) {
	if runtime.GOOS == "windows" {
		return "", fmt.Errorf("terminal sessions are not supported on Windows yet")
	}
	if contextName == "" {
		return "", fmt.Errorf("context name is required")
	}

	kubeconfigPath, err := writeContextKubeconfig(rules, contextName)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithCancel(parent)
	shell := userShell()
	cmd := exec.CommandContext(ctx, shell, loginShellArgs(shell)...)
	cmd.Env = terminalEnv(os.Environ(), kubeconfigPath, contextName, defaultUTF8Locale())
	if home, err := os.UserHomeDir(); err == nil {
		cmd.Dir = home
	}

	winsz := &pty.Winsize{Cols: cols, Rows: rows}
	if winsz.Cols == 0 {
		winsz.Cols = 80
	}
	if winsz.Rows == 0 {
		winsz.Rows = 24
	}

	ptmx, err := pty.StartWithSize(cmd, winsz)
	if err != nil {
		cancel()
		_ = os.Remove(kubeconfigPath)
		return "", err
	}

	id := fmt.Sprintf("term-%d", atomic.AddUint64(&mgr.counter, 1))
	sess := &terminalSession{
		id:         id,
		context:    contextName,
		cmd:        cmd,
		ptmx:       ptmx,
		cancel:     cancel,
		kubeconfig: kubeconfigPath,
	}

	mgr.mu.Lock()
	mgr.sessions[id] = sess
	mgr.mu.Unlock()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				// string copies out of the reused read buffer in one pass — the
				// consumer wants a string anyway, so no separate []byte copy.
				onData(string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
		waitErr := cmd.Wait()
		mgr.mu.Lock()
		delete(mgr.sessions, id)
		mgr.mu.Unlock()
		sess.close()
		if onClose != nil {
			// A shell that ran and exited — even with a non-zero status
			// (exit 1, or Ctrl-D after a failed command) — is a clean close,
			// not a session error. Only surface a real spawn/IO failure.
			var exitErr *exec.ExitError
			clean := waitErr == nil || errors.Is(waitErr, io.EOF) ||
				ctx.Err() == context.Canceled || errors.As(waitErr, &exitErr)
			if clean {
				onClose(nil)
			} else {
				onClose(waitErr)
			}
		}
	}()

	return id, nil
}

func (mgr *terminalSessionManager) sendInput(id, data string) {
	mgr.mu.Lock()
	sess := mgr.sessions[id]
	mgr.mu.Unlock()
	if sess == nil {
		return
	}
	_, _ = sess.ptmx.Write([]byte(data))
}

func (mgr *terminalSessionManager) resize(id string, cols, rows uint16) {
	mgr.mu.Lock()
	sess := mgr.sessions[id]
	mgr.mu.Unlock()
	if sess == nil {
		return
	}
	_ = pty.Setsize(sess.ptmx, &pty.Winsize{Cols: cols, Rows: rows})
}

func (mgr *terminalSessionManager) stop(id string) {
	mgr.mu.Lock()
	sess, ok := mgr.sessions[id]
	if ok {
		delete(mgr.sessions, id)
	}
	mgr.mu.Unlock()
	if ok {
		sess.close()
	}
}

// stopForContext kills every local shell bound to a context, called from
// StopWatch so a disconnect tears down its terminals (each holds a minified
// kubeconfig for that context) instead of leaving them live.
func (mgr *terminalSessionManager) stopForContext(contextName string) {
	mgr.mu.Lock()
	var stopped []*terminalSession
	for id, s := range mgr.sessions {
		if s.context == contextName {
			stopped = append(stopped, s)
			delete(mgr.sessions, id)
		}
	}
	mgr.mu.Unlock()
	for _, s := range stopped {
		s.close()
	}
}

func (mgr *terminalSessionManager) stopAll() {
	mgr.mu.Lock()
	sessions := make([]*terminalSession, 0, len(mgr.sessions))
	for _, s := range mgr.sessions {
		sessions = append(sessions, s)
	}
	mgr.sessions = make(map[string]*terminalSession)
	mgr.mu.Unlock()
	for _, s := range sessions {
		s.close()
	}
}

// terminalEnv augments the inherited environment for the PTY shell. A
// GUI-launched bundle (Finder/Dock on macOS, a .desktop entry on Linux)
// starts with no controlling terminal, so the variables a shell normally
// inherits from a real terminal are simply absent. Without TERM, tput
// fails and zsh's line editor can't resolve terminfo — it redraws the
// prompt by reprinting characters instead of repositioning the cursor, so
// every keystroke appears several times. Without a UTF-8 locale, the
// Nerd Font glyphs that modern prompts emit garble. We only fill in
// defaults the user has not already exported. locale is the UTF-8 locale
// to fall back to (see defaultUTF8Locale); it is empty when none could be
// confirmed on this host, in which case we leave the locale untouched
// rather than export one that triggers setlocale warnings.
func terminalEnv(base []string, kubeconfigPath, contextName, locale string) []string {
	env := append([]string{}, base...)
	env = append(env,
		"KUBECONFIG="+kubeconfigPath,
		"KLUSTR_CONTEXT="+contextName,
		// Hint for users with PS1 logic that wants to surface the cluster.
		"KUBE_CONTEXT="+contextName,
	)
	if !hasEnvKey(env, "TERM") {
		env = append(env, "TERM=xterm-256color")
	}
	if !hasEnvKey(env, "COLORTERM") {
		env = append(env, "COLORTERM=truecolor")
	}
	if locale != "" && !hasEnvKey(env, "LANG") && !hasEnvKey(env, "LC_ALL") && !hasEnvKey(env, "LC_CTYPE") {
		env = append(env, "LANG="+locale)
	}
	return env
}

// defaultUTF8Locale returns a UTF-8 locale that actually exists on this
// host, or "" if none can be confirmed. A GUI-launched shell inherits no
// locale, and blindly exporting en_US.UTF-8 triggers setlocale warnings on
// Linux boxes where that locale was never generated — so we pick from what
// `locale -a` reports, preferring the portable C.UTF-8 (common on Linux)
// and falling back to en_US.UTF-8 (always present on macOS). locale names
// are compared case-insensitively and dash-insensitively because Linux
// reports them lowercased and without the dash (en_US.utf8, C.utf8).
func defaultUTF8Locale() string {
	out, err := exec.Command("locale", "-a").Output()
	if err != nil {
		if runtime.GOOS == "darwin" {
			return "en_US.UTF-8"
		}
		return ""
	}
	available := make(map[string]bool)
	for line := range strings.SplitSeq(string(out), "\n") {
		if norm := normalizeLocale(line); norm != "" {
			available[norm] = true
		}
	}
	for _, want := range []string{"C.UTF-8", "en_US.UTF-8"} {
		if available[normalizeLocale(want)] {
			return want
		}
	}
	return ""
}

func normalizeLocale(s string) string {
	return strings.ToLower(strings.ReplaceAll(strings.TrimSpace(s), "-", ""))
}

func hasEnvKey(env []string, key string) bool {
	prefix := key + "="
	for _, e := range env {
		if strings.HasPrefix(e, prefix) {
			return true
		}
	}
	return false
}

func userShell() string {
	if s := os.Getenv("SHELL"); s != "" {
		return s
	}
	if runtime.GOOS == "darwin" {
		return "/bin/zsh"
	}
	return "/bin/bash"
}

// loginShellArgs picks the right "behave like a login shell" flag so the
// user's normal rc files (.zshrc / .bashrc / .profile) are sourced and
// prompts, aliases and shell functions look like a regular Terminal tab.
func loginShellArgs(shell string) []string {
	switch {
	case strings.HasSuffix(shell, "zsh"), strings.HasSuffix(shell, "bash"):
		return []string{"-l"}
	default:
		return nil
	}
}

// writeContextKubeconfig writes a minified kubeconfig containing only
// the named context, its cluster, and its auth user to a 0600 temp file.
// The spawned shell loads it via KUBECONFIG=<path> so kubectl, helm,
// stern, etc. target the right cluster without the user running
// `kubectl config use-context` and without us touching their real
// ~/.kube/config (which may have dozens of contexts they don't want
// any single terminal tab to mutate).
func writeContextKubeconfig(rules *clientcmd.ClientConfigLoadingRules, contextName string) (string, error) {
	raw, err := rules.Load()
	if err != nil {
		return "", err
	}
	if _, ok := raw.Contexts[contextName]; !ok {
		return "", fmt.Errorf("context %q not found", contextName)
	}
	cfg := raw.DeepCopy()
	cfg.CurrentContext = contextName
	if err := clientcmdapi.MinifyConfig(cfg); err != nil {
		return "", err
	}

	f, err := os.CreateTemp("", "klustr-kubeconfig-*.yaml")
	if err != nil {
		return "", err
	}
	path := f.Name()
	_ = f.Close()
	if err := os.Chmod(path, 0o600); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	if err := clientcmd.WriteToFile(*cfg, path); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	return path, nil
}
