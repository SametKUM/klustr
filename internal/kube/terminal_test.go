package kube

import (
	"errors"
	"runtime"
	"testing"
)

func envValue(env []string, key string) (string, bool) {
	prefix := key + "="
	for i := len(env) - 1; i >= 0; i-- {
		if len(env[i]) >= len(prefix) && env[i][:len(prefix)] == prefix {
			return env[i][len(prefix):], true
		}
	}
	return "", false
}

func TestTerminalEnvFillsDefaultsWhenMissing(t *testing.T) {
	env := terminalEnv(nil, "/tmp/kubeconfig", "orbstack", "C.UTF-8")

	if v, _ := envValue(env, "KUBECONFIG"); v != "/tmp/kubeconfig" {
		t.Errorf("KUBECONFIG = %q, want /tmp/kubeconfig", v)
	}
	if v, _ := envValue(env, "KLUSTR_CONTEXT"); v != "orbstack" {
		t.Errorf("KLUSTR_CONTEXT = %q, want orbstack", v)
	}
	if v, ok := envValue(env, "TERM"); !ok || v != "xterm-256color" {
		t.Errorf("TERM = %q (set=%v), want xterm-256color", v, ok)
	}
	if v, ok := envValue(env, "COLORTERM"); !ok || v != "truecolor" {
		t.Errorf("COLORTERM = %q (set=%v), want truecolor", v, ok)
	}
	if v, ok := envValue(env, "LANG"); !ok || v != "C.UTF-8" {
		t.Errorf("LANG = %q (set=%v), want C.UTF-8", v, ok)
	}
}

func TestTerminalEnvKeepsUserValues(t *testing.T) {
	base := []string{"TERM=screen-256color", "LC_ALL=tr_TR.UTF-8", "COLORTERM=24bit"}
	env := terminalEnv(base, "/tmp/k", "ctx", "en_US.UTF-8")

	if v, _ := envValue(env, "TERM"); v != "screen-256color" {
		t.Errorf("TERM overridden to %q, want screen-256color", v)
	}
	if v, _ := envValue(env, "COLORTERM"); v != "24bit" {
		t.Errorf("COLORTERM overridden to %q, want 24bit", v)
	}
	if _, ok := envValue(env, "LANG"); ok {
		t.Error("LANG injected even though LC_ALL was already set")
	}
}

func TestTerminalEnvSkipsLocaleWhenNoneConfirmed(t *testing.T) {
	env := terminalEnv(nil, "/tmp/k", "ctx", "")
	if _, ok := envValue(env, "LANG"); ok {
		t.Error("LANG injected even though no UTF-8 locale was confirmed")
	}
	if v, ok := envValue(env, "TERM"); !ok || v != "xterm-256color" {
		t.Errorf("TERM = %q (set=%v), want xterm-256color even with empty locale", v, ok)
	}
}

func TestWSLEnvShared(t *testing.T) {
	const shared = "KUBECONFIG/p:KLUSTR_CONTEXT:KUBE_CONTEXT"
	for _, c := range []struct {
		name string
		env  []string
		want string
	}{
		{"unset", nil, shared},
		{"appended", []string{"WSLENV=FOO/p"}, "FOO/p:" + shared},
		{"variable name ignores case", []string{"WslEnv=FOO/p"}, "FOO/p:" + shared},
		// /w alone would never reach wsl, a bare name skips the path rewrite.
		{"kubeconfig entry replaced", []string{"WSLENV=KUBECONFIG/w:FOO:KUBECONFIG"}, "FOO:" + shared},
		{"no duplicates", []string{"WSLENV=KLUSTR_CONTEXT/u:FOO:KUBECONFIG/up"}, "FOO:" + shared},
		{"entry names keep case", []string{"WSLENV=kubeconfig/p"}, "kubeconfig/p:" + shared},
		{"empty entries dropped", []string{"WSLENV=:FOO::"}, "FOO:" + shared},
	} {
		if got := wslEnvShared(c.env); got != c.want {
			t.Errorf("%s: wslEnvShared(%q) = %q, want %q", c.name, c.env, got, c.want)
		}
	}
}

