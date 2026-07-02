package kube

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"

	gwclient "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"
	gwinformers "sigs.k8s.io/gateway-api/pkg/client/informers/externalversions"
)

const debounceWindow = 100 * time.Millisecond

// OwnerRef is the trimmed shape of an OwnerReference embedded in Info/Detail
// payloads. We never need the full UID/Controller fields on the client.
type OwnerRef struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// controllerOwnerRef returns the controlling OwnerReference (Controller=true)
// trimmed to OwnerRef, or nil when none of the refs is a controller.
func controllerOwnerRef(refs []metav1.OwnerReference) *OwnerRef {
	for _, o := range refs {
		if o.Controller != nil && *o.Controller {
			return &OwnerRef{Kind: o.Kind, Name: o.Name}
		}
	}
	return nil
}

// ConditionDetail is the per-condition shape used across PodDetail,
// DeploymentDetail, PDB/HPA/PVC/ReplicaSet/Node detail bodies.
type ConditionDetail struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason"`
	Message string `json:"message"`
}

type ChangeFunc func(kind string, delta *KindDelta)

// pendingItem is the latest net op buffered for one (namespace/name) key within
// a debounce window; info is the projected struct for an upsert, nil for a remove.
type pendingItem struct {
	op   DeltaOp
	info any
}

// pendingKind buffers one kind's churn within a window. touched marks an event
// that can't be described incrementally (no projector, unprojectable tombstone,
// post-sync/denied touch) ⇒ the flushed delta is a Reset (full refetch).
type pendingKind struct {
	items   map[string]pendingItem
	touched bool
}

// contextWatcher owns up to two SharedInformerFactories — one all-namespaces
// (`factory`) and one optional namespaced fallback (`scoped`) — plus the
// Gateway-API factory, a debounce queue and the lifecycle context. The
// access map decides which factory each kind belongs to so a restricted
// user (e.g., the kubeconfig user only has list+watch in namespace `prod`)
// still gets live data for the kinds they CAN see, without the all-ns
// list call that would 403 and silently leave the cache empty.
//
// Per-kind type definitions and lister methods live in informers_<group>.go
// files; the kind → informer routing table stays here in kindBindings so it
// is auditable in one place. Informers start lazily on first use
// (factoryFor → ensureKind); only Namespace and Pod start eagerly on attach.
type contextWatcher struct {
	factory        informers.SharedInformerFactory // cluster-wide; nil when user has no cluster-wide list at all
	scoped         informers.SharedInformerFactory // namespaced fallback; nil when no kind needs it
	access         *contextAccess                  // per-kind routing decisions; nil ⇒ assume cluster-wide
	defaultNS      string                          // kubeconfig context.namespace, used as the scoped probe target
	cs             kubernetes.Interface            // kept around for SelfSubjectAccessReview
	disco          discovery.DiscoveryInterface    // timeout-bounded; used for construction-time probes
	gwFactory      gwinformers.SharedInformerFactory
	refGrantVer    string // served referencegrants version ("v1"/"v1beta1"), "" when not served
	apiSvcFactory  dynamicinformer.DynamicSharedInformerFactory
	apiSvcInformer cache.SharedIndexInformer
	dyn            dynamic.Interface
	crd            *crdWatcher
	onChange       ChangeFunc
	cancel         context.CancelFunc
	stopCh         <-chan struct{}

	startMu  sync.Mutex
	bindings map[string]kindBinding
	started  map[string]bool

	mu      sync.Mutex
	pending map[string]*pendingKind
	gen     map[string]uint64 // per-kind monotonic delta generation
	timer   *time.Timer
	stopped bool
}

func newContextWatcher(cs *kubernetes.Clientset, disco discovery.DiscoveryInterface, gw gwclient.Interface, dyn dynamic.Interface, defaultNS string, onChange ChangeFunc) *contextWatcher {
	w := &contextWatcher{
		cs:        cs,
		disco:     disco,
		dyn:       dyn,
		defaultNS: defaultNS,
		onChange:  onChange,
		pending:   make(map[string]*pendingKind),
		gen:       make(map[string]uint64),
	}
	if gw != nil && hasGatewayAPIGroup(disco) {
		w.gwFactory = gwinformers.NewSharedInformerFactory(gw, 0)
		w.refGrantVer = refGrantsVersion(disco)
	}
	return w
}

