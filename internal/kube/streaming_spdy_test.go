package kube

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"k8s.io/client-go/rest"
	clientspdy "k8s.io/client-go/transport/spdy"
	"k8s.io/streaming/pkg/httpstream"
	httpstreamspdy "k8s.io/streaming/pkg/httpstream/spdy"
)

func TestStreamingSPDYRejectsMalformedUpgrade(t *testing.T) {
	for _, tc := range []struct {
		name, connection, upgrade, protocol, want string
	}{
		{"wrong upgrade", "Upgrade", "websocket", "v4.channel.k8s.io", "invalid SPDY upgrade response headers"},
		{"missing upgrade", "Upgrade", "", "v4.channel.k8s.io", "invalid SPDY upgrade response headers"},
		{"wrong connection", "keep-alive", "SPDY/3.1", "v4.channel.k8s.io", "invalid SPDY upgrade response headers"},
		{"invalid connection token", "notupgrade", "SPDY/3.1", "v4.channel.k8s.io", "invalid SPDY upgrade response headers"},
		{"unoffered protocol", "Upgrade", "SPDY/3.1", "unsupported.channel.k8s.io", "unexpected SPDY streaming protocol"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			closed := make(chan struct{})
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				defer close(closed)
				conn, rw, err := w.(http.Hijacker).Hijack()
				if err != nil {
					t.Error(err)
					return
				}
				defer func() { _ = conn.Close() }()
				_, err = fmt.Fprintf(rw, "HTTP/1.1 101 Switching Protocols\r\nConnection: %s\r\nUpgrade: %s\r\nX-Stream-Protocol-Version: %s\r\n\r\n", tc.connection, tc.upgrade, tc.protocol)
				if err == nil {
					err = rw.Flush()
				}
				if err != nil {
					t.Error(err)
					return
				}
				_, _ = io.Copy(io.Discard, conn)
			}))
			t.Cleanup(server.Close)
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			transport, upgrader, err := newStreamingSPDYTransport(ctx, &rest.Config{Host: server.URL})
			if err != nil {
				t.Fatal(err)
			}
			req, err := http.NewRequestWithContext(ctx, http.MethodPost, server.URL, nil)
			if err != nil {
				t.Fatal(err)
			}
			result := make(chan error, 1)
			go func() {
				conn, _, err := clientspdy.NegotiateStreaming(upgrader, &http.Client{Transport: transport}, req, "v4.channel.k8s.io")
				if conn != nil {
					_ = conn.Close()
				}
				result <- err
			}()
			if err := streamingTestReceive(t, result); err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("invalid upgrade returned %v, want %q", err, tc.want)
			}
			streamingTestReceive(t, closed)
		})
	}
}

func TestStreamingSPDYAcceptsLegacyEmptyProtocol(t *testing.T) {
	closed := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(closed)
		conn := httpstreamspdy.NewResponseUpgrader().UpgradeResponse(w, r, httpstream.NoOpNewStreamHandler)
		if conn == nil {
			t.Error("SPDY upgrade failed")
			return
		}
		defer func() { _ = conn.Close() }()
		<-conn.CloseChan()
	}))
	t.Cleanup(server.Close)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	transport, upgrader, err := newStreamingSPDYTransport(ctx, &rest.Config{Host: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, server.URL, nil)
	if err != nil {
		t.Fatal(err)
	}
	conn, protocol, err := clientspdy.NegotiateStreaming(upgrader, &http.Client{Transport: transport}, req, "v4.channel.k8s.io", "channel.k8s.io")
	if err != nil {
		t.Fatal(err)
	}
	if protocol != "" {
		t.Errorf("negotiated protocol = %q, want legacy empty protocol", protocol)
	}
	if err := conn.Close(); err != nil {
		t.Fatal(err)
	}
	streamingTestReceive(t, closed)
}
