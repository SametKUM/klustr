package kube

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	constants "k8s.io/apimachinery/pkg/util/portforward"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/streaming/pkg/httpstream"
	httpstreamspdy "k8s.io/streaming/pkg/httpstream/spdy"
)

type pfTransportRequests struct {
	mu      sync.Mutex
	methods []string
}

func (requests *pfTransportRequests) wrap(next http.RoundTripper) http.RoundTripper {
	return pfTestTransport(func(req *http.Request) (*http.Response, error) {
		requests.mu.Lock()
		requests.methods = append(requests.methods, req.Method)
		requests.mu.Unlock()
		return next.RoundTrip(req)
	})
}

func (requests *pfTransportRequests) assertMethods(t *testing.T, want ...string) {
	t.Helper()
	requests.mu.Lock()
	defer requests.mu.Unlock()
	if !reflect.DeepEqual(requests.methods, want) {
		t.Errorf("transport request methods = %v, want %v", requests.methods, want)
	}
}

func failedPFTransport(t *testing.T, cfg *rest.Config) error {
	t.Helper()
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		t.Fatal(err)
	}
	mgr := newPFManager()
	t.Cleanup(mgr.stopAll)
	result := make(chan error, 1)
	go func() {
		_, err := mgr.start("ctx-a", "default", "pod", func(ctx context.Context, ready chan struct{}) (portForwarder, error) {
			return newPortForwarder(ctx, cs, cfg, "default", "pod", 0, 80, ready)
		})
		result <- err
	}()
	err = receivePFTest(t, result)
	if err == nil {
		t.Fatal("rejected transport unexpectedly became ready")
	}
	mgr.mu.Lock()
	defer mgr.mu.Unlock()
	if len(mgr.sessions) != 0 {
		t.Error("failed transport retained a pending session")
	}
	return err
}

func TestPortForwardTransportHTTPFailures(t *testing.T) {
	for _, code := range []int{http.StatusUnauthorized, http.StatusTooManyRequests, http.StatusInternalServerError, http.StatusServiceUnavailable} {
		for _, bodyType := range []string{"json", "plaintext"} {
			t.Run(fmt.Sprintf("%d/%s", code, bodyType), func(t *testing.T) {
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.Method == http.MethodGet && !websocket.IsWebSocketUpgrade(r) {
						t.Errorf("unexpected upgrade request: method=%s upgrade=%q", r.Method, r.Header.Get("Upgrade"))
					}
					if bodyType == "json" {
						w.Header().Set("Content-Type", "application/json")
						w.WriteHeader(code)
						_, _ = fmt.Fprintf(w, `{"kind":"Status","apiVersion":"v1","status":"Failure","message":"port-forward rejected","code":%d}`, code)
						return
					}
					http.Error(w, "port-forward rejected", code)
				}))
				t.Cleanup(server.Close)
				requests := &pfTransportRequests{}
				err := failedPFTransport(t, &rest.Config{Host: server.URL, WrapTransport: requests.wrap})
				if !strings.Contains(err.Error(), "port-forward rejected") {
					t.Errorf("rejection details were lost: %v", err)
				}
				if code == http.StatusUnauthorized {
					requests.assertMethods(t, http.MethodGet)
				} else {
					requests.assertMethods(t, http.MethodGet, http.MethodPost)
				}
			})
		}
	}
}

func TestPortForwardTransportBothProtocolsForbidden(t *testing.T) {
	for _, bodyType := range []string{"json", "plaintext"} {
		t.Run(bodyType, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.Method {
				case http.MethodGet:
					if !websocket.IsWebSocketUpgrade(r) {
						t.Error("GET did not request a WebSocket upgrade")
					}
				case http.MethodPost:
					if !strings.EqualFold(r.Header.Get("Upgrade"), httpstreamspdy.HeaderSpdy31) {
						t.Error("POST did not request a SPDY upgrade")
					}
				default:
					t.Errorf("unexpected request method: %s", r.Method)
				}
				message := "port-forward " + r.Method + " forbidden"
				if bodyType == "json" {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					_, _ = fmt.Fprintf(w, `{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"Forbidden","message":%q,"code":403}`, message)
					return
				}
				http.Error(w, message, http.StatusForbidden)
			}))
			t.Cleanup(server.Close)
			requests := &pfTransportRequests{}
			err := failedPFTransport(t, &rest.Config{Host: server.URL, WrapTransport: requests.wrap})
			if !strings.Contains(err.Error(), "port-forward POST forbidden") {
				t.Errorf("fallback authorization failure details were lost: %v", err)
			}
			requests.assertMethods(t, http.MethodGet, http.MethodPost)
		})
	}
}

