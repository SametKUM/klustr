package kube

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	gwclient "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"
)

// Generous enough that a slow link reading the /version body doesn't
// intermittently flag a healthy cluster; latency classification (ok/slow)
// happens frontend-side from the measured round trip.
const pingTimeout = 10 * time.Second

// discoveryTimeout bounds the construction-time discovery probes (Gateway API
// detection, served-resource set). The discovery client's methods take no
// context, so without a rest.Config timeout a hung apiserver would stall Watch
// at watcher construction.
const discoveryTimeout = 8 * time.Second

type ServerVersion struct {
	GitVersion string `json:"gitVersion"`
	Platform   string `json:"platform"`
}

// DeltaOp is the net effect of one key's churn within a debounce window.
type DeltaOp string

const (
	DeltaUpsert DeltaOp = "upsert" // add or update; the frontend keys by namespace/name
	DeltaRemove DeltaOp = "remove"
)

// KindDelta is the per-(context,kind) incremental change set emitted after a
// debounce window. Upserts carry the freshly projected Info struct (PodInfo,
// etc.); Removed carries only "namespace/name" keys. Gen is a per-(context,kind)
// monotonic counter the frontend uses to detect a missed/out-of-order batch and
// fall back to a full refetch. Reset means "I can't describe this incrementally,
// just refetch" (a non-delta-enabled kind, an unprojectable tombstone, or a
// synthetic touch).
type KindDelta struct {
	Upserts []any    `json:"upserts"`
	Removed []string `json:"removed"`
	Gen     uint64   `json:"gen"`
	Reset   bool     `json:"reset,omitempty"`
}

type ContextChange struct {
	Context string
	Kind    string
	// Delta is nil for synthetic touches (_access, post-sync, denied kinds) and
	// for kinds without a projector yet; a nil delta is today's "something
	// changed, refetch" signal.
	Delta *KindDelta
}

// ClientManager is the application-facing handle to every per-context
// resource subsystem: typed clientsets, the watcher pool, logs/exec
// sessions, port-forwards, helm and the metrics cache. Per-kind forwarder
// methods live in manager_<group>.go; this file keeps lifecycle, the
// shared subsystems (logs/exec/portforward/CRD) and the package-private
// watcher / restConfig helpers.
type ClientManager struct {
	mu          sync.Mutex
	rules       *clientcmd.ClientConfigLoadingRules
	cache       map[string]*kubernetes.Clientset
	watchers    map[string]*contextWatcher
	watchLocks  map[string]*sync.Mutex
	logs        *logSessionManager
	execs       *execSessionManager
	terms       *terminalSessionManager
	pf          *pfManager
	metrics     *metricsCache
	helm        *helmManager
	onChange    func(ContextChange)
	readOnly    map[string]bool
	drainMu     sync.Mutex
	draining    map[string]bool
	envReady    chan struct{}
	envOnce     sync.Once
	creds       *credentialManager
	appCtx      context.Context
	credRewatch map[string]bool
}

func NewClientManager() *ClientManager {
	rules := clientcmd.NewDefaultClientConfigLoadingRules()
	helm, _ := newHelmManager(rules)
	m := &ClientManager{
		rules:       rules,
		cache:       make(map[string]*kubernetes.Clientset),
		watchers:    make(map[string]*contextWatcher),
		watchLocks:  make(map[string]*sync.Mutex),
		logs:        newLogSessionManager(),
		execs:       newExecSessionManager(),
		terms:       newTerminalSessionManager(),
		pf:          newPFManager(),
		metrics:     newMetricsCache(),
		helm:        helm,
		readOnly:    make(map[string]bool),
		draining:    make(map[string]bool),
		envReady:    make(chan struct{}),
		creds:       newCredentialManager(),
		credRewatch: make(map[string]bool),
	}
	m.creds.setOnRefreshed(m.onCredentialsRefreshed)
	return m
}

// ImportShellEnv merges the user's login-shell environment into the process
// and unblocks Watch/Ping. The app layer runs it in a goroutine at startup;
// callers that connect before it finishes wait at waitEnvReady so the first
// exec credential helper invocation already sees the merged PATH and config.
func (m *ClientManager) ImportShellEnv() {
	m.envOnce.Do(func() {
		importShellEnv(shellEnvTimeout)
		m.refreshLoadingRules()
		close(m.envReady)
	})
}

