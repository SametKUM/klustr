package kube

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	streamprotocol "k8s.io/apimachinery/pkg/util/remotecommand"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
	utilexec "k8s.io/client-go/util/exec"
	"k8s.io/streaming/pkg/httpstream"
	"k8s.io/streaming/pkg/httpstream/spdy"
	"k8s.io/streaming/pkg/httpstream/wsstream"
)

func TestExecSessionStreams(t *testing.T) {
	for _, protocol := range []string{"websocket", "spdy", "spdy-create-only", "spdy-proxy-200", "spdy-proxy-502", "spdy-proxy-503", "spdy-missing-protocol"} {
		for _, exitCode := range []int{0, 23} {
			t.Run(fmt.Sprintf("%s/exit-%d", protocol, exitCode), func(t *testing.T) {
				const input = "printf hello\r"
				const output = "hello\r\nterminal output: λ"
				var requests atomic.Int32
				serverDone := make(chan struct{})
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					requests.Add(1)
					assertExecRequest(t, r, []string{"/bin/sh"})
					if protocol != "websocket" && r.Method == http.MethodGet {
						if protocol == "spdy-missing-protocol" {
							conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
							if err != nil {
								t.Error(err)
								return
							}
							defer conn.Close()
							_, _, _ = conn.ReadMessage()
							return
						}
						if status := map[string]int{"spdy-proxy-200": 200, "spdy-proxy-502": 502, "spdy-proxy-503": 503}[protocol]; status != 0 {
							http.Error(w, "proxy rejected upgrade", status)
							return
						}
						if protocol == "spdy-create-only" {
							w.Header().Set("Content-Type", "application/json")
							w.WriteHeader(http.StatusForbidden)
							_ = json.NewEncoder(w).Encode(metav1.Status{
								TypeMeta: metav1.TypeMeta{Kind: "Status", APIVersion: "v1"},
								Status:   metav1.StatusFailure, Reason: metav1.StatusReasonForbidden,
								Code: http.StatusForbidden, Message: "get is forbidden; create is permitted",
							})
							return
						}
						http.Error(w, "websocket upgrade is unsupported", http.StatusBadRequest)
						return
					}
					defer close(serverDone)
					streams := openExecTestStreams(t, w, r, protocol)
					if streams == nil {
						return
					}
					defer streams.close()
					got := make([]byte, len(input))
					stdinDone := make(chan error, 1)
					go func() {
						_, err := io.ReadFull(streams.stdin, got)
						stdinDone <- err
					}()
					var size remotecommand.TerminalSize
					if err := json.NewDecoder(streams.resize).Decode(&size); err != nil {
						t.Errorf("resize: %v", err)
						return
					}
					if size.Width != 132 || size.Height != 43 {
						t.Errorf("resize = %+v", size)
					}
					if err := <-stdinDone; err != nil || string(got) != input {
						t.Errorf("stdin = %q, error = %v", got, err)
						return
					}
					for _, data := range []string{output[:len(output)-1], output[len(output)-1:]} {
						if _, err := io.WriteString(streams.stdout, data); err != nil {
							t.Errorf("stdout: %v", err)
							return
						}
					}
					status := metav1.Status{Status: metav1.StatusSuccess}
					if exitCode != 0 {
						status = metav1.Status{
							Status: metav1.StatusFailure,
							Reason: streamprotocol.NonZeroExitCodeReason,
							Details: &metav1.StatusDetails{Causes: []metav1.StatusCause{{
								Type: streamprotocol.ExitCodeCauseType, Message: fmt.Sprint(exitCode),
							}}},
						}
					}
					if err := json.NewEncoder(streams.status).Encode(status); err != nil {
						t.Errorf("exit status: %v", err)
					}
				}))
				t.Cleanup(server.Close)
				cfg, cs := execTestClient(t, server.URL)
				mgr := newExecSessionManager()
				t.Cleanup(mgr.stopAll)
				var mu sync.Mutex
				var gotOutput bytes.Buffer
				closed := false
				var closes atomic.Int32
				closeResult := make(chan error, 1)
				id, err := mgr.start(t.Context(), cfg, cs, "test-context", "test-ns", "test-pod", "test-container", nil,
					func(data string) {
						mu.Lock()
						defer mu.Unlock()
						if closed {
							t.Error("output arrived after close callback")
						}
						gotOutput.WriteString(data)
					}, func(err error) {
						mu.Lock()
						closed = true
						mu.Unlock()
						closes.Add(1)
						closeResult <- err
					})
				if err != nil {
					t.Fatal(err)
				}
				mgr.mu.Lock()
				session := mgr.sessions[id]
				mgr.mu.Unlock()
				inputDone := make(chan struct{})
				go func() {
					mgr.sendInput(id, input)
					close(inputDone)
				}()
				mgr.resize(id, 132, 43)
				err = receiveExecTest(t, closeResult)
				if exitCode == 0 && err != nil {
					t.Fatalf("exec: %v", err)
				}
				if exitCode != 0 {
					var exitErr utilexec.ExitError
					if !errors.As(err, &exitErr) || exitErr.ExitStatus() != exitCode {
						t.Fatalf("exit error = %v, want status %d", err, exitCode)
					}
				}
				receiveExecTest(t, inputDone)
				receiveExecTest(t, serverDone)
				assertExecSessionRemoved(t, mgr, id, session)
				mu.Lock()
				if gotOutput.String() != output {
					t.Errorf("output = %q, want %q", gotOutput.String(), output)
				}
				mu.Unlock()
				wantRequests := int32(1)
				if protocol != "websocket" {
					wantRequests = 2
				}
				if requests.Load() != wantRequests || closes.Load() != 1 {
					t.Errorf("requests = %d, closes = %d; want %d, 1", requests.Load(), closes.Load(), wantRequests)
				}
			})
		}
	}
}

