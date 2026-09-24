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

// rewatchRetryDelay is the backoff before the single automatic retry of a
// re-watch that failed right after a credential refresh (a transient blip).
const rewatchRetryDelay = 3 * time.Second

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

// KindDelta is one debounce window's incremental change set for a
// (context, kind). Removed carries "namespace/name" keys. Gen is a monotonic
// per-(context, kind) counter; a gap tells the frontend to refetch. Reset means
// "refetch" too: a kind without a projector, an unprojectable tombstone or a
// synthetic touch.
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
	// for kinds without a projector; nil means "something changed, refetch".
	Delta *KindDelta
}

// ClientManager is the application-facing handle to every per-context
// subsystem: clientsets, the watcher pool, logs/exec sessions, port-forwards,
// helm and the metrics cache.
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
	creds := newCredentialManager()
	helm, _ := newHelmManager(rules, creds)
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
		creds:       creds,
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
		// The search precedence may now include a KUBECONFIG that existed only
		// in the login shell; tell the Welcome screen to re-list contexts.
		m.emitContextsChanged()
	})
}

// contextsChangedKind is a synthetic kube:change kind (no associated context)
// emitted when the kubeconfig loading rules change, e.g. after the shell-env
// import. The Welcome screen re-lists contexts on it.
const contextsChangedKind = "_contexts"

func (m *ClientManager) emitContextsChanged() {
	m.mu.Lock()
	cb := m.onChange
	m.mu.Unlock()
	if cb != nil {
		cb(ContextChange{Kind: contextsChangedKind})
	}
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
	// Read a lock-guarded snapshot of the loading rules: this stays fast (a local
	// file read, no waiting on the shell-env import) yet does not race
	// refreshLoadingRules, which rewrites m.rules.Precedence under m.mu. When the
	// import finishes it emits _contexts so the Welcome screen re-lists and picks
	// up a KUBECONFIG defined only in the login shell.
	m.mu.Lock()
	rules := *m.rules
	m.mu.Unlock()
	return loadRawConfig(&rules)
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
	// client-go's QPS=5 / Burst=10 throttles the parallel SSARs discoverAccess
	// fires on connect: probes time out and are recorded as denied even when
	// the user has access. A single-user desktop client can afford far more.
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
	return m.watchLocked(ctx, contextName, false)
}

// watchLocked (re)builds a context's watcher under its watch lock. reuseAccess
// carries the prior watcher's RBAC map into the new one — set only on a pure
// credential refresh, where the identity (and thus access) is unchanged, to
// skip the ~50-probe discoverAccess storm. A user attach or a cold-token retry
// passes false so access is rediscovered against the (possibly warm) token.
func (m *ClientManager) watchLocked(ctx context.Context, contextName string, reuseAccess bool) error {
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
	// The prior watcher's access map is immutable after its start(), so reusing
	// it lets start() skip discoverAccess. Informers still start cold, so the
	// frontend re-LISTs open views on _access.
	if reuseAccess && existing != nil {
		w.access = existing.access
		w.reuseGatewayAccess(existing)
	}
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

	// A token-cold first connect can mis-probe access: minting the exec token
	// (aws eks get-token → STS) races the parallel SSARs, they time out and
	// every kind resolves to denied. If a credential-mapped context comes back
	// with no cluster-wide access, reconnect once against the now-warm token;
	// credRewatch keeps a genuinely namespaced-only user from looping.
	if firstAttempt && !w.access.HasAnyClusterWide() && m.creds.hasMapping(contextName) {
		m.mu.Lock()
		m.credRewatch[contextName] = true
		delete(m.cache, contextName)
		m.mu.Unlock()
		// Metrics and helm clients built in the cold-token window cached the
		// failed exec authenticator too and would keep reporting metrics-server
		// missing; drop them so the retry rebuilds every client.
		m.metrics.invalidate(contextName)
		m.helm.invalidate(contextName)
		// Direct watchLocked call: the caller already holds this context's
		// watch lock and it is not reentrant. Rediscover access — the retry
		// exists precisely because the cold-token probe under-reported it.
		return m.watchLocked(ctx, contextName, false)
	}
	// A list call that raced the watch found no watcher and started no
	// informer, and with lazy start nothing else would retrigger it. The
	// frontend replays every open view's fetch on this event.
	if cb != nil {
		cb(ContextChange{Context: contextName, Kind: "_access"})
	}
	return nil
}

