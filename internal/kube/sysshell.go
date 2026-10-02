package kube

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// SystemTerminal is a terminal app discovered on the host. The frontend
// renders these as a "Preferred terminal" picker so the user gets to
// pick (e.g.) Ghostty over the macOS default Terminal.app.
type SystemTerminal struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// shellQuote wraps s in single quotes for safe interpolation into a /bin/sh
// script. Single quotes disable all expansion, so $(...), backticks and $VARS
// are inert; an embedded single quote is closed, escaped, and reopened. Use
// this instead of %q for any value reaching a sourced shell: %q yields a
// double-quoted form that still runs $(...).
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

type darwinTerminalApp struct {
	id      string
	name    string
	appName string
	relPath string
}

var darwinKnownTerminals = []darwinTerminalApp{
	{"terminal", "Terminal", "Terminal", "Terminal.app"},
	{"iterm", "iTerm2", "iTerm", "iTerm.app"},
	{"ghostty", "Ghostty", "Ghostty", "Ghostty.app"},
	{"warp", "Warp", "Warp", "Warp.app"},
	{"alacritty", "Alacritty", "Alacritty", "Alacritty.app"},
	{"kitty", "kitty", "kitty", "kitty.app"},
	{"wezterm", "WezTerm", "WezTerm", "WezTerm.app"},
	{"hyper", "Hyper", "Hyper", "Hyper.app"},
}

// ListSystemTerminals returns the terminal emulators installed on the
// host. On macOS this scans /Applications + ~/Applications; on Linux it
// probes PATH. Windows has no picker list: an empty appID opens the
// default terminal app.
func (m *ClientManager) ListSystemTerminals() []SystemTerminal {
	switch runtime.GOOS {
	case "darwin":
		return listDarwinTerminals()
	case "linux":
		return listLinuxTerminals()
	}
	return []SystemTerminal{}
}

// OpenPodExecInSystemTerminal opens an external terminal running `kubectl
// exec` into the pod against a single-context KUBECONFIG. An empty shellPath
// means /bin/sh; an empty container lets kubectl pick the first.
func (m *ClientManager) OpenPodExecInSystemTerminal(
	contextName, namespace, podName, container, shellPath, appID string,
) error {
	if contextName == "" || namespace == "" || podName == "" {
		return fmt.Errorf("context, namespace and pod are required")
	}
	if shellPath == "" {
		shellPath = "/bin/sh"
	}

	kubeconfigPath, err := writeContextKubeconfig(m.rules, contextName)
	if err != nil {
		return err
	}
	if runtime.GOOS == "windows" {
		env := windowsExecEnv(os.Environ(), kubeconfigPath, contextName, namespace, podName, container, shellPath)
		if err := launchWindowsConsole(appID, windowsExecCommand, false, env, kubeconfigPath); err != nil {
			_ = os.Remove(kubeconfigPath)
			return err
		}
		return nil
	}
	scriptPath, err := writePodExecLauncher(kubeconfigPath, contextName, namespace, podName, container, shellPath)
	if err != nil {
		_ = os.Remove(kubeconfigPath)
		return err
	}
	if err := launchExternalTerminal(scriptPath, appID); err != nil {
		_ = os.Remove(kubeconfigPath)
		_ = os.Remove(scriptPath)
		return err
	}
	return nil
}

