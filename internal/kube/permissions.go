package kube

import (
	"context"
	"sync"
	"time"

	authv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
)

// AccessMode is the effective list/watch reach a user has for a given kind.
// Klustr's informer fan-out reads this map to decide which factory should
// own that kind's informer — see contextWatcher.factoryFor.
type AccessMode int

const (
	AccessUnknown AccessMode = iota
	// AccessDenied: user has neither cluster-wide nor namespaced list/watch.
	// Klustr skips the informer entirely and shows the kind as empty.
	AccessDenied
	// AccessCluster: cluster-wide list/watch is allowed. The all-namespaces
	// SharedInformerFactory owns this kind.
	AccessCluster
	// AccessNamespaced: cluster-wide list is denied but the user can list in
	// at least one specific namespace. The scoped SharedInformerFactory
	// (built with WithNamespace(ns)) owns this kind.
	AccessNamespaced
)

// KindAccess is what discoverAccess reports per kind. The Namespace field is
// only meaningful when Mode == AccessNamespaced.
type KindAccess struct {
	Mode      AccessMode
	Namespace string
}

// contextAccess is the per-watcher decision table used to route every
// list/get/handler-registration call. Empty / zero-value entries mean the
// kind was never probed (treat as AccessUnknown).
type contextAccess struct {
	kinds map[string]KindAccess
}

func (a *contextAccess) For(kind string) KindAccess {
	if a == nil {
		return KindAccess{Mode: AccessCluster}
	}
	return a.kinds[kind]
}

// HasAnyClusterWide returns true when the user has cluster-wide list/watch
// for at least one kind. Tells the watcher whether to spin up the all-ns
// SharedInformerFactory at all.
func (a *contextAccess) HasAnyClusterWide() bool {
	if a == nil {
		return true
	}
	for _, v := range a.kinds {
		if v.Mode == AccessCluster {
			return true
		}
	}
	return false
}

// ScopedNamespace returns the namespace the scoped factory needs to watch,
// or "" if no kind needs a scoped factory.
func (a *contextAccess) ScopedNamespace() string {
	if a == nil {
		return ""
	}
	for _, v := range a.kinds {
		if v.Mode == AccessNamespaced && v.Namespace != "" {
			return v.Namespace
		}
	}
	return ""
}

// AccessibleKinds returns every kind whose mode is anything other than
// Denied — i.e. the user can see at least *some* instances of that kind.
// The UI uses this to hide sidebar entries the user has no access to so
// restricted contexts feel curated, not cluttered with empty tables.
func (a *contextAccess) AccessibleKinds() []string {
	if a == nil {
		return nil
	}
	out := make([]string, 0, len(a.kinds))
	for k, v := range a.kinds {
		if v.Mode == AccessCluster || v.Mode == AccessNamespaced {
			out = append(out, k)
		}
	}
	return out
}

// clusterScopedKinds is the set of built-in kinds where the "list in
// namespace X" probe makes no sense — the resource lives at the cluster
// level. For these kinds AccessNamespaced is unreachable; the only
// outcomes are AccessCluster or AccessDenied.
var clusterScopedKinds = map[string]struct{}{
	"Namespace":                      {},
	"Node":                           {},
	"PersistentVolume":               {},
	"StorageClass":                   {},
	"IngressClass":                   {},
	"PriorityClass":                  {},
	"RuntimeClass":                   {},
	"ClusterRole":                    {},
	"ClusterRoleBinding":             {},
	"MutatingWebhookConfiguration":   {},
	"ValidatingWebhookConfiguration": {},
	"APIService":                     {},
	"GatewayClass":                   {},
	"CertificateSigningRequest":      {},
	"CSIDriver":                      {},
	"CSINode":                        {},
	"VolumeAttachment":               {},
}

