package kube

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"slices"
	"strings"
	"time"

	"k8s.io/client-go/rest"
	clientspdy "k8s.io/client-go/transport/spdy"
	"k8s.io/streaming/pkg/httpstream"
	httpstreamspdy "k8s.io/streaming/pkg/httpstream/spdy"
)

func newStreamingSPDYTransport(ctx context.Context, restCfg *rest.Config) (http.RoundTripper, clientspdy.Upgrader, error) {
	cfg := rest.CopyConfig(restCfg)
	cfg.NextProtos = []string{"http/1.1"}
	cfg.Timeout = 0
	dial := cfg.Dial
	if dial == nil {
		dial = (&net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second}).DialContext
	}
	cfg.Dial = func(dialCtx context.Context, network, address string) (net.Conn, error) {
		dialCtx, cancel := context.WithCancel(dialCtx)
		stop := context.AfterFunc(ctx, cancel)
		defer cancel()
		defer stop()
		conn, err := dial(dialCtx, network, address)
		if err != nil {
			return nil, err
		}
		// net/http may detach dialing from the request to reuse connections.
		return &streamingSPDYConn{Conn: conn, stop: context.AfterFunc(ctx, func() { _ = conn.Close() })}, nil
	}
	transport, err := rest.TransportFor(cfg)
	if err != nil {
		return nil, nil, err
	}
	// The upstream SPDY round tripper blocks while reading upgrade responses.
	upgrader := &streamingSPDYTransport{transport: transport}
	return upgrader, clientspdy.NewUpgraderForStreaming(upgrader), nil
}

type streamingSPDYTransport struct {
	transport http.RoundTripper
}

func (rt *streamingSPDYTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	var conn net.Conn
	trace := &httptrace.ClientTrace{GotConn: func(info httptrace.GotConnInfo) { conn = info.Conn }}
	req = req.Clone(httptrace.WithClientTrace(req.Context(), trace))
	req.Header.Set(httpstream.HeaderConnection, httpstream.HeaderUpgrade)
	req.Header.Set(httpstream.HeaderUpgrade, httpstreamspdy.HeaderSpdy31)
	resp, err := rt.transport.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	resp.Body = &streamingSPDYResponseBody{ReadCloser: resp.Body, conn: conn, protocols: slices.Clone(req.Header.Values(httpstream.HeaderProtocolVersion))}
	return resp, nil
}

func (rt *streamingSPDYTransport) NewConnection(resp *http.Response) (httpstream.Connection, error) {
	if resp.StatusCode != http.StatusSwitchingProtocols {
		body, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
		if err != nil {
			return nil, fmt.Errorf("unable to read upgrade response: %w", err)
		}
		return nil, fmt.Errorf("unable to upgrade connection: %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}
	connectionUpgrade := false
	for _, value := range resp.Header.Values(httpstream.HeaderConnection) {
		for _, token := range strings.Split(value, ",") {
			if strings.EqualFold(strings.TrimSpace(token), "upgrade") {
				connectionUpgrade = true
			}
		}
	}
	if !connectionUpgrade || !strings.EqualFold(resp.Header.Get(httpstream.HeaderUpgrade), httpstreamspdy.HeaderSpdy31) {
		return nil, fmt.Errorf("invalid SPDY upgrade response headers: Connection=%q, Upgrade=%q", resp.Header.Get(httpstream.HeaderConnection), resp.Header.Get(httpstream.HeaderUpgrade))
	}
	body := resp.Body.(*streamingSPDYResponseBody)
	if protocol := resp.Header.Get(httpstream.HeaderProtocolVersion); protocol != "" && !slices.Contains(body.protocols, protocol) {
		return nil, fmt.Errorf("unexpected SPDY streaming protocol %q, expected one of %q", protocol, body.protocols)
	}
	if body.conn == nil {
		return nil, errors.New("upgrade transport did not expose its connection")
	}
	stream, err := httpstreamspdy.NewClientConnectionWithPings(
		&streamingSPDYUpgradeConn{Conn: body.conn, reader: body.ReadCloser}, 5*time.Second)
	if err != nil {
		return nil, err
	}
	// Negotiate closes the response body after handing its connection to the caller.
	// Keep its buffered bytes and transfer ownership to the SPDY connection.
	body.upgraded = true
	return stream, nil
}

type streamingSPDYResponseBody struct {
	io.ReadCloser
	conn      net.Conn
	protocols []string
	upgraded  bool
}

func (b *streamingSPDYResponseBody) Close() error {
	if b.upgraded {
		return nil
	}
	return b.ReadCloser.Close()
}

type streamingSPDYUpgradeConn struct {
	net.Conn
	reader io.ReadCloser
}

func (c *streamingSPDYUpgradeConn) Read(p []byte) (int, error) { return c.reader.Read(p) }
func (c *streamingSPDYUpgradeConn) Close() error               { return c.reader.Close() }

type streamingSPDYConn struct {
	net.Conn
	stop func() bool
}

func (c *streamingSPDYConn) Close() error {
	c.stop()
	return c.Conn.Close()
}
