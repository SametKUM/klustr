package kube

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/streaming/pkg/httpstream"
	httpstreamspdy "k8s.io/streaming/pkg/httpstream/spdy"
)

const pfReadyTimeout = 10 * time.Second

type PortForwardInfo struct {
	ID         string `json:"id"`
	Context    string `json:"context"`
	Namespace  string `json:"namespace"`
	PodName    string `json:"podName"`
	LocalPort  uint16 `json:"localPort"`
	RemotePort uint16 `json:"remotePort"`
	Status     string `json:"status"`
	Error      string `json:"error"`
}

type pfChangeFunc func()

type pfSession struct {
	info   PortForwardInfo
	cancel context.CancelFunc
}

func (s *pfSession) close() {
	s.cancel()
}

type portForwarder interface {
	ForwardPorts() error
	GetPorts() ([]portforward.ForwardedPort, error)
}

type pfDialer func(...string) (httpstream.Connection, string, error)

func (d pfDialer) Dial(protocols ...string) (httpstream.Connection, string, error) {
	return d(protocols...)
}

type pfUpgradeConn struct {
	net.Conn
	reader io.ReadCloser
}

func (c *pfUpgradeConn) Read(p []byte) (int, error) { return c.reader.Read(p) }
func (c *pfUpgradeConn) Close() error               { return c.reader.Close() }

type pfContextConn struct {
	net.Conn
	stop func() bool
}

func (c *pfContextConn) Close() error {
	c.stop()
	return c.Conn.Close()
}

type pfManager struct {
	mu       sync.Mutex
	sessions map[string]*pfSession
	counter  uint64
	onChange pfChangeFunc
}

func newPFManager() *pfManager {
	return &pfManager{sessions: make(map[string]*pfSession)}
}

func (mgr *pfManager) setOnChange(cb pfChangeFunc) {
	mgr.mu.Lock()
	mgr.onChange = cb
	mgr.mu.Unlock()
}

func (mgr *pfManager) notify() {
	mgr.mu.Lock()
	cb := mgr.onChange
	mgr.mu.Unlock()
	if cb != nil {
		cb()
	}
}

func newPortForwarder(
	ctx context.Context,
	cs *kubernetes.Clientset,
	restCfg *rest.Config,
	namespace, podName string,
	localPort, remotePort uint16,
	readyCh chan struct{},
) (portForwarder, error) {
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
		return &pfContextConn{Conn: conn, stop: context.AfterFunc(ctx, func() { _ = conn.Close() })}, nil
	}
	client, err := rest.HTTPClientFor(cfg)
	if err != nil {
		return nil, err
	}
	url := cs.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(namespace).
		Name(podName).
		SubResource("portforward").
		URL()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url.String(), nil)
	if err != nil {
		return nil, err
	}
	// The SPDY round tripper ignores cancellation while reading HTTP responses.
	dialer := pfDialer(func(protocols ...string) (httpstream.Connection, string, error) {
		var conn net.Conn
		trace := &httptrace.ClientTrace{GotConn: func(info httptrace.GotConnInfo) { conn = info.Conn }}
		req := req.Clone(httptrace.WithClientTrace(ctx, trace))
		req.Header.Set(httpstream.HeaderConnection, httpstream.HeaderUpgrade)
		req.Header.Set(httpstream.HeaderUpgrade, httpstreamspdy.HeaderSpdy31)
		for _, protocol := range protocols {
			req.Header.Add(httpstream.HeaderProtocolVersion, protocol)
		}
		resp, err := client.Do(req)
		if err != nil {
			return nil, "", err
		}
		if resp.StatusCode != http.StatusSwitchingProtocols ||
			!strings.Contains(strings.ToLower(resp.Header.Get(httpstream.HeaderConnection)), "upgrade") ||
			!strings.EqualFold(resp.Header.Get(httpstream.HeaderUpgrade), httpstreamspdy.HeaderSpdy31) {
			defer func() { _ = resp.Body.Close() }()
			body, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
			if err != nil {
				return nil, "", fmt.Errorf("unable to read upgrade response: %w", err)
			}
			return nil, "", fmt.Errorf("unable to upgrade connection: %s: %s", resp.Status, strings.TrimSpace(string(body)))
		}
		if conn == nil {
			_ = resp.Body.Close()
			return nil, "", errors.New("upgrade transport did not expose its connection")
		}
		// The response body retains bytes net/http buffered past the 101 headers.
		stream, err := httpstreamspdy.NewClientConnectionWithPings(&pfUpgradeConn{Conn: conn, reader: resp.Body}, 5*time.Second)
		if err != nil {
			_ = resp.Body.Close()
			return nil, "", err
		}
		return stream, resp.Header.Get(httpstream.HeaderProtocolVersion), nil
	})
	ports := []string{fmt.Sprintf("%d:%d", localPort, remotePort)}
	return portforward.NewOnAddressesForStreamingWithContext(ctx, dialer, []string{"localhost"}, ports, readyCh, io.Discard, io.Discard)
}