// refreshLoadingRules re-derives the kubeconfig search precedence after the
// shell env import: KUBECONFIG may only exist in the login shell, and rules
// snapshotted it at construction. helm shares the same rules pointer, so the
// in-place swap propagates everywhere.
func (m *ClientManager) refreshLoadingRules() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rules.Precedence = clientcmd.NewDefaultClientConfigLoadingRules().Precedence
}

// waitEnvReady blocks until the shell env import finished. The fallback
// timer makes a missing ImportShellEnv call (tests construct the manager
// without the app layer) degrade to a bounded wait instead of a deadlock.
func (m *ClientManager) waitEnvReady(ctx context.Context) {
	select {
	case <-m.envReady:
	case <-ctx.Done():
	case <-time.After(shellEnvTimeout + time.Second):
	}
}

// errReadOnly is returned by every mutating ClientManager method when the
// target context is in read-only mode. It is a hard local guarantee: with no
// in-cluster agent, Klustr itself is the only actor, so refusing to issue the
// write here means no write is issued. This is an accident guard, not a
// security boundary — real enforcement is the cluster's RBAC.
var errReadOnly = errors.New("this context is in read-only mode in Klustr")

// SetReadOnly marks a context read-only (no mutations) or clears it.
func (m *ClientManager) SetReadOnly(contextName string, ro bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if ro {
		m.readOnly[contextName] = true
	} else {
		delete(m.readOnly, contextName)
	}
}

