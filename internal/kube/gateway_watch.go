package kube

import (
	"context"
	"maps"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	gwinformers "sigs.k8s.io/gateway-api/pkg/client/informers/externalversions"
)

var gatewayResources = []struct {
	kind     string
	versions []string
}{
	{"Gateway", []string{"v1"}},
	{"HTTPRoute", []string{"v1"}},
	{"GRPCRoute", []string{"v1"}},
	{"GatewayClass", []string{"v1"}},
	{"ReferenceGrant", []string{"v1", "v1beta1"}},
	{"TLSRoute", []string{"v1", "v1alpha3", "v1alpha2"}},
	{"TCPRoute", []string{"v1", "v1alpha2"}},
	{"UDPRoute", []string{"v1", "v1alpha2"}},
	{"ListenerSet", []string{"v1"}},
	{"BackendTLSPolicy", []string{"v1", "v1alpha3"}},
}

func discoverGatewayVersions(ctx context.Context, d discovery.DiscoveryInterface) (map[string]string, map[string]bool) {
	versions := make(map[string]string, len(gatewayResources))
	pending := make(map[string]bool)
	lists := make(map[string]*metav1.APIResourceList)
	failed := make(map[string]bool)
	for _, resource := range gatewayResources {
		for _, version := range resource.versions {
			list, queried := lists[version]
			if !queried {
				var err error
				for attempt := 0; attempt < 2; attempt++ {
					if err = ctx.Err(); err != nil {
						break
					}
					list, err = d.ServerResourcesForGroupVersion("gateway.networking.k8s.io/" + version)
					if err == nil || apierrors.IsNotFound(err) || apierrors.IsForbidden(err) {
						break
					}
				}
				failed[version] = err != nil && !apierrors.IsNotFound(err) && !apierrors.IsForbidden(err)
				if err != nil {
					list = nil
				}
				lists[version] = list
			}
			if failed[version] {
				pending[resource.kind] = true
			}
			if list == nil {
				continue
			}
			for _, served := range list.APIResources {
				if served.Name == kindToGVR[resource.kind].Resource && served.Kind == resource.kind {
					versions[resource.kind] = version
					break
				}
			}
			if versions[resource.kind] != "" {
				delete(pending, resource.kind)
				break
			}
		}
	}
	return versions, pending
}

func discoverGatewayAccess(parent context.Context, cs kubernetes.Interface, versions map[string]string, namespace string, previous *contextAccess) *contextAccess {
	out := &contextAccess{kinds: make(map[string]KindAccess, len(gatewayResources))}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, resource := range gatewayResources {
		if versions[resource.kind] == "" {
			continue
		}
		wg.Go(func() {
			access := KindAccess{Mode: AccessDenied}
			var err error
			if previous != nil {
				if cached, ok := previous.kinds[resource.kind]; ok {
					mu.Lock()
					out.kinds[resource.kind] = cached
					mu.Unlock()
					return
				}
			}
			if version := versions[resource.kind]; version != "" {
				gvr := kindToGVR[resource.kind]
				gvr.Version = version
				for attempt := 0; attempt < 2; attempt++ {
					ctx, cancel := context.WithTimeout(parent, accessProbeTimeout)
					access, err = probeGatewayAccess(ctx, cs, resource.kind, gvr, namespace)
					cancel()
					if err == nil {
						break
					}
				}
			}
			if err != nil {
				return
			}
			mu.Lock()
			out.kinds[resource.kind] = access
			mu.Unlock()
		})
	}
	wg.Wait()
	return out
}

func probeGatewayAccess(ctx context.Context, cs kubernetes.Interface, kind string, gvr schema.GroupVersionResource, namespace string) (KindAccess, error) {
	namespaces := []string{""}
	if namespace != "" && kind != "GatewayClass" {
		namespaces = append(namespaces, namespace)
	}
	for _, ns := range namespaces {
		allowed := true
		// RBAC can grant list without watch; both are required by an informer.
		for _, verb := range []string{"list", "watch"} {
			ok, err := canResourceVerb(ctx, cs, gvr, ns, verb)
			if err != nil {
				return KindAccess{Mode: AccessDenied}, err
			}
			if !ok {
				allowed = false
				break
			}
		}
		if allowed {
			if ns == "" {
				return KindAccess{Mode: AccessCluster}, nil
			}
			return KindAccess{Mode: AccessNamespaced, Namespace: ns}, nil
		}
	}
	return KindAccess{Mode: AccessDenied}, nil
}

func (w *contextWatcher) gatewayVersion(kind string) string {
	w.gwMu.RLock()
	defer w.gwMu.RUnlock()
	return w.gwVersions[kind]
}