func TestPortForwardTransportInvalidProtocolFallsBack(t *testing.T) {
	for _, protocol := range []string{"", "unsupported.portforward.protocol"} {
		t.Run(map[bool]string{true: "missing", false: "unsupported"}[protocol == ""], func(t *testing.T) {
			closed := make(chan struct{}, 2)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet {
					http.Error(w, "fallback protocol rejected", http.StatusBadRequest)
					return
				}
				upgrader := websocket.Upgrader{}
				headers := http.Header{}
				if protocol != "" {
					headers.Set("Sec-WebSocket-Protocol", protocol)
				}
				conn, err := upgrader.Upgrade(w, r, headers)
				if err != nil {
					t.Errorf("upgrade test connection: %v", err)
					return
				}
				defer conn.Close()
				_, _, _ = conn.ReadMessage()
				closed <- struct{}{}
			}))
			t.Cleanup(server.Close)
			requests := &pfTransportRequests{}
			err := failedPFTransport(t, &rest.Config{Host: server.URL, WrapTransport: requests.wrap})
			if !strings.Contains(err.Error(), "protocol") {
				t.Errorf("protocol rejection details were lost: %v", err)
			}
			receivePFTest(t, closed)
			requests.assertMethods(t, http.MethodGet, http.MethodPost)
		})
	}
}

func TestPortForwardTransportConnectionFailuresDoNotRetry(t *testing.T) {
	t.Run("untrusted TLS", func(t *testing.T) {
		server := httptest.NewUnstartedServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			t.Error("TLS validation failure reached the HTTP handler")
		}))
		server.Config.ErrorLog = log.New(io.Discard, "", 0)
		server.StartTLS()
		t.Cleanup(server.Close)
		requests := &pfTransportRequests{}
		err := failedPFTransport(t, &rest.Config{Host: server.URL, WrapTransport: requests.wrap})
		if !strings.Contains(err.Error(), "certificate") {
			t.Errorf("certificate failure details were lost: %v", err)
		}
		requests.assertMethods(t, http.MethodGet)
	})

	t.Run("unreachable endpoint", func(t *testing.T) {
		listener, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatal(err)
		}
		address := listener.Addr().String()
		if err := listener.Close(); err != nil {
			t.Fatal(err)
		}
		requests := &pfTransportRequests{}
		_ = failedPFTransport(t, &rest.Config{Host: "http://" + address, WrapTransport: requests.wrap})
		requests.assertMethods(t, http.MethodGet)
	})
}

func TestPortForwardTransportTunnelFailureDoesNotRetry(t *testing.T) {
	failTunnel := make(chan struct{})
	serverDone := make(chan struct{}, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { serverDone <- struct{}{} }()
		if r.Method != http.MethodGet {
			http.Error(w, "unexpected fallback", http.StatusBadRequest)
			return
		}
		upgrader := websocket.Upgrader{Subprotocols: []string{constants.WebsocketsSPDYTunnelingPrefix + portforward.PortForwardProtocolV1Name}}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade test connection: %v", err)
			return
		}
		defer conn.Close()
		stream, err := httpstreamspdy.NewServerConnection(portforward.NewTunnelingConnection("test", conn), func(httpstream.Stream, <-chan struct{}) error { return nil })
		if err != nil {
			t.Errorf("start SPDY tunnel: %v", err)
			return
		}
		defer stream.Close()
		select {
		case <-failTunnel:
		case <-stream.CloseChan():
		}
	}))
	t.Cleanup(server.Close)
	t.Cleanup(func() {
		select {
		case <-failTunnel:
		default:
			close(failTunnel)
		}
	})
	requests := &pfTransportRequests{}
	cfg := &rest.Config{Host: server.URL, WrapTransport: requests.wrap}
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		t.Fatal(err)
	}
	mgr := newPFManager()
	t.Cleanup(mgr.stopAll)
	changed := make(chan struct{}, 4)
	mgr.setOnChange(func() { changed <- struct{}{} })
	type startResult struct {
		info PortForwardInfo
		err  error
	}
	started := make(chan startResult, 1)
	go func() {
		info, err := mgr.start("ctx-a", "default", "pod", func(ctx context.Context, ready chan struct{}) (portForwarder, error) {
			return newPortForwarder(ctx, cs, cfg, "default", "pod", 0, 80, ready)
		})
		started <- startResult{info: info, err: err}
	}()
	result := receivePFTest(t, started)
	if result.err != nil {
		t.Fatal(result.err)
	}
	receivePFTest(t, changed)
	close(failTunnel)
	receivePFTest(t, serverDone)
	receivePFTest(t, changed)
	forwards := mgr.list()
	if len(forwards) != 1 || forwards[0].ID != result.info.ID || forwards[0].Status != "error" || forwards[0].Error == "" {
		t.Fatalf("tunnel failure was not retained for display: %+v", forwards)
	}
	local, err := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", fmt.Sprint(result.info.LocalPort)), time.Second)
	if err == nil {
		_ = local.Close()
		t.Error("failed tunnel retained its local listener")
	}
	requests.assertMethods(t, http.MethodGet)
	mgr.stop(result.info.ID)
	if forwards := mgr.list(); len(forwards) != 0 {
		t.Errorf("dismissed tunnel failure retained a session: %+v", forwards)
	}
}
