package kube

import (
	"context"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	pfconstants "k8s.io/apimachinery/pkg/util/portforward"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/streaming/pkg/httpstream"
	httpstreamspdy "k8s.io/streaming/pkg/httpstream/spdy"
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

func TestPortForwardCancelClosesBlockedUpgrade(t *testing.T) {
	for _, stage := range []string{"headers", "error body", "proxy CONNECT"} {
		t.Run(stage, func(t *testing.T) {
			entered := make(chan struct{})
			exited := make(chan struct{})
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				defer close(exited)
				if stage == "proxy CONNECT" && r.Method != http.MethodConnect {
					t.Errorf("proxy method = %s, want CONNECT", r.Method)
				}
				if stage == "error body" {
					w.WriteHeader(http.StatusForbidden)
					w.(http.Flusher).Flush()
				}
				close(entered)
				<-r.Context().Done()
			}))
			t.Cleanup(server.Close)
			t.Cleanup(server.CloseClientConnections)
			cfg := &rest.Config{Host: server.URL}
			if stage == "proxy CONNECT" {
				proxyURL, err := url.Parse(server.URL)
				if err != nil {
					t.Fatal(err)
				}
				cfg.Host = "https://portforward.example.invalid"
				cfg.Proxy = http.ProxyURL(proxyURL)
			}
			cs, err := kubernetes.NewForConfig(cfg)
			if err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			forwarder, err := newPortForwarder(ctx, cs, cfg, "default", "pod", 0, 80, make(chan struct{}))
			if err != nil {
				t.Fatal(err)
			}
			result := make(chan error, 1)
			go func() { result <- forwarder.ForwardPorts() }()
			receivePFTest(t, entered)
			cancel()
			if err := receivePFTest(t, result); err == nil {
				t.Fatal("canceled upgrade returned success")
			}
			receivePFTest(t, exited)
		})
	}
}

func TestPortForwardUpgradePreservesTLSAuthAndSessionLifetime(t *testing.T) {
	for _, status := range []int{0, http.StatusOK, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusBadRequest, http.StatusForbidden, http.StatusNotFound, http.StatusMethodNotAllowed, http.StatusUpgradeRequired, http.StatusNotImplemented} {
		name := "websocket"
		if status != 0 {
			name = fmt.Sprintf("spdy_after_%d", status)
		}
		t.Run(name, func(t *testing.T) {
			testPortForwardUpgrade(t, status)
		})
	}
}