func (w *contextWatcher) gatewayFactoryFor(kind string) gwinformers.SharedInformerFactory {
	w.gwMu.RLock()
	defer w.gwMu.RUnlock()
	if w.gwVersions[kind] == "" {
		return nil
	}
	switch w.gwAccess.For(kind).Mode {
	case AccessCluster:
		return w.gwFactory
	case AccessNamespaced:
		return w.gwScoped
	default:
		return nil
	}
}

func (w *contextWatcher) startGatewayInformers(ctx context.Context) error {
	if w.gwFactory == nil {
		return nil
	}
	w.gwStarted = make(map[string]bool)
	if err := w.activateGatewayInformers(ctx, w.gwVersions, w.gwPending, w.gwAccess); err != nil {
		return err
	}
	if w.gatewayDiscoveryIncomplete() {
		go w.retryGatewayDiscovery(ctx)
	}
	return nil
}

func (w *contextWatcher) activateGatewayInformers(ctx context.Context, versions map[string]string, pending map[string]bool, previous *contextAccess) error {
	access := discoverGatewayAccess(ctx, w.cs, versions, w.defaultNS, previous)
	if err := ctx.Err(); err != nil {
		return err
	}
	w.gwMu.Lock()
	defer w.gwMu.Unlock()
	for _, resource := range gatewayResources {
		kind := resource.kind
		if versions[kind] == "" || w.gwStarted[kind] {
			continue
		}
		factory := w.gwFactory
		switch access.For(kind).Mode {
		case AccessCluster:
		case AccessNamespaced:
			factory = w.gwScoped
		default:
			continue
		}
		gvr := kindToGVR[kind]
		gvr.Version = versions[kind]
		typed, err := factory.ForResource(gvr)
		if err != nil {
			return err
		}
		informer := typed.Informer()
		if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
			AddFunc:    func(any) { w.touch(kind) },
			UpdateFunc: func(any, any) { w.touch(kind) },
			DeleteFunc: func(any) { w.touch(kind) },
		}); err != nil {
			return err
		}
		w.gwStarted[kind] = true
		// A denied or failing API must not block other kinds from becoming ready.
		go func() {
			if cache.WaitForCacheSync(ctx.Done(), informer.HasSynced) {
				w.touch(kind)
			}
		}()
	}
	w.gwVersions, w.gwPending, w.gwAccess = versions, pending, access
	w.gwFactory.Start(ctx.Done())
	if w.gwScoped != nil {
		w.gwScoped.Start(ctx.Done())
	}
	return nil
}

func (w *contextWatcher) gatewayDiscoveryIncomplete() bool {
	w.gwMu.RLock()
	defer w.gwMu.RUnlock()
	return len(w.gwPending) != 0 || len(w.gwAccess.kinds) < len(w.gwVersions)
}

func (w *contextWatcher) retryGatewayDiscovery(ctx context.Context) {
	delay := time.Second
	for w.gatewayDiscoveryIncomplete() {
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
		if ctx.Err() != nil {
			return
		}
		w.gwMu.RLock()
		versions, pending, access := maps.Clone(w.gwVersions), maps.Clone(w.gwPending), w.gwAccess
		w.gwMu.RUnlock()
		if len(pending) != 0 {
			discovered, unresolved := discoverGatewayVersions(ctx, w.disco)
			for kind := range pending {
				if version := discovered[kind]; version != "" {
					versions[kind] = version
				}
				if !unresolved[kind] {
					delete(pending, kind)
				}
			}
		}
		if err := w.activateGatewayInformers(ctx, versions, pending, access); err != nil {
			return
		}
		w.gwMu.RLock()
		changed := !maps.Equal(access.kinds, w.gwAccess.kinds)
		w.gwMu.RUnlock()
		if changed {
			w.touch("_access")
		}
		delay = min(2*delay, 30*time.Second)
	}
}

func (w *contextWatcher) reuseGatewayAccess(previous *contextWatcher) {
	if w.defaultNS != previous.defaultNS {
		return
	}
	previous.gwMu.RLock()
	defer previous.gwMu.RUnlock()
	if previous.gwAccess == nil {
		return
	}
	w.gwAccess = &contextAccess{kinds: make(map[string]KindAccess)}
	for kind, access := range previous.gwAccess.kinds {
		if w.gwVersions[kind] != "" && w.gwVersions[kind] == previous.gwVersions[kind] {
			w.gwAccess.kinds[kind] = access
		}
	}
}

func (w *contextWatcher) accessibleGatewayKinds() []string {
	w.gwMu.RLock()
	defer w.gwMu.RUnlock()
	return w.gwAccess.AccessibleKinds()
}