// factoryFor returns the informer factory that owns the given kind, or nil
// when the user has no access. Listers and detail Get paths call this so a
// single helper carries the routing logic instead of every method making
// the cluster-vs-scoped decision inline. It is also the lazy-start
// chokepoint: the kind's informer is registered and started on first use,
// so attach cost no longer includes a cluster-wide LIST for every kind the
// user never opens.
func (w *contextWatcher) factoryFor(kind string) informers.SharedInformerFactory {
	w.ensureKind(kind)
	return w.routedFactory(kind)
}

func (w *contextWatcher) routedFactory(kind string) informers.SharedInformerFactory {
	if w.access == nil {
		return w.factory
	}
	switch w.access.For(kind).Mode {
	case AccessCluster:
		return w.factory
	case AccessNamespaced:
		return w.scoped
	default:
		return nil
	}
}

// ensureKind registers and starts the informer backing a kind the first time
// anything asks for it, then touches the kind once its cache has synced so
// the frontend's skeleton/synced gate works exactly as it did with eager
// informers.
func (w *contextWatcher) ensureKind(kind string) {
	w.startMu.Lock()
	defer w.startMu.Unlock()
	if w.started == nil || w.started[kind] {
		return
	}
	w.started[kind] = true
	b, ok := w.bindings[kind]
	if !ok {
		return
	}
	f := w.routedFactory(kind)
	if f == nil {
		// Denied kinds get no informer; an immediate touch flips the
		// frontend's synced flag so the empty list shows without waiting
		// for the skeleton grace timer.
		w.touch(kind)
		return
	}
	informer := b.pick(f)
	if b.indexers != nil {
		// Precedes Start (AddIndexers rejects a running informer); the informer
		// is freshly registered here so it can't be running yet. A failure is
		// non-fatal — PodsOnNode falls back to a full scan without the index.
		_ = informer.AddIndexers(b.indexers)
	}
	_, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(obj any) { w.record(kind, b, DeltaUpsert, obj); callIf(b.sidecar, obj) },
		UpdateFunc: func(_, obj any) { w.record(kind, b, DeltaUpsert, obj); callIf(b.sidecar, obj) },
		DeleteFunc: func(obj any) { w.record(kind, b, DeltaRemove, obj); callIf(b.sidecar, obj) },
	})
	if err != nil {
		return
	}
	// Start only spins up informers not yet running, so repeated calls per
	// lazily-added kind are safe.
	f.Start(w.stopCh)
	go func() {
		if cache.WaitForCacheSync(w.stopCh, informer.HasSynced) {
			w.touch(kind)
		}
	}()
}

func (w *contextWatcher) start(parent context.Context) error {
	ctx, cancel := context.WithCancel(parent)
	w.cancel = cancel

	w.access = discoverAccess(ctx, w.cs, w.disco, w.defaultNS)
	if w.access.HasAnyClusterWide() {
		w.factory = informers.NewSharedInformerFactoryWithOptions(
			w.cs.(*kubernetes.Clientset), 0,
			informers.WithTransform(stripManagedFields),
		)
	}
	if scopedNS := w.access.ScopedNamespace(); scopedNS != "" {
		w.scoped = informers.NewSharedInformerFactoryWithOptions(
			w.cs.(*kubernetes.Clientset), 0,
			informers.WithNamespace(scopedNS),
			informers.WithTransform(stripManagedFields),
		)
	}

	w.crd = newCRDWatcher(w.dyn, ctx.Done(), w.touch)
	// Skip the cluster-wide CRD watcher when the user can't list CRDs —
	// otherwise client-go's reflector retries on a tight loop and floods
	// the log with 403s.
	if ok, _ := canList(ctx, w.cs, crdGVR, ""); ok {
		if err := w.crd.start(); err != nil {
			cancel()
			return err
		}
		go w.warmKEDA(ctx)
	}

	w.stopCh = ctx.Done()
	w.bindings = kindBindings(w)
	w.started = make(map[string]bool)

	if err := w.startGatewayInformers(ctx); err != nil {
		cancel()
		return err
	}

	if err := w.startAPIServiceInformer(ctx); err != nil {
		cancel()
		return err
	}

	// Only what every session needs immediately starts eagerly: the
	// namespace selector and the default pods view. Every other kind's
	// informer starts on first use (factoryFor → ensureKind), so attaching
	// to a large cluster over a slow link no longer pays ~50 cluster-wide
	// LISTs up front.
	w.ensureKind("Namespace")
	w.ensureKind("Pod")

	go cleanupStaleNodeShellPods(ctx, w.cs)
	return nil
}