func writePodExecLauncher(kubeconfigPath, contextName, namespace, podName, container, shellPath string) (string, error) {
	suffix := ".sh"
	if runtime.GOOS == "darwin" {
		suffix = ".command"
	}
	f, err := os.CreateTemp("", "klustr-exec-*"+suffix)
	if err != nil {
		return "", err
	}
	path := f.Name()

	containerArg := ""
	if container != "" {
		containerArg = "-c " + shellQuote(container) + " "
	}

	// We explicitly check for kubectl before invoking it so that if the
	// user opens this on a machine without kubectl on PATH, they get a
	// readable message instead of the terminal flashing closed with
	// exit 127.
	body := fmt.Sprintf(`#!/bin/sh
KC=%s
SCRIPT=%s
trap 'rm -f "$KC" "$SCRIPT"' EXIT
export KUBECONFIG="$KC"
export KLUSTR_CONTEXT=%s
export KUBE_CONTEXT=%s
if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found on PATH. Install kubectl or use the in-app Exec tab."
  echo
  printf "Press Enter to close. "
  read _
  exit 127
fi
kubectl exec -it -n %s %s%s -- %s
`, shellQuote(kubeconfigPath), shellQuote(path), shellQuote(contextName), shellQuote(contextName), shellQuote(namespace), containerArg, shellQuote(podName), shellQuote(shellPath))

	if _, err := f.WriteString(body); err != nil {
		_ = f.Close()
		_ = os.Remove(path)
		return "", err
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	if err := os.Chmod(path, 0o700); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	return path, nil
}

// OpenInSystemTerminal opens the user's login shell in an external terminal
// with KUBECONFIG set to a single-context copy; an EXIT trap deletes the temp
// kubeconfig and launcher script. appID is an id from ListSystemTerminals;
// empty means the macOS .command handler, the Linux priority list, or the
// Windows default terminal app.
func (m *ClientManager) OpenInSystemTerminal(contextName, appID string) error {
	if contextName == "" {
		return fmt.Errorf("context name is required")
	}

	kubeconfigPath, err := writeContextKubeconfig(m.rules, contextName)
	if err != nil {
		return err
	}
	if runtime.GOOS == "windows" {
		env := windowsLaunchEnv(os.Environ(), kubeconfigPath, contextName)
		if err := launchWindowsConsole(appID, windowsShellCommand, true, env, kubeconfigPath); err != nil {
			_ = os.Remove(kubeconfigPath)
			return err
		}
		return nil
	}
	scriptPath, err := writeLauncherScript(kubeconfigPath, contextName)
	if err != nil {
		_ = os.Remove(kubeconfigPath)
		return err
	}
	if err := launchExternalTerminal(scriptPath, appID); err != nil {
		_ = os.Remove(kubeconfigPath)
		_ = os.Remove(scriptPath)
		return err
	}
	return nil
}

func writeLauncherScript(kubeconfigPath, contextName string) (string, error) {
	suffix := ".sh"
	if runtime.GOOS == "darwin" {
		// .command is the macOS double-clickable shell-script extension;
		// `open` routes it to the user's preferred terminal app.
		suffix = ".command"
	}

	f, err := os.CreateTemp("", "klustr-shell-*"+suffix)
	if err != nil {
		return "", err
	}
	path := f.Name()

	// shellQuote single-quotes every interpolated value: the context name
	// comes from an untrusted kubeconfig, and Go's %q leaves $(...) and
	// backticks live inside shell double quotes (a host-RCE vector). The
	// EXIT trap cleans up both files even when the user closes the terminal
	// window — only an outright SIGKILL leaks them.
	body := fmt.Sprintf(`#!/bin/sh
KC=%s
SCRIPT=%s
trap 'rm -f "$KC" "$SCRIPT"' EXIT
export KUBECONFIG="$KC"
export KLUSTR_CONTEXT=%s
export KUBE_CONTEXT=%s
cd "$HOME" 2>/dev/null || true
"${SHELL:-/bin/sh}" -l
`, shellQuote(kubeconfigPath), shellQuote(path), shellQuote(contextName), shellQuote(contextName))

	if _, err := f.WriteString(body); err != nil {
		_ = f.Close()
		_ = os.Remove(path)
		return "", err
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	if err := os.Chmod(path, 0o700); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	return path, nil
}

func launchExternalTerminal(scriptPath, appID string) error {
	switch runtime.GOOS {
	case "darwin":
		return launchDarwinTerminal(scriptPath, appID)
	case "linux":
		return launchLinuxTerminal(scriptPath, appID)
	default:
		return fmt.Errorf("opening a system terminal is not supported on %s", runtime.GOOS)
	}
}

func windowsPowerShellPath() (string, error) {
	for _, name := range []string{"pwsh.exe", "powershell.exe"} {
		if p, err := exec.LookPath(name); err == nil {
			return p, nil
		}
	}
	return "", fmt.Errorf("PowerShell is not on PATH")
}

// launchWindowsConsole runs PowerShell in a console of its own, which Windows
// opens in the default terminal app (Windows Terminal unless the user picked
// another). wt.exe is not called directly: it splits its command line at
// every ';' and rejoins arguments without escaping their quotes. command is
// a constant and every value reaches it through env, so nothing from the
// kubeconfig is ever parsed as PowerShell, and the command line carries no
// encoded payload for endpoint security rules to flag. Execution policy
// covers script files, not -Command. The kubeconfig is removed once the
// window closes, or by SweepStaleLaunchFiles if klustr quit first.
func launchWindowsConsole(appID, command string, interactive bool, env []string, kubeconfigPath string) error {
	if appID != "" {
		return fmt.Errorf("unknown terminal app %q", appID)
	}
	shell, err := windowsPowerShellPath()
	if err != nil {
		return err
	}
	home, _ := os.UserHomeDir()
	return startInNewConsole(windowsLaunchArgv(shell, command, interactive), env, home, func() {
		_ = os.Remove(kubeconfigPath)
	})
}

// windowsLaunchArgv adds -NoExit to keep the prompt once command returns.
func windowsLaunchArgv(shell, command string, interactive bool) []string {
	argv := []string{shell, "-NoLogo"}
	if interactive {
		argv = append(argv, "-NoExit")
	}
	return append(argv, "-Command", command)
}

// windowsLaunchEnv is base plus everything a launch command reads. The
// commands take the kubeconfig from KLUSTR_KUBECONFIG and set KUBECONFIG
// again: the user's profile runs before them and may set its own.
func windowsLaunchEnv(base []string, kubeconfigPath, contextName string) []string {
	return append(contextEnv(base, kubeconfigPath, contextName), "KLUSTR_KUBECONFIG="+kubeconfigPath)
}

func windowsExecEnv(base []string, kubeconfigPath, contextName, namespace, podName, container, shellPath string) []string {
	return append(windowsLaunchEnv(base, kubeconfigPath, contextName),
		"KLUSTR_EXEC_NAMESPACE="+namespace,
		"KLUSTR_EXEC_POD="+podName,
		// Set even when empty, so the container can't come from klustr's
		// own environment.
		"KLUSTR_EXEC_CONTAINER="+container,
		"KLUSTR_EXEC_SHELL="+shellPath,
	)
}

// windowsShellCommand sets up the interactive session. It returns before the
// prompt appears under -NoExit, so a try/finally would delete the kubeconfig
// at once; the exit event runs when the session exits. It deletes through
// .NET: the runspace is already closing and can't load a module, so a
// Remove-Item whose module isn't loaded yet fails, silently under
// SilentlyContinue. The open handle, which shares read and write but not
// delete, keeps SweepStaleLaunchFiles off the kubeconfig while the session
// lives. The action reads the path from a global: PowerShell.Exiting leaves
// $Event.MessageData null.
var windowsShellCommand = strings.Join([]string{
	`$global:KlustrKubeconfig = $env:KLUSTR_KUBECONFIG`,
	`$env:KUBECONFIG = $global:KlustrKubeconfig`,
	`$global:KlustrKubeconfigLock = [IO.File]::Open($global:KlustrKubeconfig, 'Open', 'Read', 'ReadWrite')`,
	`$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { $global:KlustrKubeconfigLock.Dispose(); [IO.File]::Delete($global:KlustrKubeconfig) }`,
}, "; ")

// windowsExecCommand runs kubectl exec from the KLUSTR_EXEC_* variables. The
// lock keeps SweepStaleLaunchFiles off the kubeconfig, as in
// windowsShellCommand. A failed exec (pod gone, RBAC, no such shell) waits
// for Enter: the window would otherwise close over the error.
var windowsExecCommand = strings.Join([]string{
	`$env:KUBECONFIG = $env:KLUSTR_KUBECONFIG`,
	`$kubeconfigLock = [IO.File]::Open($env:KLUSTR_KUBECONFIG, 'Open', 'Read', 'ReadWrite')`,
	`try { ` + strings.Join([]string{
		`if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) { Write-Host 'kubectl not found on PATH. Install kubectl or use the in-app Exec tab.'; Write-Host ''; Read-Host 'Press Enter to close'; exit 127 }`,
		`$kubectlArgs = @('exec', '-it', '-n', $env:KLUSTR_EXEC_NAMESPACE)`,
		`if ($env:KLUSTR_EXEC_CONTAINER) { $kubectlArgs += @('-c', $env:KLUSTR_EXEC_CONTAINER) }`,
		`$kubectlArgs += @($env:KLUSTR_EXEC_POD, '--', $env:KLUSTR_EXEC_SHELL)`,
		`kubectl @kubectlArgs`,
		`if ($LASTEXITCODE -ne 0) { Write-Host ''; Read-Host ('kubectl exited with code {0}. Press Enter to close' -f $LASTEXITCODE) }`,
	}, "; ") + ` } finally { $kubeconfigLock.Dispose(); Remove-Item -LiteralPath $env:KLUSTR_KUBECONFIG -Force -ErrorAction SilentlyContinue }`,
}, "; ")

// staleLaunchFileAge covers the moment before a new terminal opens its
// kubeconfig, which another klustr instance's sweep could otherwise hit.
const staleLaunchFileAge = 24 * time.Hour

// SweepStaleLaunchFiles deletes the temp kubeconfigs that external Windows
// terminals leave behind: klustr removes one when its window closes, but not
// once klustr has quit, and closing the window skips PowerShell's Exiting
// handler. Unix launchers clean up in their EXIT trap instead. A live
// terminal, in-app or external, holds its kubeconfig open without
// FILE_SHARE_DELETE, so Windows refuses to delete it and the sweep only
// takes abandoned ones.
func (m *ClientManager) SweepStaleLaunchFiles() {
	if runtime.GOOS != "windows" {
		return
	}
	sweepStaleLaunchFiles(os.TempDir(), time.Now().Add(-staleLaunchFileAge))
}

func sweepStaleLaunchFiles(dir string, cutoff time.Time) {
	matches, _ := filepath.Glob(filepath.Join(dir, "klustr-kubeconfig-*.yaml"))
	for _, path := range matches {
		info, err := os.Lstat(path)
		if err != nil || !info.Mode().IsRegular() || info.ModTime().After(cutoff) {
			continue
		}
		_ = os.Remove(path)
	}
}

// startDetached starts a launcher process and reaps it in the background. The
// external terminal apps fork their own window and the launcher exits within a
// second; without a Wait() that exited process lingers as a zombie in klustr's
// process table until the app quits.
func startDetached(cmd *exec.Cmd) error {
	if err := cmd.Start(); err != nil {
		return err
	}
	go func() { _ = cmd.Wait() }()
	return nil
}

func launchDarwinTerminal(scriptPath, appID string) error {
	if appID == "" {
		// macOS picks whichever app is registered as the .command
		// handler — usually Terminal.app, or whatever the user set in
		// Finder > Get Info > Open With.
		return startDetached(exec.Command("open", scriptPath))
	}
	for _, t := range darwinKnownTerminals {
		if t.id != appID {
			continue
		}
		return startDetached(exec.Command("open", "-a", t.appName, scriptPath))
	}
	return fmt.Errorf("unknown terminal app %q", appID)
}

func listDarwinTerminals() []SystemTerminal {
	dirs := []string{
		"/Applications",
		"/Applications/Utilities",
		// Apple moved Terminal.app under /System on Catalina+. We still
		// scan /Applications/Utilities for older systems and bundles
		// users have placed there manually.
		"/System/Applications/Utilities",
	}
	if home, err := os.UserHomeDir(); err == nil {
		dirs = append(dirs, filepath.Join(home, "Applications"))
	}
	out := make([]SystemTerminal, 0, len(darwinKnownTerminals))
	seen := map[string]bool{}
	for _, t := range darwinKnownTerminals {
		if seen[t.id] {
			continue
		}
		for _, d := range dirs {
			if _, err := os.Stat(filepath.Join(d, t.relPath)); err == nil {
				out = append(out, SystemTerminal{ID: t.id, Name: t.name})
				seen[t.id] = true
				break
			}
		}
	}
	return out
}

type terminalLauncher struct {
	id    string
	label string
	bin   string
	args  func(script string) []string
	// flatpakID, if non-empty, lets the detector pick this terminal up
	// from a Flatpak install when the native binary is not on PATH —
	// the common case on Fedora Silverblue / Bazzite / immutable distros.
	flatpakID string
}

var linuxKnownTerminals = []terminalLauncher{
	{"gnome-terminal", "GNOME Terminal", "gnome-terminal", func(s string) []string { return []string{"--", s} }, "org.gnome.Terminal"},
	{"konsole", "Konsole", "konsole", func(s string) []string { return []string{"-e", s} }, "org.kde.konsole"},
	{"xfce4-terminal", "Xfce Terminal", "xfce4-terminal", func(s string) []string { return []string{"-e", s} }, ""},
	{"tilix", "Tilix", "tilix", func(s string) []string { return []string{"-e", s} }, ""},
	{"ghostty", "Ghostty", "ghostty", func(s string) []string { return []string{"-e", s} }, "com.mitchellh.ghostty"},
	{"kitty", "kitty", "kitty", func(s string) []string { return []string{s} }, "net.kovidgoyal.kitty"},
	{"alacritty", "Alacritty", "alacritty", func(s string) []string { return []string{"-e", s} }, "org.alacritty.Alacritty"},
	{"wezterm", "WezTerm", "wezterm", func(s string) []string { return []string{"start", "--", s} }, "org.wezfurlong.wezterm"},
	{"foot", "foot", "foot", func(s string) []string { return []string{s} }, ""},
	{"xterm", "xterm", "xterm", func(s string) []string { return []string{"-e", s} }, ""},
}

const flatpakPrefix = "flatpak:"

func listLinuxTerminals() []SystemTerminal {
	seen := map[string]bool{}
	out := make([]SystemTerminal, 0, len(linuxKnownTerminals)+2)

	// xdg-terminal-exec is the freedesktop "default terminal" launcher.
	// When the user has set a default via ~/.config/xdg-terminals.list
	// (newer GNOME / KDE / xdg-utils), this is the right thing to honor
	// — surface it as a first-class option labeled accordingly.
	if _, err := exec.LookPath("xdg-terminal-exec"); err == nil {
		out = append(out, SystemTerminal{ID: "xdg-default", Name: "System default (xdg-terminal-exec)"})
	}

	for _, c := range linuxKnownTerminals {
		if _, err := exec.LookPath(c.bin); err == nil {
			out = append(out, SystemTerminal{ID: c.id, Name: c.label})
			seen[c.id] = true
		}
	}

	// Probe Flatpak-installed terminals: useful on immutable distros
	// (Silverblue, Bazzite, …) where the canonical install location is
	// not PATH but `flatpak run <app-id>`. Dedup by friendly id so a
	// native install is preferred when both are present.
	installed := flatpakInstalledApps()
	for _, c := range linuxKnownTerminals {
		if seen[c.id] || c.flatpakID == "" {
			continue
		}
		if installed[c.flatpakID] {
			out = append(out, SystemTerminal{
				ID:   flatpakPrefix + c.id,
				Name: c.label + " (Flatpak)",
			})
		}
	}
	return out
}

// flatpakInstalledApps returns the set of Flatpak application ids the
// user has installed. Empty when flatpak is not on PATH or the call
// fails — we deliberately swallow errors so absence is treated as "no
// flatpak terminals", not a hard failure.
func flatpakInstalledApps() map[string]bool {
	if _, err := exec.LookPath("flatpak"); err != nil {
		return nil
	}
	out, err := exec.Command("flatpak", "list", "--app", "--columns=application").Output()
	if err != nil {
		return nil
	}
	set := map[string]bool{}
	for line := range strings.SplitSeq(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			set[line] = true
		}
	}
	return set
}

func launchLinuxTerminal(scriptPath, appID string) error {
	if appID == "xdg-default" {
		bin, err := exec.LookPath("xdg-terminal-exec")
		if err != nil {
			return fmt.Errorf("xdg-terminal-exec is no longer on PATH")
		}
		return startDetached(exec.Command(bin, scriptPath))
	}
	if id, ok := strings.CutPrefix(appID, flatpakPrefix); ok {
		for _, c := range linuxKnownTerminals {
			if c.id != id || c.flatpakID == "" {
				continue
			}
			// `flatpak run <app-id> <args>` — the app inside the
			// sandbox receives the args verbatim, so each terminal's
			// per-binary flag form (e.g. `--`, `-e`) still applies.
			args := append([]string{"run", c.flatpakID}, c.args(scriptPath)...)
			return startDetached(exec.Command("flatpak", args...))
		}
		return fmt.Errorf("unknown flatpak terminal app %q", appID)
	}
	if appID != "" {
		for _, c := range linuxKnownTerminals {
			if c.id != appID {
				continue
			}
			bin, err := exec.LookPath(c.bin)
			if err != nil {
				return fmt.Errorf("%s is not on PATH", c.bin)
			}
			return startDetached(exec.Command(bin, c.args(scriptPath)...))
		}
		return fmt.Errorf("unknown terminal app %q", appID)
	}

	// Empty appID — walk a fallback chain that prefers the freedesktop
	// "default terminal" spec, then the Debian alternatives system,
	// then a tiling-WM convention, then a user override, then the
	// known list in priority order.
	for _, bin := range []string{"xdg-terminal-exec", "x-terminal-emulator", "i3-sensible-terminal"} {
		if path, err := exec.LookPath(bin); err == nil {
			if bin == "xdg-terminal-exec" {
				return startDetached(exec.Command(path, scriptPath))
			}
			return startDetached(exec.Command(path, "-e", scriptPath))
		}
	}
	if pref := os.Getenv("KLUSTR_TERMINAL"); pref != "" {
		if bin, err := exec.LookPath(pref); err == nil {
			return startDetached(exec.Command(bin, scriptPath))
		}
	}
	for _, c := range linuxKnownTerminals {
		bin, err := exec.LookPath(c.bin)
		if err != nil {
			continue
		}
		return startDetached(exec.Command(bin, c.args(scriptPath)...))
	}
	return fmt.Errorf("no supported terminal emulator found on PATH (set $KLUSTR_TERMINAL or install gnome-terminal/konsole/kitty/alacritty/wezterm)")
}