func TestExecSessionHandshakeErrors(t *testing.T) {
	for _, test := range []struct {
		name      string
		code      int
		reason    metav1.StatusReason
		plain     bool
		wantCalls int32
	}{
		{name: "unauthorized", code: http.StatusUnauthorized, reason: metav1.StatusReasonUnauthorized, wantCalls: 1},
		{name: "forbidden-both-transports", code: http.StatusForbidden, reason: metav1.StatusReasonForbidden, wantCalls: 2},
		{name: "plain-forbidden-both-transports", code: http.StatusForbidden, plain: true, wantCalls: 2},
		{name: "not-found", code: http.StatusNotFound, reason: metav1.StatusReasonNotFound, wantCalls: 1},
		{name: "unsupported-upgrade", code: http.StatusBadRequest, plain: true, wantCalls: 2},
	} {
		t.Run(test.name, func(t *testing.T) {
			var calls atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				assertExecRequest(t, r, []string{"/bin/bash", "-lc", "printf hello"})
				message := "request rejected by " + r.Method
				if test.plain {
					http.Error(w, message, test.code)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(test.code)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{Kind: "Status", APIVersion: "v1"},
					Status:   metav1.StatusFailure, Reason: test.reason, Code: int32(test.code), Message: message,
				})
			}))
			t.Cleanup(server.Close)
			cfg, cs := execTestClient(t, server.URL)
			mgr := newExecSessionManager()
			t.Cleanup(mgr.stopAll)
			closeResult := make(chan error, 2)
			id, err := mgr.start(t.Context(), cfg, cs, "test-context", "test-ns", "test-pod", "test-container",
				[]string{"/bin/bash", "-lc", "printf hello"}, func(string) {}, func(err error) { closeResult <- err })
			if err != nil {
				t.Fatal(err)
			}
			err = receiveExecTest(t, closeResult)
			if err == nil {
				t.Fatal("expected a handshake error")
			}
			wantMethod := http.MethodGet
			if test.wantCalls == 2 {
				wantMethod = http.MethodPost
			}
			if !strings.Contains(err.Error(), "request rejected by "+wantMethod) {
				t.Errorf("handshake error = %v, want the %s rejection", err, wantMethod)
			}
			assertExecSessionRemoved(t, mgr, id, nil)
			if calls.Load() != test.wantCalls {
				t.Errorf("requests = %d, want %d", calls.Load(), test.wantCalls)
			}
			mgr.stop(id)
			select {
			case <-closeResult:
				t.Error("close callback repeated")
			default:
			}
		})
	}
}