func (mgr *pfManager) start(
	contextName, namespace, podName string,
	build func(context.Context, chan struct{}) (portForwarder, error),
) (PortForwardInfo, error) {
	ctx, cancel := context.WithCancel(context.Background())
	id := fmt.Sprintf("pf-%d", atomic.AddUint64(&mgr.counter, 1))
	sess := &pfSession{
		info:   PortForwardInfo{ID: id, Context: contextName, Namespace: namespace, PodName: podName, Status: "starting"},
		cancel: cancel,
	}
	mgr.mu.Lock()
	mgr.sessions[id] = sess
	mgr.mu.Unlock()
	started := false
	defer func() {
		if !started {
			mgr.stop(id)
		}
	}()

	readyCh := make(chan struct{})
	forwarder, err := build(ctx, readyCh)
	if err != nil {
		return PortForwardInfo{}, err
	}
	if err := ctx.Err(); err != nil {
		return PortForwardInfo{}, err
	}
	resultCh := make(chan error, 1)

	go func() {
		resultCh <- forwarder.ForwardPorts()
	}()

	select {
	case <-ctx.Done():
		return PortForwardInfo{}, ctx.Err()
	case <-readyCh:
	case err := <-resultCh:
		if err == nil {
			err = errors.New("port-forward terminated before ready")
		}
		return PortForwardInfo{}, err
	case <-time.After(pfReadyTimeout):
		return PortForwardInfo{}, fmt.Errorf("timed out waiting for port-forward to become ready")
	}

	actualPorts, err := forwarder.GetPorts()
	if err != nil || len(actualPorts) == 0 {
		if err == nil {
			err = errors.New("no ports reported by forwarder")
		}
		return PortForwardInfo{}, err
	}

	info := PortForwardInfo{
		ID:         id,
		Context:    contextName,
		Namespace:  namespace,
		PodName:    podName,
		LocalPort:  actualPorts[0].Local,
		RemotePort: actualPorts[0].Remote,
		Status:     "ready",
	}
	mgr.mu.Lock()
	if mgr.sessions[id] != sess {
		mgr.mu.Unlock()
		return PortForwardInfo{}, context.Canceled
	}
	sess.info = info
	mgr.mu.Unlock()
	started = true
	mgr.notify()

	go func() {
		defer cancel()
		err := <-resultCh
		mgr.mu.Lock()
		s, ok := mgr.sessions[id]
		if ok {
			if err != nil {
				// Keep the errored session listed until the user dismisses
				// it via stop() — deleting here would make the forward
				// vanish with no explanation of why it died.
				s.info.Status = "error"
				s.info.Error = err.Error()
			} else {
				s.info.Status = "closed"
				delete(mgr.sessions, id)
			}
		}
		mgr.mu.Unlock()
		mgr.notify()
	}()

	return info, nil
}

func (mgr *pfManager) stop(id string) {
	mgr.mu.Lock()
	sess, ok := mgr.sessions[id]
	// Remove and notify synchronously for every stop, not just dismissing an
	// errored one. Otherwise a healthy stop only updated the UI when the monitor
	// goroutine woke as ForwardPorts returned, which can lag on a wedged SPDY
	// connection. The monitor's ok-check no-ops on the already-removed id, and
	// an errored session's monitor has already exited.
	if ok {
		delete(mgr.sessions, id)
	}
	mgr.mu.Unlock()
	if !ok {
		return
	}
	sess.close()
	mgr.notify()
}

func (mgr *pfManager) list() []PortForwardInfo {
	mgr.mu.Lock()
	out := make([]PortForwardInfo, 0, len(mgr.sessions))
	for _, s := range mgr.sessions {
		if s.info.Status == "starting" {
			continue
		}
		out = append(out, s.info)
	}
	mgr.mu.Unlock()
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// stopForContext closes and removes every active port-forward belonging to the
// given context. Called from StopWatch so disconnecting a cluster releases its
// local listeners and forwarder goroutines instead of leaking them, and the
// change notification lets the frontend store drop the now-dead entries. A
// healthy session's monitor goroutine wakes when its context is canceled, finds its
// id already gone (the ok check in start's monitor guards this) and is a no-op.
func (mgr *pfManager) stopForContext(contextName string) {
	mgr.mu.Lock()
	closing := make([]*pfSession, 0)
	for id, s := range mgr.sessions {
		if s.info.Context == contextName {
			closing = append(closing, s)
			delete(mgr.sessions, id)
		}
	}
	mgr.mu.Unlock()
	if len(closing) == 0 {
		return
	}
	for _, s := range closing {
		s.close()
	}
	mgr.notify()
}

// stopAll closes every active port-forward. Called from
// ClientManager.Shutdown so the local listeners are released cleanly on
// app quit instead of being killed mid-connection.
func (mgr *pfManager) stopAll() {
	mgr.mu.Lock()
	sessions := make([]*pfSession, 0, len(mgr.sessions))
	for _, s := range mgr.sessions {
		sessions = append(sessions, s)
	}
	mgr.sessions = make(map[string]*pfSession)
	mgr.mu.Unlock()
	for _, s := range sessions {
		s.close()
	}
}