// kindBinding describes how to obtain a kind's informer from its routed
// factory, plus an optional per-event sidecar (currently Secret → Helm).
type kindBinding struct {
	pick     func(informers.SharedInformerFactory) cache.SharedIndexInformer
	sidecar  func(obj any)
	indexers cache.Indexers

	// project turns a cached object into its frontend Info struct plus a
	// "namespace/name" key, for the delta-update protocol. nil ⇒ the kind has
	// no delta support yet and its handler degrades to a bare touch (a Reset
	// delta), so a partial rollout is safe.
	project func(obj any) (key string, info any, ok bool)
}

// projector builds a kindBinding.project from a single-object Info constructor,
// so a kind wires delta support in one line: project: projector(xInfoFrom).
// Cluster-scoped kinds get an empty namespace, so their key is "/name" — the
// same shape the frontend keys by.
func projector[T metav1.Object, I any](from func(T) I) func(obj any) (string, any, bool) {
	return func(obj any) (string, any, bool) {
		t, ok := obj.(T)
		if !ok {
			return "", nil, false
		}
		return t.GetNamespace() + "/" + t.GetName(), from(t), true
	}
}

// kindBindings is the auditable routing table mapping every covered kind to
// its informer constructor. Registration and start happen lazily per kind in
// ensureKind; this table only declares what exists.
func kindBindings(w *contextWatcher) map[string]kindBinding {
	type binding struct {
		kind     string
		informer func(informers.SharedInformerFactory) cache.SharedIndexInformer
	}
	bindings := []binding{
		{"Pod", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().Pods().Informer()
		}},
		{"Namespace", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().Namespaces().Informer()
		}},
		{"Deployment", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Apps().V1().Deployments().Informer()
		}},
		{"Service", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().Services().Informer()
		}},
		{"ConfigMap", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().ConfigMaps().Informer()
		}},
		{"StatefulSet", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Apps().V1().StatefulSets().Informer()
		}},
		{"DaemonSet", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Apps().V1().DaemonSets().Informer()
		}},
		{"Job", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Batch().V1().Jobs().Informer()
		}},
		{"CronJob", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Batch().V1().CronJobs().Informer()
		}},
		{"ReplicationController", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().ReplicationControllers().Informer()
		}},
		{"Endpoints", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().Endpoints().Informer()
		}},
		{"ValidatingWebhookConfiguration", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Admissionregistration().V1().ValidatingWebhookConfigurations().Informer()
		}},
		{"MutatingWebhookConfiguration", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Admissionregistration().V1().MutatingWebhookConfigurations().Informer()
		}},
		{"Lease", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Coordination().V1().Leases().Informer()
		}},
		{"RuntimeClass", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Node().V1().RuntimeClasses().Informer()
		}},
		{"PriorityClass", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Scheduling().V1().PriorityClasses().Informer()
		}},
		{"IngressClass", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Networking().V1().IngressClasses().Informer()
		}},
		{"LimitRange", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().LimitRanges().Informer()
		}},
		{"ResourceQuota", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().ResourceQuotas().Informer()
		}},
		{"EndpointSlice", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Discovery().V1().EndpointSlices().Informer()
		}},
		{"PodDisruptionBudget", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Policy().V1().PodDisruptionBudgets().Informer()
		}},
		{"HorizontalPodAutoscaler", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Autoscaling().V2().HorizontalPodAutoscalers().Informer()
		}},
		{"NetworkPolicy", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Networking().V1().NetworkPolicies().Informer()
		}},
		{"StorageClass", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Storage().V1().StorageClasses().Informer()
		}},
		{"PersistentVolume", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().PersistentVolumes().Informer()
		}},
		{"PersistentVolumeClaim", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().PersistentVolumeClaims().Informer()
		}},
		{"ReplicaSet", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Apps().V1().ReplicaSets().Informer()
		}},
		{"Ingress", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Networking().V1().Ingresses().Informer()
		}},
		{"Node", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().Nodes().Informer()
		}},
		{"ServiceAccount", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().ServiceAccounts().Informer()
		}},
		{"Role", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Rbac().V1().Roles().Informer()
		}},
		{"RoleBinding", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Rbac().V1().RoleBindings().Informer()
		}},
		{"ClusterRole", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Rbac().V1().ClusterRoles().Informer()
		}},
		{"ClusterRoleBinding", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Rbac().V1().ClusterRoleBindings().Informer()
		}},
		{"CertificateSigningRequest", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Certificates().V1().CertificateSigningRequests().Informer()
		}},
		{"CSIDriver", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Storage().V1().CSIDrivers().Informer()
		}},
		{"CSINode", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Storage().V1().CSINodes().Informer()
		}},
		{"VolumeAttachment", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Storage().V1().VolumeAttachments().Informer()
		}},
		{"FlowSchema", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Flowcontrol().V1().FlowSchemas().Informer()
		}},
		{"PriorityLevelConfiguration", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Flowcontrol().V1().PriorityLevelConfigurations().Informer()
		}},
		{"ValidatingAdmissionPolicy", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Admissionregistration().V1().ValidatingAdmissionPolicies().Informer()
		}},
		{"ValidatingAdmissionPolicyBinding", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Admissionregistration().V1().ValidatingAdmissionPolicyBindings().Informer()
		}},
		{"MutatingAdmissionPolicy", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Admissionregistration().V1().MutatingAdmissionPolicies().Informer()
		}},
		{"MutatingAdmissionPolicyBinding", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Admissionregistration().V1().MutatingAdmissionPolicyBindings().Informer()
		}},
		{"DeviceClass", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Resource().V1().DeviceClasses().Informer()
		}},
		{"ResourceClaim", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Resource().V1().ResourceClaims().Informer()
		}},
		{"ResourceClaimTemplate", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Resource().V1().ResourceClaimTemplates().Informer()
		}},
		{"ResourceSlice", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Resource().V1().ResourceSlices().Informer()
		}},
		{"ServiceCIDR", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Networking().V1().ServiceCIDRs().Informer()
		}},
		{"IPAddress", func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Networking().V1().IPAddresses().Informer()
		}},
	}

	out := make(map[string]kindBinding, len(bindings)+1)
	for _, b := range bindings {
		out[b.kind] = kindBinding{pick: b.informer}
	}

	// Pod carries a by-node index so node detail resolves its pods without
	// scanning the whole pod cache, plus a projector so it is the delta-update
	// pilot kind.
	if pod, ok := out["Pod"]; ok {
		pod.indexers = podIndexers
		pod.project = projectPod
		out["Pod"] = pod
	}

	// Delta-update projectors for the high-churn / high-count kinds. Low-
	// cardinality kinds (cluster-scoped singletons, RBAC, admission, …) stay on
	// the full-refetch path: a delta there is churn without payoff.
	setProject := func(kind string, p func(obj any) (string, any, bool)) {
		if b, ok := out[kind]; ok {
			b.project = p
			out[kind] = b
		}
	}
	setProject("Deployment", projector(deploymentInfoFrom))
	setProject("StatefulSet", projector(statefulSetInfoFrom))
	setProject("DaemonSet", projector(daemonSetInfoFrom))
	setProject("ReplicaSet", projector(replicaSetInfoFrom))
	setProject("ReplicationController", projector(replicationControllerInfoFrom))
	setProject("Job", projector(jobInfoFrom))
	setProject("CronJob", projector(cronJobInfoFrom))
	setProject("ConfigMap", projector(configMapInfoFrom))
	setProject("Service", projector(serviceInfoFrom))
	setProject("Endpoints", projector(endpointsInfoFrom))
	setProject("EndpointSlice", projector(endpointSliceInfoFrom))
	setProject("Ingress", projector(ingressInfoFrom))
	setProject("NetworkPolicy", projector(networkPolicyInfoFrom))
	setProject("Node", projector(nodeInfo))
	setProject("Lease", projector(leaseInfoFrom))

	// Secret carries a Helm-release piggyback so the Helm UI updates when a
	// release Secret lands; that's why this binding sits outside the table.
	out["Secret"] = kindBinding{
		pick: func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().Secrets().Informer()
		},
		sidecar: func(obj any) { maybeTouchHelm(obj, w) },
		project: projector(secretInfoFrom),
	}
	return out
}

