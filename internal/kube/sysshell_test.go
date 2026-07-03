package kube

import (
	"os"
	"strings"
	"testing"
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
	if !strings.Contains(script, `KLUSTR_CONTEXT='`+evil+`'`) {
		t.Fatalf("context name not single-quoted:\n%s", script)
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
	if !strings.Contains(script, `KLUSTR_CONTEXT='`+evil+`'`) {
		t.Fatalf("context name not single-quoted:\n%s", script)
	}
}
