package kube

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
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
	stopCh chan struct{}
	closed sync.Once
}

func (s *pfSession) close() {
	s.closed.Do(func() { close(s.stopCh) })
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

func (mgr *pfManager) start(
	contextName string,
	cs *kubernetes.Clientset,
	restCfg *rest.Config,
	namespace, podName string,
	localPort, remotePort uint16,
) (PortForwardInfo, error) {
	rt, upgrader, err := spdy.RoundTripperFor(restCfg)
	if err != nil {
		return PortForwardInfo{}, err
	}
	url := cs.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(namespace).
		Name(podName).
		SubResource("portforward").
		URL()
	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: rt}, "POST", url)

	stopCh := make(chan struct{})
	readyCh := make(chan struct{})
	resultCh := make(chan error, 1)

	ports := []string{fmt.Sprintf("%d:%d", localPort, remotePort)}
	forwarder, err := portforward.New(dialer, ports, stopCh, readyCh, io.Discard, io.Discard)
	if err != nil {
		return PortForwardInfo{}, err
	}

	go func() {
		resultCh <- forwarder.ForwardPorts()
	}()

	select {
	case <-readyCh:
	case err := <-resultCh:
		close(stopCh)
		if err == nil {
			err = errors.New("port-forward terminated before ready")
		}
		return PortForwardInfo{}, err
	case <-time.After(pfReadyTimeout):
		close(stopCh)
		return PortForwardInfo{}, fmt.Errorf("timed out waiting for port-forward to become ready")
	}

	actualPorts, err := forwarder.GetPorts()
	if err != nil || len(actualPorts) == 0 {
		close(stopCh)
		if err == nil {
			err = errors.New("no ports reported by forwarder")
		}
		return PortForwardInfo{}, err
	}

	id := fmt.Sprintf("pf-%d", atomic.AddUint64(&mgr.counter, 1))
	info := PortForwardInfo{
		ID:         id,
		Context:    contextName,
		Namespace:  namespace,
		PodName:    podName,
		LocalPort:  actualPorts[0].Local,
		RemotePort: actualPorts[0].Remote,
		Status:     "ready",
	}
	sess := &pfSession{info: info, stopCh: stopCh}

	mgr.mu.Lock()
	mgr.sessions[id] = sess
	mgr.mu.Unlock()
	mgr.notify()

	go func() {
		err := <-resultCh
		mgr.mu.Lock()
		s, ok := mgr.sessions[id]
		if ok {
			if err != nil {
				s.info.Status = "error"
				s.info.Error = err.Error()
			} else {
				s.info.Status = "closed"
			}
			delete(mgr.sessions, id)
		}
		mgr.mu.Unlock()
		mgr.notify()
	}()

	return info, nil
}

func (mgr *pfManager) stop(id string) {
	mgr.mu.Lock()
	sess, ok := mgr.sessions[id]
	mgr.mu.Unlock()
	if !ok {
		return
	}
	sess.close()
}

func (mgr *pfManager) list() []PortForwardInfo {
	mgr.mu.Lock()
	out := make([]PortForwardInfo, 0, len(mgr.sessions))
	for _, s := range mgr.sessions {
		out = append(out, s.info)
	}
	mgr.mu.Unlock()
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
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