func callIf(fn func(obj any), obj any) {
	if fn != nil {
		fn(obj)
	}
}

// errKindNoAccess is the canonical error returned by Get methods when the
// caller's RBAC doesn't include the kind. Returned to the frontend so the
// UI can show "Forbidden" instead of a generic load failure.
func errKindNoAccess(kind string) error {
	return fmt.Errorf("no list/watch access for %s in this context", kind)
}

func (w *contextWatcher) stop() {
	if w.cancel != nil {
		w.cancel()
	}
	w.mu.Lock()
	w.stopped = true
	if w.timer != nil {
		w.timer.Stop()
		w.timer = nil
	}
	w.pending = make(map[string]*pendingKind)
	w.mu.Unlock()
}

// pendingKindLocked returns (creating if needed) the buffer for a kind. Caller
// must hold w.mu.
func (w *contextWatcher) pendingKindLocked(kind string) *pendingKind {
	pk := w.pending[kind]
	if pk == nil {
		pk = &pendingKind{items: make(map[string]pendingItem)}
		w.pending[kind] = pk
	}
	return pk
}

// armTimerLocked starts the debounce timer if it isn't already running. Caller
// must hold w.mu.
func (w *contextWatcher) armTimerLocked() {
	if w.timer == nil {
		w.timer = time.AfterFunc(debounceWindow, w.flush)
	}
}

