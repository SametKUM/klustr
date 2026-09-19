package kube

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
	clientwebsocket "k8s.io/client-go/transport/websocket"
	"k8s.io/streaming/pkg/httpstream"
	"k8s.io/streaming/pkg/httpstream/wsstream"
)

type streamingUpgradeError struct {
	status int
	cause  error
}

func (e *streamingUpgradeError) Error() string {
	return fmt.Sprintf("unable to upgrade streaming connection (%d %s): %v", e.status, http.StatusText(e.status), e.cause)
}

func (e *streamingUpgradeError) Unwrap() error { return e.cause }

func shouldFallbackStreaming(err error) bool {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	var upgrade *streamingUpgradeError
	if errors.As(err, &upgrade) {
		if apierrors.IsUnauthorized(upgrade.cause) || apierrors.IsNotFound(upgrade.cause) ||
			(apierrors.IsForbidden(upgrade.cause) && upgrade.status != http.StatusForbidden) {
			return false
		}
		switch upgrade.status {
		case http.StatusForbidden:
			// WebSocket GET needs get permission; legacy POST is authorized as create.
			return true
		case http.StatusUnauthorized:
			return false
		default:
			return true
		}
	}
	var failure *httpstream.UpgradeFailureError
	return errors.As(err, &failure) && !errors.Is(failure.Cause, context.Canceled) && !errors.Is(failure.Cause, context.DeadlineExceeded)
}

func streamingWebSocketConfig(ctx context.Context, cfg *rest.Config) *rest.Config {
	copy := rest.CopyConfig(cfg)
	copy.NextProtos = []string{"http/1.1"}
	copy.Timeout = 0
	dial := cfg.Dial
	if dial == nil {
		dial = (&net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second}).DialContext
	}
	wrap := cfg.WrapTransport
	copy.WrapTransport = func(rt http.RoundTripper) http.RoundTripper {
		if holder, ok := rt.(*clientwebsocket.RoundTripper); ok {
			// The upstream WebSocket transport ignores Config.Dial and cannot
			// cancel a stalled proxy CONNECT or HTTP upgrade after dialing.
			rt = &streamingWebSocketTransport{ctx: ctx, holder: holder, dial: dial}
		}
		if wrap != nil {
			rt = wrap(rt)
		}
		return rt
	}
	return copy
}

type streamingWebSocketTransport struct {
	ctx    context.Context
	holder *clientwebsocket.RoundTripper
	dial   func(context.Context, string, string) (net.Conn, error)
}

// This mirrors client-go's WebSocket negotiation with cancellable dialing.
// Recheck its handshake and subprotocol behavior when upgrading client-go.
func (rt *streamingWebSocketTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	ctx, cancel := context.WithCancel(req.Context())
	stopSession := context.AfterFunc(rt.ctx, cancel)
	release := func() {
		stopSession()
		cancel()
	}
	connected := false
	defer func() {
		if !connected {
			release()
		}
	}()
	if req.Body != nil {
		defer func() { _ = req.Body.Close() }()
	}
	if err := rt.ctx.Err(); err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	header := req.Header.Clone()
	protocols := header[wsstream.WebSocketProtocolHeader]
	delete(header, wsstream.WebSocketProtocolHeader)
	u := *req.URL
	switch u.Scheme {
	case "https":
		u.Scheme = "wss"
	case "http":
		u.Scheme = "ws"
	default:
		return nil, fmt.Errorf("unsupported streaming URL scheme: %s", u.Scheme)
	}
	dialer := websocket.Dialer{
		Proxy:           rt.holder.Proxier,
		TLSClientConfig: rt.holder.TLSConfig,
		Subprotocols:    protocols,
		ReadBufferSize:  rt.holder.DataBufferSize() + 1024,
		WriteBufferSize: rt.holder.DataBufferSize() + 1024,
		NetDialContext: func(dialCtx context.Context, network, address string) (net.Conn, error) {
			conn, err := rt.dial(dialCtx, network, address)
			if err != nil {
				return nil, err
			}
			return &streamingContextConn{
				Conn:    conn,
				stop:    context.AfterFunc(ctx, func() { _ = conn.Close() }),
				release: release,
			}, nil
		},
	}
	conn, resp, err := dialer.DialContext(ctx, u.String(), header)
	if err != nil {
		if contextErr := rt.ctx.Err(); contextErr != nil {
			return nil, contextErr
		}
		if contextErr := req.Context().Err(); contextErr != nil {
			return nil, contextErr
		}
		if errors.Is(err, websocket.ErrBadHandshake) && resp != nil {
			defer func() { _ = resp.Body.Close() }()
			body, readErr := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
			if readErr != nil {
				if ctx.Err() != nil {
					return nil, ctx.Err()
				}
				return nil, &streamingUpgradeError{status: resp.StatusCode, cause: fmt.Errorf("read streaming upgrade response: %w", readErr)}
			}
			cause := err
			var status metav1.Status
			if json.Unmarshal(body, &status) == nil && status.Kind == "Status" {
				cause = &apierrors.StatusError{ErrStatus: status}
			} else if detail := strings.TrimSpace(string(body)); detail != "" {
				cause = fmt.Errorf("%w: %s", err, detail)
			}
			return nil, &streamingUpgradeError{status: resp.StatusCode, cause: cause}
		}
		if errors.Is(err, websocket.ErrBadHandshake) || httpstream.IsHTTPSProxyError(err) {
			return nil, &httpstream.UpgradeFailureError{Cause: err}
		}
		return nil, err
	}
	if ctx.Err() != nil {
		_ = conn.Close()
		return nil, ctx.Err()
	}
	if !slices.Contains(protocols, conn.Subprotocol()) {
		_ = conn.Close()
		return nil, &httpstream.UpgradeFailureError{Cause: fmt.Errorf("unexpected streaming protocol %q, expected one of %q", conn.Subprotocol(), protocols)}
	}
	rt.holder.Conn = conn
	connected = true
	return resp, nil
}

type streamingContextConn struct {
	net.Conn
	stop    func() bool
	release func()
	once    sync.Once
}

func (c *streamingContextConn) Close() error {
	c.once.Do(func() {
		c.stop()
		c.release()
	})
	return c.Conn.Close()
}
