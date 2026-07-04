package kube

import (
	"context"
	"sync"
	"time"

	authv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
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
	"Namespace":                        {},
	"Node":                             {},
	"PersistentVolume":                 {},
	"StorageClass":                     {},
	"IngressClass":                     {},
	"PriorityClass":                    {},
	"RuntimeClass":                     {},
	"ClusterRole":                      {},
	"ClusterRoleBinding":               {},
	"MutatingWebhookConfiguration":     {},
	"ValidatingWebhookConfiguration":   {},
	"ValidatingAdmissionPolicy":        {},
	"ValidatingAdmissionPolicyBinding": {},
	"MutatingAdmissionPolicy":          {},
	"MutatingAdmissionPolicyBinding":   {},
	"APIService":                       {},
	"GatewayClass":                     {},
	"CertificateSigningRequest":        {},
	"CSIDriver":                        {},
	"CSINode":                          {},
	"VolumeAttachment":                 {},
	"FlowSchema":                       {},
	"PriorityLevelConfiguration":       {},
	"DeviceClass":                      {},
	"ResourceSlice":                    {},
	"ServiceCIDR":                      {},
	"IPAddress":                        {},
}

type kindGVR struct {
	kind string
	gvr  schema.GroupVersionResource
}

// watchedKinds is the slice of (kind, gvr) pairs the watcher's informers
// cover. We discover access for each one so the routing table is complete
// before any factory starts. Pulled from kindToGVR but filtered to the
// kinds informers.go actually wires up.
func watchedKinds() []kindGVR {
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
		"ValidatingAdmissionPolicy", "ValidatingAdmissionPolicyBinding",
		"MutatingAdmissionPolicy", "MutatingAdmissionPolicyBinding",
		"APIService",
		"CertificateSigningRequest",
		"CSIDriver", "CSINode", "VolumeAttachment",
		"FlowSchema", "PriorityLevelConfiguration",
		"DeviceClass", "ResourceClaim", "ResourceClaimTemplate", "ResourceSlice",
		"ServiceCIDR", "IPAddress",
	}
	out := make([]kindGVR, 0, len(wanted))
	for _, k := range wanted {
		gvr, ok := kindToGVR[k]
		if !ok {
			continue
		}
		out = append(out, kindGVR{k, gvr})
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
func discoverAccess(parent context.Context, cs kubernetes.Interface, disco discovery.DiscoveryInterface, candidateNS string) *contextAccess {
	out := &contextAccess{kinds: make(map[string]KindAccess, 40)}
	served := servedResources(disco)

	// A probe that *errors* (cold exec token still minting behind the burst,
	// transient network hiccup, probe timeout) is not a denial — recording it
	// as Denied blanks that kind for the watcher's whole lifetime with no
	// self-heal. Errored kinds get one retry with a fresh timeout; by then
	// the exec token is warm and the retry answers authoritatively.
	remaining := watchedKinds()
	for attempt := 0; attempt < 2 && len(remaining) > 0; attempt++ {
		ctx, cancel := context.WithTimeout(parent, accessProbeTimeout)
		var (
			wg      sync.WaitGroup
			mu      sync.Mutex
			errored []kindGVR
		)
		for _, k := range remaining {
			wg.Add(1)
			go func(k kindGVR) {
				defer wg.Done()
				if served != nil && !served[k.gvr] {
					// An SSAR can say "allowed" for an RBAC wildcard even when the
					// apiserver doesn't serve this resource version, which would
					// 404-loop the informer. Treat unserved kinds as denied.
					mu.Lock()
					out.kinds[k.kind] = KindAccess{Mode: AccessDenied}
					mu.Unlock()
					return
				}
				mode, err := probeAccess(ctx, cs, k.kind, k.gvr, candidateNS)
				mu.Lock()
				out.kinds[k.kind] = mode
				if err != nil {
					errored = append(errored, k)
				}
				mu.Unlock()
			}(k)
		}
		wg.Wait()
		cancel()
		remaining = errored
	}
	return out
}

// servedResources returns the set of GVRs the apiserver actually serves. A nil
// result means discovery was unavailable, in which case callers fall back to
// the SSAR answer alone. Partial discovery (an aggregated API down) still
// returns usable lists alongside its error, so only a fully empty result bails.
func servedResources(d discovery.DiscoveryInterface) map[schema.GroupVersionResource]bool {
	_, lists, _ := d.ServerGroupsAndResources()
	if len(lists) == 0 {
		return nil
	}
	served := make(map[schema.GroupVersionResource]bool, 256)
	for _, list := range lists {
		gv, err := schema.ParseGroupVersion(list.GroupVersion)
		if err != nil {
			continue
		}
		for _, r := range list.APIResources {
			served[schema.GroupVersionResource{Group: gv.Group, Version: gv.Version, Resource: r.Name}] = true
		}
	}
	return served
}

// probeAccess returns a non-nil error when the decision rests on a probe
// that errored rather than answered — the caller retries those kinds.
func probeAccess(ctx context.Context, cs kubernetes.Interface, kind string, gvr schema.GroupVersionResource, candidateNS string) (KindAccess, error) {
	allowed, err := canList(ctx, cs, gvr, "")
	if allowed {
		return KindAccess{Mode: AccessCluster}, nil
	}
	if err != nil {
		return KindAccess{Mode: AccessDenied}, err
	}
	if candidateNS == "" {
		return KindAccess{Mode: AccessDenied}, nil
	}
	if _, clusterScoped := clusterScopedKinds[kind]; clusterScoped {
		return KindAccess{Mode: AccessDenied}, nil
	}
	allowed, err = canList(ctx, cs, gvr, candidateNS)
	if allowed {
		return KindAccess{Mode: AccessNamespaced, Namespace: candidateNS}, nil
	}
	return KindAccess{Mode: AccessDenied}, err
}

// canList issues a SelfSubjectAccessReview for the (gvr, namespace, verb=list)
// triple and reports whether the API server says yes. We probe `list` (not
// `watch`) because the apiserver's RBAC evaluator returns the same answer
// for both and `list` is the universally-implemented verb.
func canList(ctx context.Context, cs kubernetes.Interface, gvr schema.GroupVersionResource, namespace string) (bool, error) {
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
		return false, err
	}
	return result.Status.Allowed, nil
}

// canListRetry probes list access with a bounded per-attempt timeout, retrying
// once on a transport error so a transient hiccup — or a still-cold exec token,
// the same case discoverAccess retries for — is not mistaken for a denial. A
// gate that skipped on a blip would blank the CRD sidebar (and every CRD-gated
// integration) for the watcher's whole lifetime. Returns false only on an
// authoritative allowed=false or a persistent error, never blocking longer than
// two accessProbeTimeout windows on a wedged connection.
func canListRetry(parent context.Context, cs kubernetes.Interface, gvr schema.GroupVersionResource) bool {
	for attempt := 0; attempt < 2; attempt++ {
		ctx, cancel := context.WithTimeout(parent, accessProbeTimeout)
		allowed, err := canList(ctx, cs, gvr, "")
		cancel()
		if err == nil {
			return allowed
		}
	}
	return false
}
