//go:build windows

package kube

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"testing"
	"time"
)

// kubectlStubOut turns the test binary into a kubectl stand-in: the launch
// tests put a copy on PATH as kubectl.exe, and it writes what it was handed
// to the file this variable names.
const kubectlStubOut = "KLUSTR_TEST_KUBECTL_OUT"

type kubectlStubRecord struct {
	Args       []string
	Kubeconfig string
	Dir        string
	// Locked reports that deleting the kubeconfig failed while kubectl ran.
	Locked bool
}

func TestMain(m *testing.M) {
	if out := os.Getenv(kubectlStubOut); out != "" {
		os.Exit(runKubectlStub(out))
	}
	code := m.Run()
	if kubectlStub.dir != "" {
		_ = os.RemoveAll(kubectlStub.dir)
	}
	os.Exit(code)
}

var kubectlStub struct {
	once sync.Once
	dir  string
	err  error
}

// kubectlStubDir returns a directory holding a copy of the test binary as
// kubectl.exe. A copy, not a link: no name of a running executable can be
// deleted, which would fail the TempDir cleanup.
func kubectlStubDir(t *testing.T) string {
	t.Helper()
	kubectlStub.once.Do(func() {
		kubectlStub.dir, kubectlStub.err = os.MkdirTemp("", "klustr-kubectl-stub-*")
		if kubectlStub.err == nil {
			kubectlStub.err = copyTestBinary(filepath.Join(kubectlStub.dir, "kubectl.exe"))
		}
	})
	if kubectlStub.err != nil {
		t.Fatal(kubectlStub.err)
	}
	return kubectlStub.dir
}

func copyTestBinary(dst string) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	in, err := os.Open(self)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		_ = out.Close()
		return err
	}
	return out.Close()
}

func runKubectlStub(out string) int {
	dir, _ := os.Getwd()
	data, err := json.Marshal(kubectlStubRecord{
		Args:       os.Args[1:],
		Kubeconfig: os.Getenv("KUBECONFIG"),
		Dir:        dir,
		Locked:     os.Remove(os.Getenv("KLUSTR_KUBECONFIG")) != nil,
	})
	if err != nil {
		return 1
	}
	if err := os.WriteFile(out, data, 0o600); err != nil {
		return 1
	}
	return 0
}

type launchFixture struct {
	dir, kubeconfig, out, path string
}

func newLaunchFixture(t *testing.T) launchFixture {
	t.Helper()
	bin := kubectlStubDir(t)
	dir := t.TempDir()
	kubeconfig := filepath.Join(dir, "klustr-kubeconfig-1.yaml")
	if err := os.WriteFile(kubeconfig, []byte("apiVersion: v1\nkind: Config\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	return launchFixture{
		dir:        dir,
		kubeconfig: kubeconfig,
		out:        filepath.Join(dir, "kubectl.json"),
		path:       bin + string(os.PathListSeparator) + os.Getenv("PATH"),
	}
}

// run starts command the way launchWindowsConsole does, minus -NoExit, and
// returns what the kubectl stand-in saw.
func (f launchFixture) run(t *testing.T, command string, env []string) kubectlStubRecord {
	t.Helper()
	shell, err := windowsPowerShellPath()
	if err != nil {
		t.Skip(err)
	}
	env = append(env, "PATH="+f.path, kubectlStubOut+"="+f.out)
	exited := make(chan struct{})
	if err := startInNewConsole(windowsLaunchArgv(shell, command, false), env, f.dir, func() { close(exited) }); err != nil {
		t.Fatalf("startInNewConsole: %v", err)
	}
	select {
	case <-exited:
	case <-time.After(2 * time.Minute):
		t.Fatal("launch command did not exit")
	}
	data, err := os.ReadFile(f.out)
	if err != nil {
		t.Fatalf("kubectl stand-in never ran: %v", err)
	}
	var rec kubectlStubRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		t.Fatal(err)
	}
	return rec
}

func (f launchFixture) check(t *testing.T, rec kubectlStubRecord) {
	t.Helper()
	if rec.Kubeconfig != f.kubeconfig {
		t.Errorf("kubectl KUBECONFIG = %q, want %q", rec.Kubeconfig, f.kubeconfig)
	}
	if !rec.Locked {
		t.Error("kubeconfig could be deleted while kubectl ran")
	}
	got, errGot := os.Stat(rec.Dir)
	want, errWant := os.Stat(f.dir)
	if errGot != nil || errWant != nil || !os.SameFile(got, want) {
		t.Errorf("kubectl ran in %q, want %q", rec.Dir, f.dir)
	}
	if _, err := os.Stat(f.kubeconfig); !os.IsNotExist(err) {
		t.Errorf("kubeconfig left behind (stat err %v)", err)
	}
}

// The KUBECONFIG appended after the launch env stands in for a profile that
// sets its own: the commands run after the profile and restore klustr's.
const profileKubeconfig = `KUBECONFIG=C:\profile\config`

func TestNewConsoleRunsWindowsExecCommand(t *testing.T) {
	for _, c := range []struct {
		name, container string
		want            []string
	}{
		{"container", "app", []string{"exec", "-it", "-n", "team-a", "-c", "app", "web-0", "--", "/bin/sh"}},
		{"no container", "", []string{"exec", "-it", "-n", "team-a", "web-0", "--", "/bin/sh"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			f := newLaunchFixture(t)
			env := windowsExecEnv(os.Environ(), f.kubeconfig, "ctx", "team-a", "web-0", c.container, "/bin/sh")
			rec := f.run(t, windowsExecCommand, append(env, profileKubeconfig))
			if !slices.Equal(rec.Args, c.want) {
				t.Errorf("kubectl args = %q, want %q", rec.Args, c.want)
			}
			f.check(t, rec)
		})
	}
}

func TestNewConsoleRunsWindowsShellCommand(t *testing.T) {
	f := newLaunchFixture(t)
	env := windowsLaunchEnv(os.Environ(), f.kubeconfig, "ctx")
	// What a user might type at the prompt, then `exit`, which runs the
	// Exiting handler that deletes the kubeconfig.
	rec := f.run(t, windowsShellCommand+"; kubectl version; exit", append(env, profileKubeconfig))
	if want := []string{"version"}; !slices.Equal(rec.Args, want) {
		t.Errorf("kubectl args = %q, want %q", rec.Args, want)
	}
	f.check(t, rec)
}