func TestExecSessionCancellation(t *testing.T) {
	for _, protocol := range []string{"websocket", "spdy"} {
		for _, stopMethod := range []string{"stop", "parent", "context", "all"} {
			t.Run(protocol+"/"+stopMethod, func(t *testing.T) {
				opened := make(chan struct{})
				serverDone := make(chan struct{})
				var requests atomic.Int32
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					requests.Add(1)
					if protocol == "spdy" && r.Method == http.MethodGet {
						http.Error(w, "websocket upgrade is unsupported", http.StatusBadRequest)
						return
					}
					defer close(serverDone)
					streams := openExecTestStreams(t, w, r, protocol)
					if streams == nil {
						return
					}
					defer streams.close()
					close(opened)
					resizeDone := make(chan struct{})
					go func() {
						_, _ = io.Copy(io.Discard, streams.resize)
						close(resizeDone)
					}()
					_, _ = io.Copy(io.Discard, streams.stdin)
					<-resizeDone
				}))
				t.Cleanup(server.Close)
				cfg, cs := execTestClient(t, server.URL)
				mgr := newExecSessionManager()
				t.Cleanup(mgr.stopAll)
				ctx, cancel := context.WithCancel(t.Context())
				t.Cleanup(cancel)
				closeResult := make(chan error, 2)
				id, err := mgr.start(ctx, cfg, cs, "test-context", "test-ns", "test-pod", "test-container", nil,
					func(string) {}, func(err error) { closeResult <- err })
				if err != nil {
					t.Fatal(err)
				}
				receiveExecTest(t, opened)
				mgr.mu.Lock()
				session := mgr.sessions[id]
				mgr.mu.Unlock()
				resizeDone := make(chan struct{})
				go func() {
					for range 100 {
						mgr.resize(id, 80, 24)
					}
					close(resizeDone)
				}()
				switch stopMethod {
				case "stop":
					mgr.stop(id)
				case "parent":
					cancel()
				case "context":
					mgr.stopForContext("other-context")
					mgr.mu.Lock()
					active := mgr.sessions[id] != nil
					mgr.mu.Unlock()
					if !active {
						t.Fatal("stopping another context removed the session")
					}
					mgr.stopForContext("test-context")
				case "all":
					mgr.stopAll()
				}
				if err := receiveExecTest(t, closeResult); !errors.Is(err, context.Canceled) {
					t.Errorf("close error = %v, want context cancellation", err)
				}
				receiveExecTest(t, resizeDone)
				receiveExecTest(t, serverDone)
				assertExecSessionRemoved(t, mgr, id, session)
				mgr.stop(id)
				mgr.sendInput(id, "ignored")
				mgr.resize(id, 90, 30)
				wantRequests := int32(1)
				if protocol == "spdy" {
					wantRequests = 2
				}
				if requests.Load() != wantRequests {
					t.Errorf("requests after cancellation = %d, want %d", requests.Load(), wantRequests)
				}
				select {
				case <-closeResult:
					t.Error("close callback repeated")
				default:
				}
			})
		}
	}
}

func TestExecSessionSetupFailure(t *testing.T) {
	cfg, cs := execTestClient(t, "https://127.0.0.1")
	cfg.CAData = []byte("invalid certificate authority")
	mgr := newExecSessionManager()
	id, err := mgr.start(t.Context(), cfg, cs, "test-context", "test-ns", "test-pod", "test-container", nil,
		func(string) { t.Error("unexpected output callback") }, func(error) { t.Error("unexpected close callback") })
	if err == nil || id != "" {
		t.Fatalf("start = %q, %v; want no session and setup error", id, err)
	}
	if len(mgr.sessions) != 0 {
		t.Error("failed setup registered a session")
	}
}

