package kube

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
)

func isClosed(ch <-chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}

func (mgr *pfManager) addSessionForTest(id, contextName string) <-chan struct{} {
	ctx, cancel := context.WithCancel(context.Background())
	mgr.mu.Lock()
	mgr.sessions[id] = &pfSession{
		info:   PortForwardInfo{ID: id, Context: contextName, Status: "ready"},
		cancel: cancel,
	}
	mgr.mu.Unlock()
	return ctx.Done()
}

func TestStopForContextClosesOnlyMatchingSessions(t *testing.T) {
	mgr := newPFManager()
	var notified int
	mgr.setOnChange(func() { notified++ })

	a1 := mgr.addSessionForTest("pf-1", "ctx-a")
	a2 := mgr.addSessionForTest("pf-2", "ctx-a")
	b1 := mgr.addSessionForTest("pf-3", "ctx-b")

	mgr.stopForContext("ctx-a")

	if !isClosed(a1) || !isClosed(a2) {
		t.Fatalf("expected ctx-a stop channels to be closed")
	}
	if isClosed(b1) {
		t.Fatalf("expected ctx-b stop channel to stay open")
	}
	if got := mgr.list(); len(got) != 1 || got[0].Context != "ctx-b" {
		t.Fatalf("expected only the ctx-b session to remain, got %+v", got)
	}
	if notified != 1 {
		t.Fatalf("expected exactly one change notification, got %d", notified)
	}
}

func TestStopForContextNoMatchDoesNotNotify(t *testing.T) {
	mgr := newPFManager()
	var notified int
	mgr.setOnChange(func() { notified++ })
	mgr.addSessionForTest("pf-1", "ctx-a")

	mgr.stopForContext("ctx-missing")

	if notified != 0 {
		t.Fatalf("expected no notification when nothing matched, got %d", notified)
	}
	if got := mgr.list(); len(got) != 1 {
		t.Fatalf("expected the unmatched session to remain, got %+v", got)
	}
}

type fakePortForwarder struct {
	run   func() error
	ports func() ([]portforward.ForwardedPort, error)
}

func (f *fakePortForwarder) ForwardPorts() error { return f.run() }
func (f *fakePortForwarder) GetPorts() ([]portforward.ForwardedPort, error) {
	return f.ports()
}

func receivePFTest[T any](t *testing.T, ch <-chan T) T {
	t.Helper()
	select {
	case value := <-ch:
		return value
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for port-forward test")
		var zero T
		return zero
	}
}

func TestPortForwardStopCancelsPendingSetup(t *testing.T) {
	for _, stopAll := range []bool{false, true} {
		t.Run(map[bool]string{false: "disconnect", true: "shutdown"}[stopAll], func(t *testing.T) {
			mgr := newPFManager()
			t.Cleanup(mgr.stopAll)
			other := mgr.addSessionForTest("other", "ctx-b")
			entered := make(chan struct{})
			result := make(chan error, 1)
			go func() {
				_, err := mgr.start("ctx-a", "default", "pod", func(ctx context.Context, _ chan struct{}) (portForwarder, error) {
					close(entered)
					<-ctx.Done()
					return nil, ctx.Err()
				})
				result <- err
			}()
			receivePFTest(t, entered)
			if got := mgr.list(); len(got) != 1 || got[0].ID != "other" {
				t.Fatalf("pending setup was listed as an active forward: %+v", got)
			}
			if stopAll {
				mgr.stopAll()
			} else {
				mgr.stopForContext("ctx-a")
			}
			if err := receivePFTest(t, result); !errors.Is(err, context.Canceled) {
				t.Fatalf("start error = %v, want cancellation", err)
			}
			if isClosed(other) != stopAll {
				t.Fatal("unexpected cancellation of the other context")
			}
		})
	}
}

func TestPortForwardDisconnectRejectsLateReadiness(t *testing.T) {
	mgr := newPFManager()
	t.Cleanup(mgr.stopAll)
	readingPorts := make(chan struct{})
	release := make(chan struct{})
	result := make(chan error, 1)
	exited := make(chan struct{})
	go func() {
		_, err := mgr.start("ctx-a", "default", "pod", func(ctx context.Context, ready chan struct{}) (portForwarder, error) {
			return &fakePortForwarder{
				run: func() error {
					defer close(exited)
					close(ready)
					<-ctx.Done()
					return nil
				},
				ports: func() ([]portforward.ForwardedPort, error) {
					close(readingPorts)
					<-release
					return []portforward.ForwardedPort{{Local: 30800, Remote: 80}}, nil
				},
			}, nil
		})
		result <- err
	}()
	receivePFTest(t, readingPorts)
	mgr.stopForContext("ctx-a")
	close(release)
	if err := receivePFTest(t, result); !errors.Is(err, context.Canceled) {
		t.Fatalf("late start error = %v, want cancellation", err)
	}
	receivePFTest(t, exited)
	if got := mgr.list(); len(got) != 0 {
		t.Fatalf("late readiness resurrected the canceled session: %+v", got)
	}
}

