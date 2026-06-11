package kube

import (
	"strings"
	"testing"
)

func TestParseShellEnv(t *testing.T) {
	sentinel := "_KLUSTR_ENV_abc_"

	t.Run("extracts pairs between sentinels", func(t *testing.T) {
		out := strings.Join([]string{
			"motd noise",
			sentinel,
			"PATH=/opt/homebrew/bin:/usr/bin",
			"AWS_VAULT_BACKEND=keychain",
			sentinel,
			"trailing noise",
		}, "\n")
		env, err := parseShellEnv(out, sentinel)
		if err != nil {
			t.Fatalf("parseShellEnv: %v", err)
		}
		if env["PATH"] != "/opt/homebrew/bin:/usr/bin" {
			t.Errorf("PATH = %q", env["PATH"])
		}
		if env["AWS_VAULT_BACKEND"] != "keychain" {
			t.Errorf("AWS_VAULT_BACKEND = %q", env["AWS_VAULT_BACKEND"])
		}
	})

	t.Run("drops multi-line value continuations and garbage", func(t *testing.T) {
		out := strings.Join([]string{
			sentinel,
			"MULTI=first line",
			"  second line of MULTI",
			"-> not an assignment",
			"9KEY=starts with digit",
			"VALID=ok",
			sentinel,
		}, "\n")
		env, err := parseShellEnv(out, sentinel)
		if err != nil {
			t.Fatalf("parseShellEnv: %v", err)
		}
		if env["VALID"] != "ok" {
			t.Errorf("VALID = %q", env["VALID"])
		}
		if _, ok := env["9KEY"]; ok {
			t.Error("9KEY should be dropped")
		}
		if len(env) != 2 {
			t.Errorf("env has %d keys, want 2 (MULTI first line + VALID): %v", len(env), env)
		}
	})

	t.Run("later duplicate wins", func(t *testing.T) {
		out := sentinel + "\nA=1\nA=2\n" + sentinel
		env, err := parseShellEnv(out, sentinel)
		if err != nil {
			t.Fatalf("parseShellEnv: %v", err)
		}
		if env["A"] != "2" {
			t.Errorf("A = %q, want 2", env["A"])
		}
	})

	t.Run("missing sentinel errors", func(t *testing.T) {
		if _, err := parseShellEnv("PATH=/usr/bin", sentinel); err == nil {
			t.Error("expected error for missing sentinel")
		}
	})

	t.Run("single sentinel errors", func(t *testing.T) {
		if _, err := parseShellEnv(sentinel+"\nPATH=/usr/bin", sentinel); err == nil {
			t.Error("expected error for single sentinel")
		}
	})

	t.Run("empty section errors", func(t *testing.T) {
		if _, err := parseShellEnv(sentinel+"\n\n"+sentinel, sentinel); err == nil {
			t.Error("expected error for empty dump")
		}
	})

	t.Run("value containing equals sign", func(t *testing.T) {
		out := sentinel + "\nLESS=-R -F=x\n" + sentinel
		env, err := parseShellEnv(out, sentinel)
		if err != nil {
			t.Fatalf("parseShellEnv: %v", err)
		}
		if env["LESS"] != "-R -F=x" {
			t.Errorf("LESS = %q", env["LESS"])
		}
	})
}

func TestMergePathLists(t *testing.T) {
	got := mergePathLists(
		"/opt/homebrew/bin:/usr/bin:/bin",
		"/usr/local/bin:/usr/bin:/sbin",
	)
	want := "/opt/homebrew/bin:/usr/bin:/bin:/usr/local/bin:/sbin"
	if got != want {
		t.Errorf("mergePathLists = %q, want %q", got, want)
	}
}

func TestShellEnvArgs(t *testing.T) {
	if got := shellEnvArgs("/bin/zsh", "x"); got[0] != "-i" || got[1] != "-l" {
		t.Errorf("zsh args = %v", got)
	}
	if got := shellEnvArgs("/usr/bin/fish", "x"); got[0] != "-i" {
		t.Errorf("fish args = %v", got)
	}
	if got := shellEnvArgs("/bin/dash", "x"); got[0] != "-l" {
		t.Errorf("dash should not get -i: %v", got)
	}
}