func TestExecSessionCancellationDuringHandshake(t *testing.T) {
	for _, test := range []struct {
		name         string
		protocol     string
		partialError bool
	}{
		{name: "websocket/headers", protocol: "websocket"},
		{name: "websocket/error-body", protocol: "websocket", partialError: true},
		{name: "spdy/headers", protocol: "spdy"},
		{name: "spdy/error-body", protocol: "spdy", partialError: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			started := make(chan struct{})
			serverDone := make(chan struct{})
			releaseServer := make(chan struct{})
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				if test.protocol == "spdy" && r.Method == http.MethodGet {
					http.Error(w, "websocket upgrade is unsupported", http.StatusBadRequest)
					return
				}
				if test.partialError {
					w.WriteHeader(http.StatusBadRequest)
					w.(http.Flusher).Flush()
				}
				close(started)
				select {
				case <-r.Context().Done():
				case <-releaseServer:
				}
				close(serverDone)
			}))
			t.Cleanup(server.Close)
			t.Cleanup(func() { close(releaseServer) })
			cfg, cs := execTestClient(t, server.URL)
			mgr := newExecSessionManager()
			t.Cleanup(mgr.stopAll)
			closeResult := make(chan error, 1)
			id, err := mgr.start(t.Context(), cfg, cs, "test-context", "test-ns", "test-pod", "test-container", nil,
				func(string) {}, func(err error) { closeResult <- err })
			if err != nil {
				t.Fatal(err)
			}
			receiveExecTest(t, started)
			mgr.mu.Lock()
			session := mgr.sessions[id]
			mgr.mu.Unlock()
			inputDone := make(chan struct{})
			go func() {
				mgr.sendInput(id, "pending input")
				close(inputDone)
			}()
			mgr.stop(id)
			if err := receiveExecTest(t, closeResult); err == nil {
				t.Error("expected interrupted handshake error")
			}
			receiveExecTest(t, inputDone)
			receiveExecTest(t, serverDone)
			assertExecSessionRemoved(t, mgr, id, session)
			wantRequests := int32(1)
			if test.protocol == "spdy" {
				wantRequests = 2
			}
			if requests.Load() != wantRequests {
				t.Errorf("requests after cancellation = %d, want %d", requests.Load(), wantRequests)
			}
		})
	}
}

func TestExecSessionCancellationDuringProxyConnect(t *testing.T) {
	started := make(chan struct{})
	serverDone := make(chan struct{})
	releaseServer := make(chan struct{})
	proxy := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodConnect {
			t.Errorf("proxy method = %s, want CONNECT", r.Method)
		}
		close(started)
		select {
		case <-r.Context().Done():
		case <-releaseServer:
		}
		close(serverDone)
	}))
	t.Cleanup(proxy.Close)
	t.Cleanup(func() { close(releaseServer) })
	proxyURL, err := url.Parse(proxy.URL)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("direct request method = %s, want GET", r.Method)
		}
		http.Error(w, "websocket upgrade is unsupported", http.StatusBadRequest)
	}))
	t.Cleanup(server.Close)
	cfg, cs := execTestClient(t, server.URL)
	cfg.Insecure = true
	cfg.Proxy = func(r *http.Request) (*url.URL, error) {
		if r.Method == http.MethodPost {
			return proxyURL, nil
		}
		return nil, nil
	}
	mgr := newExecSessionManager()
	t.Cleanup(mgr.stopAll)
	closeResult := make(chan error, 1)
	id, err := mgr.start(t.Context(), cfg, cs, "test-context", "test-ns", "test-pod", "test-container", nil,
		func(string) {}, func(err error) { closeResult <- err })
	if err != nil {
		t.Fatal(err)
	}
	receiveExecTest(t, started)
	mgr.stop(id)
	if err := receiveExecTest(t, closeResult); err == nil {
		t.Error("expected interrupted proxy handshake error")
	}
	receiveExecTest(t, serverDone)
	assertExecSessionRemoved(t, mgr, id, nil)
}

