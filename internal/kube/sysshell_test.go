package kube

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestShellQuoteNeutralizesSubstitution(t *testing.T) {
	got := shellQuote(`$(touch /tmp/pwned)`)
	if got != `'$(touch /tmp/pwned)'` {
		t.Fatalf("shellQuote = %q, want single-quoted", got)
	}
	// An embedded single quote must not break out of the quoting.
	if q := shellQuote(`a'b`); q != `'a'\''b'` {
		t.Fatalf("shellQuote(a'b) = %q", q)
	}
}

// A launcher built from a hostile kubeconfig context name must not embed a
// live command substitution — the value has to land single-quoted so /bin/sh
// treats it as data, not code.
func TestWriteLauncherScriptQuotesContextName(t *testing.T) {
	const evil = `$(touch /tmp/klustr_pwned)`

	path, err := writeLauncherScript("/tmp/kc.yaml", evil)
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(path)

	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	script := string(body)

	if strings.Contains(script, `KLUSTR_CONTEXT="$(`) || strings.Contains(script, `KUBE_CONTEXT="$(`) {
		t.Fatalf("context name interpolated as live substitution:\n%s", script)
	}
	if !strings.Contains(script, contextAssign(evil)) {
		t.Fatalf("context name not quoted:\n%s", script)
	}
}

func TestWritePodExecLauncherQuotesInputs(t *testing.T) {
	const evil = `$(touch /tmp/klustr_pwned)`

	path, err := writePodExecLauncher("/tmp/kc.yaml", evil, "default", "web", "app", "/bin/sh")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(path)

	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	script := string(body)

	if strings.Contains(script, `"$(`) {
		t.Fatalf("value interpolated as live substitution:\n%s", script)
	}
	if !strings.Contains(script, contextAssign(evil)) {
		t.Fatalf("context name not quoted:\n%s", script)
	}
}

func contextAssign(contextName string) string {
	return "KLUSTR_CONTEXT=" + shellQuote(contextName)
}

// The Windows launch commands are constants: every value, hostile context
// names included, reaches PowerShell through the environment.
func TestWindowsExecEnvCarriesValuesVerbatim(t *testing.T) {
	const evil = `x’; calc.exe ‘ "$(calc.exe)" ; $env:PATH`
	env := windowsExecEnv([]string{"KLUSTR_EXEC_CONTAINER=inherited"}, `C:\Temp\kc.yaml`, evil, evil+"-ns", evil+"-pod", "", evil+"-shell")
	for key, want := range map[string]string{
		"KUBECONFIG":            `C:\Temp\kc.yaml`,
		"KLUSTR_KUBECONFIG":     `C:\Temp\kc.yaml`,
		"KLUSTR_CONTEXT":        evil,
		"KLUSTR_EXEC_NAMESPACE": evil + "-ns",
		"KLUSTR_EXEC_POD":       evil + "-pod",
		"KLUSTR_EXEC_CONTAINER": "",
		"KLUSTR_EXEC_SHELL":     evil + "-shell",
	} {
		if got, _ := envValue(env, key); got != want {
			t.Errorf("%s = %q, want %q", key, got, want)
		}
	}
}

// A double quote would need escaping on its way to PowerShell. Without one,
// windows.ComposeCommandLine only wraps the command in quotes.
func TestWindowsLaunchCommandsAvoidDoubleQuotes(t *testing.T) {
	for name, command := range map[string]string{"shell": windowsShellCommand, "exec": windowsExecCommand} {
		if strings.Contains(command, `"`) {
			t.Errorf("%s command contains a double quote:\n%s", name, command)
		}
	}
}

func TestWindowsLaunchArgv(t *testing.T) {
	got := strings.Join(windowsLaunchArgv(`C:\pwsh.exe`, "cmd", true), " ")
	if want := `C:\pwsh.exe -NoLogo -NoExit -Command cmd`; got != want {
		t.Errorf("interactive argv = %q, want %q", got, want)
	}
	got = strings.Join(windowsLaunchArgv(`C:\pwsh.exe`, "cmd", false), " ")
	if want := `C:\pwsh.exe -NoLogo -Command cmd`; got != want {
		t.Errorf("exec argv = %q, want %q", got, want)
	}
}

func TestSweepStaleLaunchFilesRemovesOnlyOldLaunchFiles(t *testing.T) {
	dir := t.TempDir()
	cutoff := time.Now().Add(-staleLaunchFileAge)
	old := cutoff.Add(-time.Hour)
	write := func(name string, mtime time.Time) string {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, nil, 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(path, mtime, mtime); err != nil {
			t.Fatal(err)
		}
		return path
	}
	stale := []string{
		write("klustr-kubeconfig-1.yaml", old),
	}
	kept := []string{
		write("klustr-kubeconfig-2.yaml", time.Now()),
		write("other-kubeconfig-1.yaml", old),
	}

	sweepStaleLaunchFiles(dir, cutoff)

	for _, p := range stale {
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Errorf("stale file %s not removed", filepath.Base(p))
		}
	}
	for _, p := range kept {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("file %s removed: %v", filepath.Base(p), err)
		}
	}
}

// A live terminal holds its kubeconfig open; the sweep relies on Windows
// refusing to delete it.
func TestSweepStaleLaunchFilesSkipsOpenKubeconfig(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("an open file blocks deletion only on Windows")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "klustr-kubeconfig-1.yaml")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-2 * staleLaunchFileAge)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatal(err)
	}
	lock, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer lock.Close()

	sweepStaleLaunchFiles(dir, time.Now().Add(-staleLaunchFileAge))

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("open kubeconfig removed: %v", err)
	}
}
