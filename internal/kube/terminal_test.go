package kube

import (
	"errors"
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

func TestWindowsShellPrefersExplicitShell(t *testing.T) {
	getenv := func(k string) string {
		if k == "SHELL" {
			return `C:\Program Files\Git\bin\bash.exe`
		}
		return ""
	}
	shell, args := windowsShell(getenv, func(string) (string, error) { return "", errors.New("unused") })
	if shell != `C:\Program Files\Git\bin\bash.exe` || len(args) != 1 || args[0] != "-l" {
		t.Errorf("got %q %v, want git bash with -l", shell, args)
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