func TestExecSessionDoesNotRetryAfterUpgrade(t *testing.T) {
	for _, test := range []struct {
		name          string
		protocols     []string
		writeFrame    bool
		statusMessage string
	}{
		{name: "connection-loss", protocols: []string{streamprotocol.StreamProtocolV5Name}, writeFrame: true},
		{name: "command-error-resembling-proxy-error", protocols: []string{streamprotocol.StreamProtocolV5Name}, statusMessage: "proxy: unknown scheme: https"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				upgrader := websocket.Upgrader{Subprotocols: test.protocols}
				conn, err := upgrader.Upgrade(w, r, nil)
				if err != nil {
					t.Errorf("WebSocket upgrade: %v", err)
					return
				}
				defer func() { _ = conn.Close() }()
				if test.writeFrame {
					if err := conn.WriteMessage(websocket.BinaryMessage, append([]byte{streamprotocol.StreamStdOut}, "command started"...)); err != nil {
						t.Errorf("stdout: %v", err)
					}
				}
				if test.statusMessage != "" {
					status, err := json.Marshal(metav1.Status{Status: metav1.StatusFailure, Message: test.statusMessage})
					if err != nil {
						t.Errorf("encode status: %v", err)
						return
					}
					if err := conn.WriteMessage(websocket.BinaryMessage, append([]byte{streamprotocol.StreamErr}, status...)); err != nil {
						t.Errorf("status: %v", err)
					}
					if err := conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(time.Second)); err != nil {
						t.Errorf("close: %v", err)
					}
				}
			}))
			t.Cleanup(server.Close)
			cfg, cs := execTestClient(t, server.URL)
			mgr := newExecSessionManager()
			t.Cleanup(mgr.stopAll)
			closeResult := make(chan error, 1)
			var output bytes.Buffer
			id, err := mgr.start(t.Context(), cfg, cs, "test-context", "test-ns", "test-pod", "test-container", nil,
				func(data string) { output.WriteString(data) }, func(err error) { closeResult <- err })
			if err != nil {
				t.Fatal(err)
			}
			err = receiveExecTest(t, closeResult)
			if err == nil {
				t.Fatal("expected stream error")
			}
			if test.statusMessage != "" && err.Error() != test.statusMessage {
				t.Errorf("stream error = %v, want %s", err, test.statusMessage)
			}
			assertExecSessionRemoved(t, mgr, id, nil)
			if requests.Load() != 1 {
				t.Errorf("command retried after upgrade: %d requests", requests.Load())
			}
			if test.writeFrame && output.String() != "command started" {
				t.Errorf("output = %q", output.String())
			}
		})
	}
}

func TestExecSessionCanceledBeforeStart(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		http.Error(w, "unexpected request", http.StatusBadRequest)
	}))
	t.Cleanup(server.Close)
	cfg, cs := execTestClient(t, server.URL)
	mgr := newExecSessionManager()
	t.Cleanup(mgr.stopAll)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	closeResult := make(chan error, 1)
	id, err := mgr.start(ctx, cfg, cs, "test-context", "test-ns", "test-pod", "test-container", nil,
		func(string) {}, func(err error) { closeResult <- err })
	if err != nil {
		t.Fatal(err)
	}
	if err := receiveExecTest(t, closeResult); !errors.Is(err, context.Canceled) {
		t.Errorf("close error = %v, want context cancellation", err)
	}
	assertExecSessionRemoved(t, mgr, id, nil)
	if requests.Load() != 0 {
		t.Errorf("canceled session made %d requests", requests.Load())
	}
}

type execTestStreams struct {
	stdin  io.Reader
	stdout io.Writer
	status io.Writer
	resize io.Reader
	close  func()
}