// assertWritable returns errReadOnly when contextName is read-only. Every
// mutating method calls it before touching the cluster.
func (m *ClientManager) assertWritable(contextName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.readOnly[contextName] {
		return errReadOnly
	}
	return nil
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
	// Client-go defaults to QPS=5 / Burst=10, which throttles the 30+
	// parallel SelfSubjectAccessReview calls discoverAccess fires on connect
	// — some probes wait >1s and time out, getting recorded as AccessDenied
	// even when the user does have access. Klustr is a single-user desktop
	// client, so the conservative defaults are wrong; raise them so the
	// access discovery completes in one round-trip and per-resource
	// mutations don't queue behind each other either.
	cfg.QPS = 50
	cfg.Burst = 100
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
	m.waitEnvReady(ctx)
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

// watchLock returns the mutex serializing Watch/StopWatch for one context.
// Wails dispatches every bound call in its own goroutine, so without it two
// concurrent Watch calls would both build informer sets (the loser's leaks),
// and a racing StopWatch could be overwritten by an in-flight Watch.
func (m *ClientManager) watchLock(contextName string) *sync.Mutex {
	m.mu.Lock()
	defer m.mu.Unlock()
	l, ok := m.watchLocks[contextName]
	if !ok {
		l = &sync.Mutex{}
		m.watchLocks[contextName] = l
	}
	return l
}

func (m *ClientManager) Watch(ctx context.Context, contextName string) error {
	m.waitEnvReady(ctx)
	l := m.watchLock(contextName)
	l.Lock()
	defer l.Unlock()
	return m.watchLocked(ctx, contextName)
}

func (m *ClientManager) watchLocked(ctx context.Context, contextName string) error {
	m.mu.Lock()
	if m.appCtx == nil {
		m.appCtx = ctx
		m.creds.setBaseContext(ctx)
	}
	m.mu.Unlock()
	// Auto-capture mapped helper credentials before any client is built. A
	// failure is reported through the credential event stream but does not
	// block the watch — the exec plugin may still succeed on ambient env.
	capturedNow, _ := m.creds.ensureFresh(ctx, contextName)
	if capturedNow {
		// While the capture was pending (a Keychain prompt can hold it for
		// a while), status-bar pings and early frontend fetches may have
		// built and cached a clientset whose exec authenticator never saw
		// the credentials. Drop it so the watch and every later caller get
		// clients with the captured env.
		m.mu.Lock()
		delete(m.cache, contextName)
		m.mu.Unlock()
	}
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
	discoCfg := *cfg
	discoCfg.Timeout = discoveryTimeout
	disco, err := discovery.NewDiscoveryClientForConfig(&discoCfg)
	if err != nil {
		return err
	}
	defaultNS := m.contextDefaultNamespace(contextName)

	m.mu.Lock()
	existing := m.watchers[contextName]
	cb := m.onChange
	m.mu.Unlock()

	w := newContextWatcher(cs, disco, gw, dyn, defaultNS, func(kind string, delta *KindDelta) {
		if cb != nil {
			cb(ContextChange{Context: contextName, Kind: kind, Delta: delta})
		}
	})
	// The old watcher keeps serving (and stays registered) until the new one
	// has synced: start() runs up to ~8s of SSAR probes, and during a re-watch
	// the forwarders would otherwise read a stopped watcher's frozen caches.
	// On start error the live watcher simply stays in place.
	if err := w.start(ctx); err != nil {
		return err
	}

	m.mu.Lock()
	m.watchers[contextName] = w
	firstAttempt := !m.credRewatch[contextName]
	m.mu.Unlock()
	if existing != nil {
		existing.stop()
	}

	// A token-cold first connect can mis-probe access: the exec credential
	// mint (aws eks get-token → STS) races the 40+ parallel SSARs, they
	// exceed the probe timeout and every kind resolves to denied, so the
	// cluster looks empty until a manual reconnect. If a credential-mapped
	// context comes back with no cluster-wide access at all, the exec token
	// is warm now — silently reconnect once so discovery reruns against the
	// hot token. credRewatch guards against a loop (and against punishing a
	// genuinely namespaced-only user with endless reconnects).
	if firstAttempt && !w.access.HasAnyClusterWide() && m.creds.hasMapping(contextName) {
		m.mu.Lock()
		m.credRewatch[contextName] = true
		delete(m.cache, contextName)
		m.mu.Unlock()
		// The metrics and helm clients built during the cold-token window
		// cached a failed exec authenticator too (their lazy first call hit
		// the same 255), so they'd keep reporting metrics-server missing
		// after the watch recovered. Drop them so the reconnect rebuilds
		// every client against the now-warm token — the same scope StopWatch
		// clears, minus the rewatch guard reset.
		m.metrics.invalidate(contextName)
		m.helm.invalidate(contextName)
		// Direct watchLocked call: the caller already holds this context's
		// watch lock and it is not reentrant.
		return m.watchLocked(ctx, contextName)
	}
	// Announce the attach now that the watcher is registered: a frontend list
	// call that raced the watch hit no watcher, got an empty answer and
	// started no informer for its kind — with lazy informer start nothing
	// would ever re-trigger it. The frontend replays every open view's fetch
	// on this event.
	if cb != nil {
		cb(ContextChange{Context: contextName, Kind: "_access"})
	}
	return nil
}

// Shutdown drains every live resource owned by the manager. Wails calls
// it from the OnShutdown hook so port-forwards release their local
// listeners, log streams cancel their apiserver watches, exec sessions
// close their SPDY channels and every contextWatcher stops its informer
// goroutines before the process actually exits.
func (m *ClientManager) Shutdown() {
	m.pf.stopAll()
	m.logs.stopAll()
	m.execs.stopAll()
	m.terms.stopAll()
	m.creds.stopAll()

	m.mu.Lock()
	watchers := m.watchers
	m.watchers = make(map[string]*contextWatcher)
	m.cache = make(map[string]*kubernetes.Clientset)
	m.mu.Unlock()
	for _, w := range watchers {
		w.stop()
	}
}

func (m *ClientManager) StopWatch(contextName string) {
	l := m.watchLock(contextName)
	l.Lock()
	defer l.Unlock()
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	if ok {
		delete(m.watchers, contextName)
	}
	// Drop every per-context client cache too: each one holds a rest.Config
	// snapshot taken when the context first connected, so if the underlying
	// kubeconfig later changed (cluster recreated on a new port, token
	// rotated, …) the next Watch() would otherwise hand back stale clients
	// pointing at the old endpoint and every call would fail.
	delete(m.cache, contextName)
	delete(m.credRewatch, contextName)
	m.mu.Unlock()
	m.metrics.invalidate(contextName)
	m.helm.invalidate(contextName)
	m.creds.pauseRefresh(contextName)
	m.pf.stopForContext(contextName)
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

// AccessibleKinds returns the list of built-in kinds the current user has
// list/watch access to in this context (cluster-wide or namespaced). The
// frontend uses this to hide sidebar entries the user can't see.
func (m *ClientManager) AccessibleKinds(contextName string) []string {
	w, ok := m.watcher(contextName)
	if !ok {
		return []string{}
	}
	return w.access.AccessibleKinds()
}

func (m *ClientManager) restConfig(contextName string) (*rest.Config, error) {
	overrides := &clientcmd.ConfigOverrides{CurrentContext: contextName}
	cfg, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(m.rules, overrides).ClientConfig()
	if err != nil {
		return nil, err
	}
	if cfg.ExecProvider != nil {
		// Captured helper credentials ride into the kubeconfig's exec plugin
		// (aws eks get-token, …) as ambient env. Sorted keys keep the
		// ExecConfig content stable so client-go's exec-authenticator cache
		// (keyed on the full config dump) reuses one authenticator per
		// credential set instead of one per built client.
		env := m.creds.envFor(contextName)
		for _, k := range slices.Sorted(maps.Keys(env)) {
			cfg.ExecProvider.Env = append(cfg.ExecProvider.Env, clientcmdapi.ExecEnvVar{Name: k, Value: env[k]})
		}
	}
	return cfg, nil
}

// onCredentialsRefreshed rebuilds a context's clients after new credentials
// were captured: existing clients hold an exec authenticator that snapshotted
// the old env, so the cache entry is dropped and an active watch restarted
// (Watch swaps the informer set without blanking the frontend caches).
func (m *ClientManager) onCredentialsRefreshed(contextName string) {
	m.mu.Lock()
	delete(m.cache, contextName)
	_, active := m.watchers[contextName]
	appCtx := m.appCtx
	m.mu.Unlock()
	if !active || appCtx == nil {
		return
	}
	// The rebuilt watcher re-runs access discovery with the new credentials;
	// watchLocked announces the swap via "_access" so the frontend re-fetches
	// AccessibleKinds and replays open views.
	_ = m.Watch(appCtx, contextName)
}

// ---- Credential helpers -------------------------------------------------

func (m *ClientManager) SetCredentialEventCallback(cb func(CredentialStatus)) {
	m.creds.setOnEvent(cb)
}

func (m *ClientManager) CredentialProviders() []CredentialProviderInfo {
	return m.creds.providerInfos()
}

func (m *ClientManager) CredentialProfiles(provider string) ([]string, error) {
	return m.creds.profiles(provider)
}

func (m *ClientManager) SetCredentialMapping(contextName, provider, profile string) error {
	return m.creds.setMapping(contextName, CredentialMapping{Provider: provider, Profile: profile})
}

func (m *ClientManager) ClearCredentialMapping(contextName string) error {
	return m.creds.clearMapping(contextName)
}

func (m *ClientManager) CredentialStatuses() []CredentialStatus {
	return m.creds.statuses()
}

// CaptureCredentials force-runs the mapped helper for a context (the manual
// "re-authenticate" action) and rebuilds its clients on success.
func (m *ClientManager) CaptureCredentials(ctx context.Context, contextName string) error {
	m.waitEnvReady(ctx)
	mapping, ok := m.creds.mapping(contextName)
	if !ok {
		return fmt.Errorf("no credential mapping for context %q", contextName)
	}
	if err := m.creds.capture(ctx, contextName, mapping); err != nil {
		return err
	}
	m.onCredentialsRefreshed(contextName)
	return nil
}

// contextDefaultNamespace returns the `namespace:` field of the kubeconfig
// context — usually empty for admin contexts, populated for restricted ones
// like the access-review test SAs. It's the seed value contextWatcher uses
// when probing scoped list access for kinds the user lacks cluster-wide.
func (m *ClientManager) contextDefaultNamespace(contextName string) string {
	raw, err := m.rules.Load()
	if err != nil {
		return ""
	}
	c, ok := raw.Contexts[contextName]
	if !ok || c == nil {
		return ""
	}
	return c.Namespace
}

// ---- Logs / Exec ------------------------------------------------------

func (m *ClientManager) StartLogs(
	parent context.Context,
	contextName, namespace, podName, container string,
	follow, previous bool,
	tailLines int64,
	onBatch LogBatchFunc,
	onClose LogCloseFunc,
) (string, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", err
	}
	return m.logs.start(parent, cs, namespace, podName, container, follow, previous, tailLines, onBatch, onClose)
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

// ---- Local terminal ---------------------------------------------------

func (m *ClientManager) StartLocalTerminal(
	parent context.Context,
	contextName string,
	cols, rows uint16,
	onData TerminalDataFunc,
	onClose TerminalCloseFunc,
) (string, error) {
	return m.terms.start(parent, m.rules, contextName, cols, rows, onData, onClose)
}

func (m *ClientManager) SendLocalTerminalInput(sessionID, data string) {
	m.terms.sendInput(sessionID, data)
}

func (m *ClientManager) ResizeLocalTerminal(sessionID string, cols, rows uint16) {
	m.terms.resize(sessionID, cols, rows)
}

func (m *ClientManager) StopLocalTerminal(sessionID string) {
	m.terms.stop(sessionID)
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
