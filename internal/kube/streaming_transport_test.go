package kube

import (
	"context"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
	clientwebsocket "k8s.io/client-go/transport/websocket"
	"k8s.io/streaming/pkg/httpstream"
)

func TestShouldFallbackStreaming(t *testing.T) {
	for _, status := range []int{101, 200, 301, 400, 401, 403, 404, 405, 407, 408, 409, 426, 429, 500, 501, 502, 503, 504} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			err := fmt.Errorf("wrapped: %w", &streamingUpgradeError{status: status, cause: websocket.ErrBadHandshake})
			want := status != http.StatusUnauthorized
			if got := shouldFallbackStreaming(err); got != want {
				t.Fatalf("fallback for HTTP %d = %v, want %v", status, got, want)
			}
		})
	}
	for _, err := range []error{
		nil,
		context.Canceled,
		context.DeadlineExceeded,
		io.EOF,
		x509.UnknownAuthorityError{},
		errors.New("command terminated with exit code 1"),
		errors.New("proxy: unknown scheme: https"),
		&streamingUpgradeError{status: http.StatusBadRequest, cause: context.Canceled},
		&streamingUpgradeError{status: http.StatusBadRequest, cause: context.DeadlineExceeded},
		&httpstream.UpgradeFailureError{Cause: context.Canceled},
		&httpstream.UpgradeFailureError{Cause: context.DeadlineExceeded},
		&streamingUpgradeError{status: http.StatusNotFound, cause: &apierrors.StatusError{ErrStatus: metav1.Status{
			Reason: metav1.StatusReasonNotFound, Code: http.StatusNotFound, Message: "pod not found",
		}}},
		&streamingUpgradeError{status: http.StatusBadRequest, cause: &apierrors.StatusError{ErrStatus: metav1.Status{
			Reason: metav1.StatusReasonForbidden, Code: http.StatusForbidden, Message: "access denied",
		}}},
		&streamingUpgradeError{status: http.StatusBadRequest, cause: &apierrors.StatusError{ErrStatus: metav1.Status{
			Reason: metav1.StatusReasonUnauthorized, Code: http.StatusUnauthorized, Message: "authentication failed",
		}}},
	} {
		if shouldFallbackStreaming(err) {
			t.Errorf("unexpected fallback for %v", err)
		}
	}
	for _, err := range []error{
		&httpstream.UpgradeFailureError{Cause: errors.New("unspecified failure")},
		fmt.Errorf("wrapped: %w", &httpstream.UpgradeFailureError{Cause: websocket.ErrBadHandshake}),
	} {
		if !shouldFallbackStreaming(err) {
			t.Errorf("missing fallback for %v", err)
		}
	}
}

func TestStreamingUpgradeErrorPreservesAPIStatus(t *testing.T) {
	status := &apierrors.StatusError{ErrStatus: metav1.Status{
		Status: metav1.StatusFailure, Reason: metav1.StatusReasonForbidden, Code: http.StatusForbidden,
		Message: "access denied",
	}}
	err := &streamingUpgradeError{status: http.StatusForbidden, cause: status}
	if !apierrors.IsForbidden(err) || !errors.Is(err, status) || !shouldFallbackStreaming(err) {
		t.Fatalf("API status not preserved: %v", err)
	}
}

type streamingTestTransport func(*http.Request) (*http.Response, error)

func (f streamingTestTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func streamingTestReceive[T any](t *testing.T, ch <-chan T) T {
	t.Helper()
	select {
	case value := <-ch:
		return value
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for streaming transport")
		var zero T
		return zero
	}
}

func streamingTestNegotiate(ctx context.Context, cfg *rest.Config) (*websocket.Conn, error) {
	rt, holder, err := clientwebsocket.RoundTripperFor(streamingWebSocketConfig(ctx, cfg))
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, cfg.Host, nil)
	if err != nil {
		return nil, err
	}
	return clientwebsocket.Negotiate(rt, holder, req, "test.k8s.io")
}

