package kube

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

// ConditionDetail is the per-condition shape used across PodDetail,
// DeploymentDetail, PDB/HPA/PVC/ReplicaSet/Node detail bodies.
type ConditionDetail struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason"`
	Message string `json:"message"`
}

type ChangeFunc func(kind string)

// contextWatcher owns up to two SharedInformerFactories — one all-namespaces
// (`factory`) and one optional namespaced fallback (`scoped`) — plus the
// Gateway-API factory, a debounce queue and the lifecycle context. The
// access map decides which factory each kind belongs to so a restricted
// user (e.g., the kubeconfig user only has list+watch in namespace `prod`)
// still gets live data for the kinds they CAN see, without the all-ns
// list call that would 403 and silently leave the cache empty.
//
// Per-kind type definitions and lister methods live in informers_<group>.go
// files; the handler registration that wires up every kind stays here in
// start() so the routing table is auditable in one place.
type contextWatcher struct {
	factory   informers.SharedInformerFactory // cluster-wide; nil when user has no cluster-wide list at all
	scoped    informers.SharedInformerFactory // namespaced fallback; nil when no kind needs it
	scopedNS  string                          // namespace `scoped` is bound to (informers.WithNamespace)
	access    *contextAccess                  // per-kind routing decisions; nil ⇒ assume cluster-wide
	defaultNS string                          // kubeconfig context.namespace, used as the scoped probe target
	cs             kubernetes.Interface // kept around for SelfSubjectAccessReview
	gwFactory      gwinformers.SharedInformerFactory
	apiSvcFactory  dynamicinformer.DynamicSharedInformerFactory
	apiSvcInformer cache.SharedIndexInformer
	dyn            dynamic.Interface
	crd            *crdWatcher
	onChange       ChangeFunc
	cancel         context.CancelFunc

	mu      sync.Mutex
	pending map[string]struct{}
	timer   *time.Timer
}

func newContextWatcher(cs *kubernetes.Clientset, gw gwclient.Interface, dyn dynamic.Interface, defaultNS string, onChange ChangeFunc) *contextWatcher {
	w := &contextWatcher{
		cs:        cs,
		dyn:       dyn,
		defaultNS: defaultNS,
		onChange:  onChange,
		pending:   make(map[string]struct{}),
	}
	if gw != nil && hasGatewayAPIGroup(cs.Discovery()) {
		w.gwFactory = gwinformers.NewSharedInformerFactory(gw, 0)
	}
	return w
}

// factoryFor returns the informer factory that owns the given kind, or nil
// when the user has no access. Listers and detail Get paths call this so a
// single helper carries the routing logic instead of every method making
// the cluster-vs-scoped decision inline.
func (w *contextWatcher) factoryFor(kind string) informers.SharedInformerFactory {
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

func (w *contextWatcher) start(parent context.Context) error {
	ctx, cancel := context.WithCancel(parent)
	w.cancel = cancel

	w.access = discoverAccess(ctx, w.cs, w.defaultNS)
	if w.access.HasAnyClusterWide() {
		w.factory = informers.NewSharedInformerFactory(w.cs.(*kubernetes.Clientset), 0)
	}
	if scopedNS := w.access.ScopedNamespace(); scopedNS != "" {
		w.scopedNS = scopedNS
		w.scoped = informers.NewSharedInformerFactoryWithOptions(
			w.cs.(*kubernetes.Clientset), 0,
			informers.WithNamespace(scopedNS),
		)
	}

	w.crd = newCRDWatcher(w.dyn, ctx.Done(), w.touch)
	// Skip the cluster-wide CRD watcher when the user can't list CRDs —
	// otherwise client-go's reflector retries on a tight loop and floods
	// the log with 403s.
	if canList(ctx, w.cs, crdGVR, "") {
		if err := w.crd.start(); err != nil {
			cancel()
			return err
		}
	}

	if err := w.registerHandlers(); err != nil {
		cancel()
		return err
	}

	if err := w.startGatewayInformers(ctx); err != nil {
		cancel()
		return err
	}

	if err := w.startAPIServiceInformer(ctx); err != nil {
		cancel()
		return err
	}

	if w.factory != nil {
		w.factory.Start(ctx.Done())
	}
	if w.scoped != nil {
		w.scoped.Start(ctx.Done())
	}
	go func() {
		if w.factory != nil {
			w.factory.WaitForCacheSync(ctx.Done())
		}
		if w.scoped != nil {
			w.scoped.WaitForCacheSync(ctx.Done())
		}
		for kind := range w.access.kinds {
			w.touch(kind)
		}
	}()
	return nil
}

// registerHandlers wires the standard touch callback into every kind's
// informer using the factory the access table points at. The Secret block
// adds a Helm-release piggyback that's special-cased inline.
func (w *contextWatcher) registerHandlers() error {
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
	}

	for _, b := range bindings {
		if err := w.registerKind(b.kind, b.informer, nil); err != nil {
			return err
		}
	}

	// Secret carries a Helm-release piggyback so the Helm UI updates when a
	// release Secret lands; that's why this binding sits outside the table.
	if err := w.registerKind("Secret",
		func(f informers.SharedInformerFactory) cache.SharedIndexInformer {
			return f.Core().V1().Secrets().Informer()
		},
		func(obj any) { maybeTouchHelm(obj, w) },
	); err != nil {
		return err
	}

	return nil
}

// registerKind looks up the kind's factory via the access map and, if the
// user has any access at all, attaches the standard touch callback plus an
// optional sidecar (currently used by Secret → Helm). Skips silently when
// access is denied so the per-kind UI shows up empty rather than erroring.
func (w *contextWatcher) registerKind(
	kind string,
	pick func(informers.SharedInformerFactory) cache.SharedIndexInformer,
	sidecar func(obj any),
) error {
	f := w.factoryFor(kind)
	if f == nil {
		return nil
	}
	informer := pick(f)
	handler := cache.ResourceEventHandlerFuncs{
		AddFunc:    func(obj any) { w.touch(kind); callIf(sidecar, obj) },
		UpdateFunc: func(_, obj any) { w.touch(kind); callIf(sidecar, obj) },
		DeleteFunc: func(obj any) { w.touch(kind); callIf(sidecar, obj) },
	}
	_, err := informer.AddEventHandler(handler)
	return err
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
	if w.timer != nil {
		w.timer.Stop()
		w.timer = nil
	}
	w.pending = make(map[string]struct{})
	w.mu.Unlock()
}

func (w *contextWatcher) touch(kind string) {
	w.mu.Lock()
	w.pending[kind] = struct{}{}
	if w.timer == nil {
		w.timer = time.AfterFunc(debounceWindow, w.flush)
	}
	w.mu.Unlock()
}

func (w *contextWatcher) flush() {
	w.mu.Lock()
	kinds := make([]string, 0, len(w.pending))
	for k := range w.pending {
		kinds = append(kinds, k)
	}
	w.pending = make(map[string]struct{})
	w.timer = nil
	cb := w.onChange
	w.mu.Unlock()

	if cb == nil {
		return
	}
	for _, k := range kinds {
		cb(k)
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