func testPortForwardUpgrade(t *testing.T, websocketStatus int) {
	t.Helper()
	closed := make(chan struct{})
	requests := make(chan string, 2)
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests <- r.Method
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Error("upgrade lost authentication")
		}
		if r.Header.Get("Impersonate-User") != "test-user" || r.Header.Get("Impersonate-Group") != "test-group" {
			t.Error("upgrade lost impersonation")
		}
		if r.Header.Get("User-Agent") != "klustr-transport-test" || r.Header.Get("X-Klustr-Test") != "wrapped" {
			t.Error("upgrade lost config wrappers")
		}
		if r.URL.Path != "/api/v1/namespaces/default/pods/pod/portforward" {
			t.Errorf("unexpected upgrade path: %s", r.URL.Path)
		}
		if r.Method == http.MethodGet && websocketStatus != 0 {
			http.Error(w, "websocket upgrade unavailable", websocketStatus)
			return
		}
		handler := func(stream httpstream.Stream, replySent <-chan struct{}) error {
			go func() {
				defer stream.Close()
				<-replySent
				if stream.Headers().Get(corev1.StreamType) == corev1.StreamTypeData {
					_, _ = io.Copy(stream, stream)
				}
			}()
			return nil
		}
		var conn httpstream.Connection
		if websocketStatus == 0 {
			if r.Method != http.MethodGet {
				t.Errorf("websocket method = %s, want GET", r.Method)
			}
			protocol := pfconstants.WebsocketsSPDYTunnelingPrefix + portforward.PortForwardProtocolV1Name
			if !slices.Contains(websocket.Subprotocols(r), protocol) {
				t.Errorf("missing websocket tunnel protocol: %v", websocket.Subprotocols(r))
			}
			upgrader := websocket.Upgrader{Subprotocols: []string{protocol}}
			ws, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				t.Error(err)
				close(closed)
				return
			}
			conn, err = httpstreamspdy.NewServerConnection(portforward.NewTunnelingConnection("test", ws), handler)
			if err != nil {
				t.Error(err)
				_ = ws.Close()
			}
		} else {
			if r.Method != http.MethodPost {
				t.Errorf("SPDY method = %s, want POST", r.Method)
			}
			w.Header().Set(httpstream.HeaderProtocolVersion, portforward.PortForwardProtocolV1Name)
			conn = httpstreamspdy.NewResponseUpgrader().UpgradeResponse(w, r, handler)
		}
		if conn == nil {
			close(closed)
			return
		}
		defer conn.Close()
		<-conn.CloseChan()
		close(closed)
	}))
	t.Cleanup(server.Close)
	var dials atomic.Int32
	cfg := &rest.Config{
		Host: server.URL, BearerToken: "test-token", UserAgent: "klustr-transport-test",
		Timeout:     time.Nanosecond,
		Impersonate: rest.ImpersonationConfig{UserName: "test-user", Groups: []string{"test-group"}},
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			dials.Add(1)
			return (&net.Dialer{}).DialContext(ctx, network, address)
		},
		WrapTransport: func(rt http.RoundTripper) http.RoundTripper {
			return pfTestTransport(func(req *http.Request) (*http.Response, error) {
				req = req.Clone(req.Context())
				req.Header.Set("X-Klustr-Test", "wrapped")
				return rt.RoundTrip(req)
			})
		},
	}
	cfg.NextProtos = []string{"h2", "http/1.1"}
	cfg.CAData = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw})
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	ready := make(chan struct{})
	forwarder, err := newPortForwarder(ctx, cs, cfg, "default", "pod", 0, 80, ready)
	if err != nil {
		t.Fatal(err)
	}
	result := make(chan error, 1)
	go func() { result <- forwarder.ForwardPorts() }()
	receivePFTest(t, ready)
	ports, err := forwarder.GetPorts()
	if err != nil || len(ports) != 1 || ports[0].Local == 0 {
		t.Fatalf("forward not listening: ports=%v err=%v", ports, err)
	}
	if isClosed(closed) {
		t.Fatal("successful upgrade closed the session")
	}
	local, err := net.DialTimeout("tcp", net.JoinHostPort("localhost", fmt.Sprint(ports[0].Local)), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer local.Close()
	if err := local.SetDeadline(time.Now().Add(3 * time.Second)); err != nil {
		t.Fatal(err)
	}
	if _, err := io.WriteString(local, "ping"); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 4)
	if _, err := io.ReadFull(local, buf); err != nil || string(buf) != "ping" {
		t.Fatalf("forwarded stream returned %q, err=%v", buf, err)
	}
	if method := receivePFTest(t, requests); method != http.MethodGet {
		t.Fatalf("first upgrade = %s, want GET", method)
	}
	if websocketStatus != 0 {
		if method := receivePFTest(t, requests); method != http.MethodPost {
			t.Fatalf("fallback upgrade = %s, want POST", method)
		}
	}
	if len(requests) != 0 {
		t.Fatal("unexpected additional upgrade attempt")
	}
	if dials.Load() == 0 {
		t.Fatal("upgrade ignored the configured dialer")
	}
	if cfg.Timeout != time.Nanosecond || !slices.Equal(cfg.NextProtos, []string{"h2", "http/1.1"}) {
		t.Fatal("upgrade mutated the shared REST config")
	}
	cancel()
	if err := receivePFTest(t, result); err != nil {
		t.Fatalf("stopping ready forward: %v", err)
	}
	receivePFTest(t, closed)
	if conn, err := net.DialTimeout("tcp", net.JoinHostPort("localhost", fmt.Sprint(ports[0].Local)), time.Second); err == nil {
		_ = conn.Close()
		t.Fatal("stopped port-forward retained its listener")
	}
}

func TestPortForwardReadyTimeoutCancelsWorker(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		mgr := newPFManager()
		defer mgr.stopAll()
		exited := make(chan struct{})
		_, err := mgr.start("ctx-a", "default", "pod", func(ctx context.Context, _ chan struct{}) (portForwarder, error) {
			return &fakePortForwarder{run: func() error {
				defer close(exited)
				<-ctx.Done()
				return ctx.Err()
			}}, nil
		})
		if err == nil || !strings.Contains(err.Error(), "timed out") {
			t.Fatalf("start returned %v, want readiness timeout", err)
		}
		synctest.Wait()
		if !isClosed(exited) {
			t.Fatal("timed-out worker was not canceled")
		}
		mgr.mu.Lock()
		defer mgr.mu.Unlock()
		if len(mgr.sessions) != 0 {
			t.Fatal("timed-out session remains registered")
		}
	})
}