// touch marks a kind as changed in a way that can't be described incrementally
// (post-sync, denied kind, CRD/Gateway events). The flushed delta is a Reset, so
// the frontend refetches — exactly the pre-delta behavior. Keeps the func(string)
// shape so existing callbacks (crdWatcher) wire in unchanged.
func (w *contextWatcher) touch(kind string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.stopped {
		return
	}
	w.pendingKindLocked(kind).touched = true
	w.armTimerLocked()
}

// record buffers a single informer event as a net delta op. The projection runs
// here, on the informer goroutine, while the cache object is valid; only the
// projected struct + key cross into the buffer. Kinds without a projector, and
// unprojectable tombstones, degrade to touch (a Reset/refetch).
func (w *contextWatcher) record(kind string, b kindBinding, op DeltaOp, obj any) {
	if b.project == nil {
		w.touch(kind)
		return
	}
	if op == DeltaRemove {
		if tomb, isTomb := obj.(cache.DeletedFinalStateUnknown); isTomb {
			obj = tomb.Obj
		}
	}
	key, info, ok := b.project(obj)
	if !ok {
		w.touch(kind)
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.stopped {
		return
	}
	pk := w.pendingKindLocked(kind)
	// Latest op wins: an upsert carries the freshest projection and supersedes a
	// prior remove; a remove supersedes a prior upsert (a born-and-died key flushes
	// as a remove, which the frontend no-ops when the key is absent).
	if op == DeltaUpsert {
		pk.items[key] = pendingItem{op: DeltaUpsert, info: info}
	} else {
		pk.items[key] = pendingItem{op: DeltaRemove}
	}
	w.armTimerLocked()
}

func (w *contextWatcher) flush() {
	w.mu.Lock()
	// A timer that already fired can run flush after stop(); don't emit change
	// events for a detached context.
	if w.stopped {
		w.mu.Unlock()
		return
	}
	pending := w.pending
	w.pending = make(map[string]*pendingKind)
	w.timer = nil
	cb := w.onChange
	deltas := make(map[string]*KindDelta, len(pending))
	for kind, pk := range pending {
		w.gen[kind]++
		g := w.gen[kind]
		// touched supersedes any buffered items: if part of the window couldn't be
		// described incrementally, refetch the whole kind.
		if pk.touched {
			deltas[kind] = &KindDelta{Gen: g, Reset: true}
			continue
		}
		d := &KindDelta{Gen: g, Upserts: []any{}, Removed: []string{}}
		for key, it := range pk.items {
			if it.op == DeltaRemove {
				d.Removed = append(d.Removed, key)
			} else {
				d.Upserts = append(d.Upserts, it.info)
			}
		}
		deltas[kind] = d
	}
	w.mu.Unlock()

	if cb == nil {
		return
	}
	for kind, d := range deltas {
		cb(kind, d)
	}
}

// sortByNamespaceName sorts an arbitrary slice in place by (namespace, name)
// using a supplied accessor. Cluster-scoped Info types use plain sort.Slice
// on Name directly instead of this generic helper.
func sortByNamespaceName[T any](slice []T, key func(int) (string, string)) {
	sort.Slice(slice, func(i, j int) bool {
		ni, n := key(i)
		nj, m := key(j)
		if ni != nj {
			return ni < nj
		}
		return n < m
	})
}

// toInt64 coerces a dynamic-client JSON number (which deserializes as float64,
// int64 or int depending on path) to int64. Zero for any other type.
func toInt64(v any) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case float64:
		return int64(n)
	case int:
		return int64(n)
	}
	return 0
}

