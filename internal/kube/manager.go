package kube

import (
	"context"
	"fmt"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	gwclient "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"
)

const pingTimeout = 5 * time.Second

type ServerVersion struct {
	GitVersion string `json:"gitVersion"`
	Platform   string `json:"platform"`
}

type ContextChange struct {
	Context string
	Kind    string
}

// ClientManager is the application-facing handle to every per-context
// resource subsystem: typed clientsets, the watcher pool, logs/exec
// sessions, port-forwards, helm and the metrics cache. Per-kind forwarder
// methods live in manager_<group>.go; this file keeps lifecycle, the
// shared subsystems (logs/exec/portforward/CRD) and the package-private
// watcher / restConfig helpers.
type ClientManager struct {
	mu       sync.Mutex
	rules    *clientcmd.ClientConfigLoadingRules
	cache    map[string]*kubernetes.Clientset
	watchers map[string]*contextWatcher
	logs     *logSessionManager
	execs    *execSessionManager
	pf       *pfManager
	metrics  *metricsCache
	helm     *helmManager
	onChange func(ContextChange)
}

func NewClientManager() *ClientManager {
	rules := clientcmd.NewDefaultClientConfigLoadingRules()
	helm, _ := newHelmManager(rules)
	return &ClientManager{
		rules:    rules,
		cache:    make(map[string]*kubernetes.Clientset),
		watchers: make(map[string]*contextWatcher),
		logs:     newLogSessionManager(),
		execs:    newExecSessionManager(),
		pf:       newPFManager(),
		metrics:  newMetricsCache(),
		helm:     helm,
	}
}

func (m *ClientManager) SetPFChangeCallback(cb func()) {
	m.pf.setOnChange(cb)
}

func (m *ClientManager) SetOnChange(cb func(ContextChange)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onChange = cb
}

func (m *ClientManager) Kubeconfig() (*Kubeconfig, error) {
	return loadRawConfig(m.rules)
}

func (m *ClientManager) Clientset(contextName string) (*kubernetes.Clientset, error) {
	m.mu.Lock()
	if cs, ok := m.cache[contextName]; ok {
		m.mu.Unlock()
		return cs, nil
	}
	m.mu.Unlock()

	cfg, err := m.restConfig(contextName)
	if err != nil {
		return nil, err
	}
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.cache[contextName] = cs
	m.mu.Unlock()
	return cs, nil
}

func (m *ClientManager) Ping(ctx context.Context, contextName string) (*ServerVersion, error) {
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return nil, err
	}
	cfgCopy := *cfg
	cfgCopy.Timeout = pingTimeout

	cs, err := kubernetes.NewForConfig(&cfgCopy)
	if err != nil {
		return nil, err
	}

	type result struct {
		v   *ServerVersion
		err error
	}
	done := make(chan result, 1)
	go func() {
		info, err := cs.Discovery().ServerVersion()
		if err != nil {
			done <- result{nil, err}
			return
		}
		done <- result{&ServerVersion{GitVersion: info.GitVersion, Platform: info.Platform}, nil}
	}()

	select {
	case r := <-done:
		return r.v, r.err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (m *ClientManager) Watch(ctx context.Context, contextName string) error {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return err
	}
	gw, err := gwclient.NewForConfig(cfg)
	if err != nil {
		return err
	}

	m.mu.Lock()
	if existing, ok := m.watchers[contextName]; ok {
		m.mu.Unlock()
		existing.stop()
		m.mu.Lock()
	}
	cb := m.onChange
	m.mu.Unlock()

	w := newContextWatcher(cs, gw, dyn, func(kind string) {
		if cb != nil {
			cb(ContextChange{Context: contextName, Kind: kind})
		}
	})
	if err := w.start(ctx); err != nil {
		return err
	}

	m.mu.Lock()
	m.watchers[contextName] = w
	m.mu.Unlock()
	return nil
}

func (m *ClientManager) StopWatch(contextName string) {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	if ok {
		delete(m.watchers, contextName)
	}
	m.mu.Unlock()
	if ok {
		w.stop()
	}
}

// watcher returns the active contextWatcher under the lock and is used by
// every per-kind forwarder in manager_<group>.go.
func (m *ClientManager) watcher(contextName string) (*contextWatcher, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	w, ok := m.watchers[contextName]
	return w, ok
}

func (m *ClientManager) restConfig(contextName string) (*rest.Config, error) {
	overrides := &clientcmd.ConfigOverrides{CurrentContext: contextName}
	return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(m.rules, overrides).ClientConfig()
}

// ---- Logs / Exec ------------------------------------------------------

func (m *ClientManager) StartLogs(
	parent context.Context,
	contextName, namespace, podName, container string,
	follow bool,
	tailLines int64,
	onLine LogLineFunc,
	onClose LogCloseFunc,
) (string, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", err
	}
	return m.logs.start(parent, cs, namespace, podName, container, follow, tailLines, onLine, onClose)
}

func (m *ClientManager) StopLogs(id string) {
	m.logs.stop(id)
}

func (m *ClientManager) StartExec(
	parent context.Context,
	contextName, namespace, podName, container string,
	command []string,
	onData ExecDataFunc,
	onClose ExecCloseFunc,
) (string, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", err
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return "", err
	}
	return m.execs.start(parent, cfg, cs, namespace, podName, container, command, onData, onClose)
}

func (m *ClientManager) SendExecInput(sessionID, data string) {
	m.execs.sendInput(sessionID, data)
}

func (m *ClientManager) ResizeExec(sessionID string, cols, rows uint16) {
	m.execs.resize(sessionID, cols, rows)
}

func (m *ClientManager) StopExec(sessionID string) {
	m.execs.stop(sessionID)
}

// ---- Port-forward ------------------------------------------------------

func (m *ClientManager) StartPortForward(contextName, namespace, podName string, localPort, remotePort uint16) (PortForwardInfo, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return PortForwardInfo{}, err
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return PortForwardInfo{}, err
	}
	return m.pf.start(contextName, cs, cfg, namespace, podName, localPort, remotePort)
}

func (m *ClientManager) StopPortForward(id string) {
	m.pf.stop(id)
}

func (m *ClientManager) ListPortForwards() []PortForwardInfo {
	return m.pf.list()
}

// ---- CRD / Custom Resources -------------------------------------------

func (m *ClientManager) CRDs(contextName string) []CRDInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []CRDInfo{}
	}
	return w.crd.CRDs()
}

func (m *ClientManager) EnsureCRWatch(contextName, group, version, resource string) error {
	w, ok := m.watcher(contextName)
	if !ok {
		return fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.crd.EnsureCRWatch(schema.GroupVersionResource{Group: group, Version: version, Resource: resource})
}

func (m *ClientManager) CustomResources(contextName, group, version, resource, namespace string) []CustomResourceInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []CustomResourceInfo{}
	}
	return w.crd.ListCustomResources(schema.GroupVersionResource{Group: group, Version: version, Resource: resource}, namespace)
}

func (m *ClientManager) CustomResource(ctx context.Context, contextName, group, version, resource, namespace, name string) (*unstructured.Unstructured, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.crd.GetCustomResource(ctx, schema.GroupVersionResource{Group: group, Version: version, Resource: resource}, namespace, name)
}