func TestStreamingWebSocketPreservesConfigAndTransport(t *testing.T) {
	closed := make(chan struct{})
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(closed)
		for header, want := range map[string]string{
			"Authorization": "Bearer test-token", "Impersonate-User": "test-user",
			"User-Agent": "test-agent", "X-Test-Transport": "preserved",
		} {
			if got := r.Header.Get(header); got != want {
				t.Errorf("%s = %q, want %q", header, got, want)
			}
		}
		upgrader := websocket.Upgrader{Subprotocols: []string{"test.k8s.io"}}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer func() { _ = conn.Close() }()
		kind, message, err := conn.ReadMessage()
		if err != nil {
			t.Error(err)
			return
		}
		if err := conn.WriteMessage(kind, message); err != nil {
			t.Error(err)
			return
		}
		_, _, _ = conn.ReadMessage()
	}))
	t.Cleanup(server.Close)
	t.Cleanup(server.CloseClientConnections)
	var dials, proxies, wrappers atomic.Int32
	cfg := &rest.Config{
		Host: server.URL, BearerToken: "test-token", UserAgent: "test-agent", Timeout: time.Nanosecond,
		Impersonate: rest.ImpersonationConfig{UserName: "test-user"},
		TLSClientConfig: rest.TLSClientConfig{
			CAData:     pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw}),
			NextProtos: []string{"h2"},
		},
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			dials.Add(1)
			return (&net.Dialer{}).DialContext(ctx, network, address)
		},
		Proxy: func(*http.Request) (*url.URL, error) {
			proxies.Add(1)
			return nil, nil
		},
		WrapTransport: func(rt http.RoundTripper) http.RoundTripper {
			wrappers.Add(1)
			return streamingTestTransport(func(req *http.Request) (*http.Response, error) {
				req = req.Clone(req.Context())
				req.Header.Set("X-Test-Transport", "preserved")
				return rt.RoundTrip(req)
			})
		},
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	copy := streamingWebSocketConfig(ctx, cfg)
	if copy.Timeout != 0 || !slices.Equal(copy.NextProtos, []string{"http/1.1"}) {
		t.Fatal("streaming config does not disable ordinary HTTP timeouts and h2")
	}
	conn, err := streamingTestNegotiate(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if cfg.Timeout != time.Nanosecond || !slices.Equal(cfg.NextProtos, []string{"h2"}) {
		t.Fatal("source REST config was mutated")
	}
	if dials.Load() != 1 || proxies.Load() != 1 || wrappers.Load() != 1 {
		t.Fatalf("transport hooks: dials=%d proxies=%d wrappers=%d", dials.Load(), proxies.Load(), wrappers.Load())
	}
	if err := conn.WriteMessage(websocket.BinaryMessage, []byte("alive")); err != nil {
		t.Fatal(err)
	}
	if err := conn.SetReadDeadline(time.Now().Add(3 * time.Second)); err != nil {
		t.Fatal(err)
	}
	_, message, err := conn.ReadMessage()
	if err != nil || string(message) != "alive" {
		t.Fatalf("streaming round trip = %q, %v", message, err)
	}
	cancel()
	streamingTestReceive(t, closed)
}

func TestStreamingWebSocketCancelDuringDial(t *testing.T) {
	entered := make(chan struct{})
	exited := make(chan struct{})
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	cfg := &rest.Config{
		Host: "https://streaming.example.invalid",
		Dial: func(ctx context.Context, _, _ string) (net.Conn, error) {
			defer close(exited)
			close(entered)
			<-ctx.Done()
			return nil, ctx.Err()
		},
	}
	result := make(chan error, 1)
	go func() {
		_, err := streamingTestNegotiate(ctx, cfg)
		result <- err
	}()
	streamingTestReceive(t, entered)
	cancel()
	if err := streamingTestReceive(t, result); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled dial returned %v", err)
	}
	streamingTestReceive(t, exited)
}

func TestStreamingWebSocketCancelBlockedHandshake(t *testing.T) {
	for _, stage := range []string{"headers", "error body", "proxy CONNECT"} {
		t.Run(stage, func(t *testing.T) {
			entered, exited := make(chan struct{}), make(chan struct{})
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				defer close(exited)
				if stage == "proxy CONNECT" && r.Method != http.MethodConnect {
					t.Errorf("unexpected proxy method: %s", r.Method)
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
				proxy, err := url.Parse(server.URL)
				if err != nil {
					t.Fatal(err)
				}
				cfg.Host = "https://streaming.example.invalid"
				cfg.Proxy = http.ProxyURL(proxy)
			}
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			result := make(chan error, 1)
			go func() {
				_, err := streamingTestNegotiate(ctx, cfg)
				result <- err
			}()
			streamingTestReceive(t, entered)
			cancel()
			if err := streamingTestReceive(t, result); !errors.Is(err, context.Canceled) || shouldFallbackStreaming(err) {
				t.Fatalf("canceled %s returned %v", stage, err)
			}
			streamingTestReceive(t, exited)
		})
	}
}
