package kube

import (
	"fmt"

	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
	gatewayv1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
	gatewayv1alpha3 "sigs.k8s.io/gateway-api/apis/v1alpha3"
)

func (w *contextWatcher) gatewayResourceLister(kind, resource string) (cache.GenericLister, error) {
	factory := w.gatewayFactoryFor(kind)
	if factory == nil {
		return nil, fmt.Errorf("%s API is unavailable or access is denied in this cluster", kind)
	}
	informer, err := factory.ForResource(schema.GroupVersionResource{
		Group: gatewayv1.GroupName, Version: w.gatewayVersion(kind), Resource: resource,
	})
	if err != nil {
		return nil, err
	}
	return informer.Lister(), nil
}

func (w *contextWatcher) gatewayResourceList(kind, resource, namespace string) ([]runtime.Object, error) {
	lister, err := w.gatewayResourceLister(kind, resource)
	if err != nil {
		return nil, err
	}
	if namespace == "" {
		return lister.List(labels.Everything())
	}
	return lister.ByNamespace(namespace).List(labels.Everything())
}

func (w *contextWatcher) gatewayResourceGet(kind, resource, namespace, name string) (runtime.Object, error) {
	lister, err := w.gatewayResourceLister(kind, resource)
	if err != nil {
		return nil, err
	}
	return lister.ByNamespace(namespace).Get(name)
}