func openExecTestStreams(t *testing.T, w http.ResponseWriter, r *http.Request, protocol string) *execTestStreams {
	t.Helper()
	if protocol == "websocket" {
		if r.Method != http.MethodGet {
			t.Errorf("WebSocket method = %s, want GET", r.Method)
		}
		conn := wsstream.NewConn(map[string]wsstream.ChannelProtocolConfig{
			streamprotocol.StreamProtocolV5Name: {Binary: true, Channels: []wsstream.ChannelType{
				wsstream.ReadChannel, wsstream.WriteChannel, wsstream.IgnoreChannel,
				wsstream.WriteChannel, wsstream.ReadChannel,
			}},
		})
		conn.SetIdleTimeout(5 * time.Second)
		_, streams, err := conn.Open(w, r)
		if err != nil {
			t.Errorf("WebSocket upgrade: %v", err)
			return nil
		}
		return &execTestStreams{
			stdin: streams[streamprotocol.StreamStdIn], stdout: streams[streamprotocol.StreamStdOut],
			status: streams[streamprotocol.StreamErr], resize: streams[streamprotocol.StreamResize],
			close: func() { _ = conn.Close() },
		}
	}
	if r.Method != http.MethodPost || !strings.EqualFold(r.Header.Get("Upgrade"), "SPDY/3.1") {
		t.Errorf("SPDY request = %s, upgrade %q", r.Method, r.Header.Get("Upgrade"))
	}
	if _, err := httpstream.Handshake(r, w, []string{streamprotocol.StreamProtocolV4Name}); err != nil {
		t.Errorf("SPDY handshake: %v", err)
		return nil
	}
	type incomingStream struct {
		stream httpstream.Stream
		reply  <-chan struct{}
	}
	incoming := make(chan incomingStream, 4)
	conn := spdy.NewResponseUpgrader().UpgradeResponse(w, r, func(stream httpstream.Stream, reply <-chan struct{}) error {
		incoming <- incomingStream{stream: stream, reply: reply}
		return nil
	})
	if conn == nil {
		t.Error("SPDY upgrade failed")
		return nil
	}
	streams := make(map[string]httpstream.Stream)
	for range 4 {
		select {
		case received := <-incoming:
			select {
			case <-received.reply:
			case <-time.After(5 * time.Second):
				t.Error("SPDY stream reply timed out")
				_ = conn.Close()
				return nil
			}
			streams[received.stream.Headers().Get(corev1.StreamType)] = received.stream
		case <-time.After(5 * time.Second):
			t.Error("SPDY streams timed out")
			_ = conn.Close()
			return nil
		}
	}
	for _, kind := range []string{corev1.StreamTypeStdin, corev1.StreamTypeStdout, corev1.StreamTypeError, corev1.StreamTypeResize} {
		if streams[kind] == nil {
			t.Errorf("missing %s stream", kind)
			_ = conn.Close()
			return nil
		}
	}
	return &execTestStreams{
		stdin: streams[corev1.StreamTypeStdin], stdout: streams[corev1.StreamTypeStdout],
		status: streams[corev1.StreamTypeError], resize: streams[corev1.StreamTypeResize],
		close: func() { _ = conn.Close() },
	}
}

func execTestClient(t *testing.T, host string) (*rest.Config, *kubernetes.Clientset) {
	t.Helper()
	cfg := &rest.Config{Host: host}
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		t.Fatal(err)
	}
	return cfg, cs
}

func assertExecRequest(t *testing.T, r *http.Request, command []string) {
	t.Helper()
	if r.URL.Path != "/api/v1/namespaces/test-ns/pods/test-pod/exec" {
		t.Errorf("path = %s", r.URL.Path)
	}
	query := r.URL.Query()
	if !reflect.DeepEqual(query["command"], command) {
		t.Errorf("command = %q, want %q", query["command"], command)
	}
	for key, value := range map[string]string{
		"container": "test-container", "stdin": "true", "stdout": "true", "stderr": "true", "tty": "true",
	} {
		if query.Get(key) != value {
			t.Errorf("%s = %q, want %q", key, query.Get(key), value)
		}
	}
}

func receiveExecTest[T any](t *testing.T, ch <-chan T) T {
	t.Helper()
	select {
	case value := <-ch:
		return value
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for exec result")
		var zero T
		return zero
	}
}

func assertExecSessionRemoved(t *testing.T, mgr *execSessionManager, id string, session *execSession) {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		mgr.mu.Lock()
		active := mgr.sessions[id] != nil
		mgr.mu.Unlock()
		if !active {
			break
		}
		select {
		case <-deadline:
			t.Fatal("exec session remained registered after close")
		case <-time.After(time.Millisecond):
		}
	}
	if session != nil {
		for {
			select {
			case _, ok := <-session.resize:
				if !ok {
					if _, err := session.stdin.Write([]byte("closed")); err == nil {
						t.Error("stdin remained open after close")
					}
					return
				}
			case <-deadline:
				t.Fatal("resize queue remained open after close")
			}
		}
	}
}