// extractConditions reads .status.conditions[] in the metav1.Condition shape
// (type/status/reason/message/lastTransitionTime) every integration CR uses and
// projects each entry through ctor. Returns an empty slice (not nil) so the JSON
// encoder never emits `null` for a missing status block. Entries lacking a type
// or status are skipped.
func extractConditions[T any](obj *unstructured.Unstructured, ctor func(typ, status, reason, message, ts string) T) []T {
	raw, found, _ := nestedSliceNoCopy(obj.Object, "status", "conditions")
	if !found {
		return []T{}
	}
	out := make([]T, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		t, _ := m["type"].(string)
		s, _ := m["status"].(string)
		if t == "" || s == "" {
			continue
		}
		reason, _ := m["reason"].(string)
		message, _ := m["message"].(string)
		ts, _ := m["lastTransitionTime"].(string)
		out = append(out, ctor(t, s, reason, message, ts))
	}
	return out
}

func formatLabelSelector(sel *metav1.LabelSelector) string {
	if sel == nil || (len(sel.MatchLabels) == 0 && len(sel.MatchExpressions) == 0) {
		return "<all>"
	}
	parts := make([]string, 0, len(sel.MatchLabels)+len(sel.MatchExpressions))
	for k, v := range sel.MatchLabels {
		parts = append(parts, k+"="+v)
	}
	sort.Strings(parts)
	for _, m := range sel.MatchExpressions {
		parts = append(parts, fmt.Sprintf("%s %s %v", m.Key, m.Operator, m.Values))
	}
	return strings.Join(parts, ",")
}

func formatNodeSelector(sel map[string]string) string {
	if len(sel) == 0 {
		return "<none>"
	}
	parts := make([]string, 0, len(sel))
	for k, v := range sel {
		parts = append(parts, k+"="+v)
	}
	sort.Strings(parts)
	return strings.Join(parts, ",")
}