// watchedKinds is the slice of (kind, gvr) pairs the watcher's informers
// cover. We discover access for each one so the routing table is complete
// before any factory starts. Pulled from kindToGVR but filtered to the
// kinds informers.go actually wires up.
func watchedKinds() []struct {
	kind string
	gvr  schema.GroupVersionResource
} {
	wanted := []string{
		"Pod", "Deployment", "StatefulSet", "DaemonSet", "ReplicaSet",
		"ReplicationController", "Job", "CronJob",
		"Service", "Endpoints", "EndpointSlice", "Ingress", "NetworkPolicy",
		"ConfigMap", "Secret",
		"HorizontalPodAutoscaler", "PodDisruptionBudget",
		"ResourceQuota", "LimitRange",
		"PersistentVolumeClaim",
		"ServiceAccount", "Role", "RoleBinding",
		"Lease",
		"Namespace", "Node",
		"PersistentVolume", "StorageClass",
		"IngressClass", "PriorityClass", "RuntimeClass",
		"ClusterRole", "ClusterRoleBinding",
		"MutatingWebhookConfiguration", "ValidatingWebhookConfiguration",
		"APIService",
		"CertificateSigningRequest",
		"CSIDriver", "CSINode", "VolumeAttachment",
	}
	out := make([]struct {
		kind string
		gvr  schema.GroupVersionResource
	}, 0, len(wanted))
	for _, k := range wanted {
		gvr, ok := kindToGVR[k]
		if !ok {
			continue
		}
		out = append(out, struct {
			kind string
			gvr  schema.GroupVersionResource
		}{k, gvr})
	}
	return out
}

const accessProbeTimeout = 8 * time.Second

// discoverAccess walks every kind the watcher wants to follow and probes
// SelfSubjectAccessReview to figure out where its informer should live.
// candidateNS — usually the kubeconfig context's `namespace:` field — is
// the fallback the probe falls back to when cluster-wide list is denied.
//
// All per-kind probes fan out concurrently via sync.WaitGroup so total
// latency is one round-trip, not N. The rest.Config has been bumped to
// QPS=50/Burst=100 so this burst doesn't trigger client-side throttling.
func discoverAccess(parent context.Context, cs kubernetes.Interface, candidateNS string) *contextAccess {
	ctx, cancel := context.WithTimeout(parent, accessProbeTimeout)
	defer cancel()

	out := &contextAccess{kinds: make(map[string]KindAccess, 40)}
	kinds := watchedKinds()

	var (
		wg sync.WaitGroup
		mu sync.Mutex
	)
	for _, k := range kinds {
		wg.Add(1)
		go func(kind string, gvr schema.GroupVersionResource) {
			defer wg.Done()
			mode := probeAccess(ctx, cs, kind, gvr, candidateNS)
			mu.Lock()
			out.kinds[kind] = mode
			mu.Unlock()
		}(k.kind, k.gvr)
	}
	wg.Wait()
	return out
}

func probeAccess(ctx context.Context, cs kubernetes.Interface, kind string, gvr schema.GroupVersionResource, candidateNS string) KindAccess {
	if canList(ctx, cs, gvr, "") {
		return KindAccess{Mode: AccessCluster}
	}
	if candidateNS == "" {
		return KindAccess{Mode: AccessDenied}
	}
	if _, clusterScoped := clusterScopedKinds[kind]; clusterScoped {
		return KindAccess{Mode: AccessDenied}
	}
	if canList(ctx, cs, gvr, candidateNS) {
		return KindAccess{Mode: AccessNamespaced, Namespace: candidateNS}
	}
	return KindAccess{Mode: AccessDenied}
}

// canList issues a SelfSubjectAccessReview for the (gvr, namespace, verb=list)
// triple and reports whether the API server says yes. We probe `list` (not
// `watch`) because the apiserver's RBAC evaluator returns the same answer
// for both and `list` is the universally-implemented verb.
func canList(ctx context.Context, cs kubernetes.Interface, gvr schema.GroupVersionResource, namespace string) bool {
	review := &authv1.SelfSubjectAccessReview{
		Spec: authv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authv1.ResourceAttributes{
				Verb:      "list",
				Group:     gvr.Group,
				Version:   gvr.Version,
				Resource:  gvr.Resource,
				Namespace: namespace,
			},
		},
	}
	result, err := cs.AuthorizationV1().SelfSubjectAccessReviews().Create(ctx, review, metav1.CreateOptions{})
	if err != nil {
		return false
	}
	return result.Status.Allowed
}