type pfTestTransport func(*http.Request) (*http.Response, error)

func (f pfTestTransport) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestPortForwardDisconnectCancelsHandshake(t *testing.T) {
	mgr := newPFManager()
	t.Cleanup(mgr.stopAll)
	entered := make(chan struct{})
	exited := make(chan struct{})
	cfg := &rest.Config{
		Host: "https://portforward.example.invalid",
		WrapTransport: func(http.RoundTripper) http.RoundTripper {
			return pfTestTransport(func(req *http.Request) (*http.Response, error) {
				defer close(exited)
				close(entered)
				<-req.Context().Done()
				return nil, req.Context().Err()
			})
		},
	}
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		t.Fatal(err)
	}
	result := make(chan error, 1)
	go func() {
		_, err := mgr.start("ctx-a", "default", "pod", func(ctx context.Context, ready chan struct{}) (portForwarder, error) {
			return newPortForwarder(ctx, cs, cfg, "default", "pod", 0, 80, ready)
		})
		result <- err
	}()
	receivePFTest(t, entered)
	mgr.stopForContext("ctx-a")
	if err := receivePFTest(t, result); err == nil {
		t.Fatal("canceled handshake reported success")
	}
	receivePFTest(t, exited)
	if got := mgr.list(); len(got) != 0 {
		t.Fatalf("canceled handshake retained a session: %+v", got)
	}
}

func TestPortForwardStartReportsPortsAndRetainsRuntimeErrors(t *testing.T) {
	mgr := newPFManager()
	t.Cleanup(mgr.stopAll)
	changed := make(chan struct{}, 3)
	mgr.setOnChange(func() { changed <- struct{}{} })
	finish := make(chan error, 1)
	wantErr := errors.New("connection lost")
	info, err := mgr.start("ctx-a", "default", "pod", func(ctx context.Context, ready chan struct{}) (portForwarder, error) {
		return &fakePortForwarder{
			run: func() error {
				close(ready)
				select {
				case err := <-finish:
					return err
				case <-ctx.Done():
					return nil
				}
			},
			ports: func() ([]portforward.ForwardedPort, error) {
				return []portforward.ForwardedPort{{Local: 30800, Remote: 80}}, nil
			},
		}, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if info.LocalPort != 30800 || info.RemotePort != 80 || info.Status != "ready" {
		t.Fatalf("unexpected forward: %+v", info)
	}
	receivePFTest(t, changed)
	finish <- wantErr
	receivePFTest(t, changed)
	if got := mgr.list(); len(got) != 1 || got[0].Status != "error" || got[0].Error != wantErr.Error() {
		t.Fatalf("runtime failure was not retained: %+v", got)
	}
	mgr.stop(info.ID)
	if got := mgr.list(); len(got) != 0 {
		t.Fatalf("dismissed failure is still listed: %+v", got)
	}
}

func TestPortForwardFailedStartRemovesPendingSession(t *testing.T) {
	for _, stage := range []string{"build", "connect", "ports"} {
		t.Run(stage, func(t *testing.T) {
			mgr := newPFManager()
			t.Cleanup(mgr.stopAll)
			wantErr := errors.New("start failed")
			var sessionCtx context.Context
			_, err := mgr.start("ctx-a", "default", "pod", func(ctx context.Context, ready chan struct{}) (portForwarder, error) {
				sessionCtx = ctx
				if stage == "build" {
					return nil, wantErr
				}
				return &fakePortForwarder{
					run: func() error {
						if stage == "connect" {
							return wantErr
						}
						close(ready)
						<-ctx.Done()
						return nil
					},
					ports: func() ([]portforward.ForwardedPort, error) { return nil, wantErr },
				}, nil
			})
			if !errors.Is(err, wantErr) {
				t.Fatalf("start error = %v, want %v", err, wantErr)
			}
			if !errors.Is(sessionCtx.Err(), context.Canceled) {
				t.Fatal("failed start did not cancel the session")
			}
			mgr.mu.Lock()
			defer mgr.mu.Unlock()
			if len(mgr.sessions) != 0 {
				t.Fatal("failed start retained a pending session")
			}
		})
	}
}