func TestTerminalEnvSharesContextWithWSL(t *testing.T) {
	env := terminalEnv([]string{"WSLENV=FOO/p"}, `C:\Temp\klustr.yaml`, "prod", "")
	got, _ := envValue(env, "WSLENV")
	if runtime.GOOS != "windows" {
		if got != "FOO/p" {
			t.Errorf("WSLENV changed on %s: %q", runtime.GOOS, got)
		}
		return
	}
	if want := "FOO/p:KUBECONFIG/p:KLUSTR_CONTEXT:KUBE_CONTEXT"; got != want {
		t.Errorf("WSLENV = %q, want %q", got, want)
	}
}

func TestNormalizeLocale(t *testing.T) {
	for _, c := range []struct{ in, want string }{
		{"en_US.UTF-8", "en_us.utf8"},
		{"  C.utf8  ", "c.utf8"},
		{"C.UTF-8", "c.utf8"},
	} {
		if got := normalizeLocale(c.in); got != c.want {
			t.Errorf("normalizeLocale(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestLoginShellArgs(t *testing.T) {
	for _, c := range []struct {
		shell string
		login bool
	}{
		{"/bin/zsh", true},
		{"/usr/local/bin/bash", true},
		{"/bin/rbash", true},
		{`C:\Program Files\Git\bin\bash.exe`, true},
		{`C:\TOOLS\ZSH.EXE`, true},
		{"/bin/sh", false},
		{"/usr/bin/fish", false},
		{`C:\Program Files\PowerShell\7\pwsh.exe`, false},
	} {
		if got := loginShellArgs(c.shell) != nil; got != c.login {
			t.Errorf("loginShellArgs(%q) login = %v, want %v", c.shell, got, c.login)
		}
	}
}

func TestWindowsShellPrefersExplicitShell(t *testing.T) {
	const gitBash = `C:\Program Files\Git\bin\bash.exe`
	getenv := func(k string) string {
		if k == "SHELL" {
			return gitBash
		}
		return ""
	}
	shell, args := windowsShell(getenv, func(name string) (string, error) { return name, nil })
	if shell != gitBash || len(args) != 1 || args[0] != "-l" {
		t.Errorf("got %q %v, want git bash with -l", shell, args)
	}
}

func TestWindowsShellSkipsUnresolvableShell(t *testing.T) {
	getenv := func(k string) string {
		if k == "SHELL" {
			return "/bin/bash"
		}
		return ""
	}
	lookPath := func(name string) (string, error) {
		if name == "pwsh.exe" {
			return `C:\bin\pwsh.exe`, nil
		}
		return "", errors.New("not found")
	}
	if shell, args := windowsShell(getenv, lookPath); shell != `C:\bin\pwsh.exe` || len(args) != 1 || args[0] != "-NoLogo" {
		t.Errorf("got %q %v, want pwsh after a POSIX SHELL", shell, args)
	}
}

func TestWindowsShellFallbackOrder(t *testing.T) {
	getenv := func(k string) string {
		if k == "COMSPEC" {
			return `C:\Windows\System32\cmd.exe`
		}
		return ""
	}
	lookup := func(have ...string) func(string) (string, error) {
		return func(name string) (string, error) {
			for _, h := range have {
				if h == name {
					return `C:\bin\` + name, nil
				}
			}
			return "", errors.New("not found")
		}
	}

	if shell, args := windowsShell(getenv, lookup("pwsh.exe", "powershell.exe")); shell != `C:\bin\pwsh.exe` || len(args) != 1 || args[0] != "-NoLogo" {
		t.Errorf("pwsh preferred: got %q %v", shell, args)
	}
	if shell, _ := windowsShell(getenv, lookup("powershell.exe")); shell != `C:\bin\powershell.exe` {
		t.Errorf("powershell fallback: got %q", shell)
	}
	if shell, args := windowsShell(getenv, lookup()); shell != `C:\Windows\System32\cmd.exe` || args != nil {
		t.Errorf("comspec fallback: got %q %v", shell, args)
	}
}