func (w *contextWatcher) TLSRoutes(namespace string) []TLSRouteInfo {
	list, err := w.gatewayResourceList("TLSRoute", "tlsroutes", namespace)
	if err != nil {
		return []TLSRouteInfo{}
	}
	out := make([]TLSRouteInfo, 0, len(list))
	for _, object := range list {
		out = append(out, tlsRouteInfo(tlsRouteV1(object)))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) TLSRoute(namespace, name string) (*TLSRouteDetail, error) {
	object, err := w.gatewayResourceGet("TLSRoute", "tlsroutes", namespace, name)
	if err != nil {
		return nil, err
	}
	return tlsRouteDetail(tlsRouteV1(object)), nil
}

func (w *contextWatcher) TCPRoutes(namespace string) []TCPRouteInfo {
	list, err := w.gatewayResourceList("TCPRoute", "tcproutes", namespace)
	if err != nil {
		return []TCPRouteInfo{}
	}
	out := make([]TCPRouteInfo, 0, len(list))
	for _, object := range list {
		out = append(out, tcpRouteInfo(tcpRouteV1(object)))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) TCPRoute(namespace, name string) (*TCPRouteDetail, error) {
	object, err := w.gatewayResourceGet("TCPRoute", "tcproutes", namespace, name)
	if err != nil {
		return nil, err
	}
	return tcpRouteDetail(tcpRouteV1(object)), nil
}

func (w *contextWatcher) UDPRoutes(namespace string) []UDPRouteInfo {
	list, err := w.gatewayResourceList("UDPRoute", "udproutes", namespace)
	if err != nil {
		return []UDPRouteInfo{}
	}
	out := make([]UDPRouteInfo, 0, len(list))
	for _, object := range list {
		out = append(out, udpRouteInfo(udpRouteV1(object)))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) UDPRoute(namespace, name string) (*UDPRouteDetail, error) {
	object, err := w.gatewayResourceGet("UDPRoute", "udproutes", namespace, name)
	if err != nil {
		return nil, err
	}
	return udpRouteDetail(udpRouteV1(object)), nil
}

func (w *contextWatcher) ListenerSets(namespace string) []ListenerSetInfo {
	list, err := w.gatewayResourceList("ListenerSet", "listenersets", namespace)
	if err != nil {
		return []ListenerSetInfo{}
	}
	out := make([]ListenerSetInfo, 0, len(list))
	for _, object := range list {
		out = append(out, listenerSetInfo(object.(*gatewayv1.ListenerSet)))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) ListenerSet(namespace, name string) (*ListenerSetDetail, error) {
	object, err := w.gatewayResourceGet("ListenerSet", "listenersets", namespace, name)
	if err != nil {
		return nil, err
	}
	return listenerSetDetail(object.(*gatewayv1.ListenerSet)), nil
}

func (w *contextWatcher) BackendTLSPolicies(namespace string) []BackendTLSPolicyInfo {
	list, err := w.gatewayResourceList("BackendTLSPolicy", "backendtlspolicies", namespace)
	if err != nil {
		return []BackendTLSPolicyInfo{}
	}
	out := make([]BackendTLSPolicyInfo, 0, len(list))
	for _, object := range list {
		out = append(out, backendTLSPolicyInfo(backendTLSPolicyV1(object)))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) BackendTLSPolicy(namespace, name string) (*BackendTLSPolicyDetail, error) {
	object, err := w.gatewayResourceGet("BackendTLSPolicy", "backendtlspolicies", namespace, name)
	if err != nil {
		return nil, err
	}
	return backendTLSPolicyDetail(backendTLSPolicyV1(object)), nil
}

func tlsRouteV1(object runtime.Object) *gatewayv1.TLSRoute {
	switch route := object.(type) {
	case *gatewayv1alpha3.TLSRoute:
		return (*gatewayv1.TLSRoute)(route)
	case *gatewayv1alpha2.TLSRoute:
		rules := make([]gatewayv1.TLSRouteRule, 0, len(route.Spec.Rules))
		for _, rule := range route.Spec.Rules {
			rules = append(rules, gatewayv1.TLSRouteRule(rule))
		}
		return &gatewayv1.TLSRoute{
			ObjectMeta: route.ObjectMeta,
			Spec:       gatewayv1.TLSRouteSpec{CommonRouteSpec: route.Spec.CommonRouteSpec, Hostnames: route.Spec.Hostnames, Rules: rules},
			Status:     gatewayv1.TLSRouteStatus(route.Status),
		}
	default:
		return object.(*gatewayv1.TLSRoute)
	}
}

func tcpRouteV1(object runtime.Object) *gatewayv1.TCPRoute {
	if route, ok := object.(*gatewayv1alpha2.TCPRoute); ok {
		rules := make([]gatewayv1.TCPRouteRule, 0, len(route.Spec.Rules))
		for _, rule := range route.Spec.Rules {
			rules = append(rules, gatewayv1.TCPRouteRule(rule))
		}
		return &gatewayv1.TCPRoute{
			ObjectMeta: route.ObjectMeta,
			Spec:       gatewayv1.TCPRouteSpec{CommonRouteSpec: route.Spec.CommonRouteSpec, Rules: rules},
			Status:     gatewayv1.TCPRouteStatus(route.Status),
		}
	}
	return object.(*gatewayv1.TCPRoute)
}

func udpRouteV1(object runtime.Object) *gatewayv1.UDPRoute {
	if route, ok := object.(*gatewayv1alpha2.UDPRoute); ok {
		rules := make([]gatewayv1.UDPRouteRule, 0, len(route.Spec.Rules))
		for _, rule := range route.Spec.Rules {
			rules = append(rules, gatewayv1.UDPRouteRule(rule))
		}
		return &gatewayv1.UDPRoute{
			ObjectMeta: route.ObjectMeta,
			Spec:       gatewayv1.UDPRouteSpec{CommonRouteSpec: route.Spec.CommonRouteSpec, Rules: rules},
			Status:     gatewayv1.UDPRouteStatus(route.Status),
		}
	}
	return object.(*gatewayv1.UDPRoute)
}

func backendTLSPolicyV1(object runtime.Object) *gatewayv1.BackendTLSPolicy {
	if policy, ok := object.(*gatewayv1alpha3.BackendTLSPolicy); ok {
		return (*gatewayv1.BackendTLSPolicy)(policy)
	}
	return object.(*gatewayv1.BackendTLSPolicy)
}