// Shutdown stops every port-forward, stream, session and watcher the manager
// owns. Wails calls it from the OnShutdown hook.
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
	// Cached clients hold the rest.Config from first connect; drop them so a
	// changed kubeconfig (new endpoint, rotated token) takes effect on the
	// next Watch.
	delete(m.cache, contextName)
	delete(m.credRewatch, contextName)
	m.mu.Unlock()
	m.metrics.invalidate(contextName)
	m.helm.invalidate(contextName)
	m.creds.pauseRefresh(contextName)
	m.pf.stopForContext(contextName)
	// Log streams / exec sessions / node shells / local terminals captured the
	// pre-disconnect client at start(), so they keep their apiserver watch or
	// SPDY channel open unless torn down explicitly here.
	m.logs.stopForContext(contextName)
	m.execs.stopForContext(contextName)
	m.terms.stopForContext(contextName)
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
	out := append([]string{}, w.access.AccessibleKinds()...)
	return append(out, w.accessibleGatewayKinds()...)
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
	m.rewatchAfterRefresh(contextName, true)
}

// rewatchAfterRefresh rebuilds a context's clients after new credentials were
// captured, retrying once to ride out a transient blip. A final failure goes
// to the credential channel so the user gets a Retry; silently keeping the old
// watcher would freeze updates once its session expires, while the status dot
// (which pings with fresh clients) stays green.
func (m *ClientManager) rewatchAfterRefresh(contextName string, allowRetry bool) {
	// Helm builds its own rest.Config from a cached action.Configuration; drop
	// it so the next Helm op rebuilds with the freshly captured credentials.
	m.helm.invalidate(contextName)
	m.metrics.invalidate(contextName)
	m.mu.Lock()
	delete(m.cache, contextName)
	appCtx := m.appCtx
	m.mu.Unlock()
	if appCtx == nil {
		return
	}
	if err := m.rewatchIfActive(appCtx, contextName); err != nil {
		if allowRetry {
			time.AfterFunc(rewatchRetryDelay, func() { m.rewatchAfterRefresh(contextName, false) })
			return
		}
		_ = m.creds.fail(contextName, fmt.Sprintf("reconnect after credential refresh failed: %v", err))
	}
}

// rewatchIfActive rebuilds the watch only if the context is still attached, so
// a racing StopWatch is not undone; a detached context returns nil. It calls
// watchLocked under the lock it holds because Watch would re-lock.
func (m *ClientManager) rewatchIfActive(appCtx context.Context, contextName string) error {
	l := m.watchLock(contextName)
	l.Lock()
	defer l.Unlock()
	m.mu.Lock()
	_, active := m.watchers[contextName]
	m.mu.Unlock()
	if !active {
		return nil
	}
	return m.watchLocked(appCtx, contextName, true)
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
	return m.logs.start(parent, cs, contextName, namespace, podName, container, follow, previous, tailLines, onBatch, onClose)
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
	return m.execs.start(parent, cfg, cs, contextName, namespace, podName, container, command, onData, onClose)
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
	return m.pf.start(contextName, namespace, podName, func(ctx context.Context, readyCh chan struct{}) (portForwarder, error) {
		cs, err := m.Clientset(contextName)
		if err != nil {
			return nil, err
		}
		cfg, err := m.restConfig(contextName)
		if err != nil {
			return nil, err
		}
		return newPortForwarder(ctx, cs, cfg, namespace, podName, localPort, remotePort, readyCh)
	})
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
