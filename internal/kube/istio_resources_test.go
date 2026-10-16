package kube

import (
	"context"
	"os"
	"reflect"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
)

func istioFixture(t *testing.T, group, resource string) *unstructured.Unstructured {
	t.Helper()
	data, err := os.ReadFile("testdata/integrations/" + group + "/" + resource + ".yaml")
	if err != nil {
		t.Fatal(err)
	}
	return mustUnstructured(t, string(data))
}

// istioManager serves the Istio CRDs, holds objs in their started CR watches,
// and caches services and pods in the typed informers.
func istioManager(t *testing.T, services []*corev1.Service, pods []*corev1.Pod, objs ...*unstructured.Unstructured) *ClientManager {
	t.Helper()
	grs := map[schema.GroupResource]string{
		istioVirtualServiceGR: "VirtualService", istioDestinationRuleGR: "DestinationRule", istioGatewayGR: "Gateway",
		istioSidecarGR: "Sidecar", istioAuthorizationPolicyGR: "AuthorizationPolicy",
		istioRequestAuthenticationGR: "RequestAuthentication", istioServiceEntryGR: "ServiceEntry",
	}
	crds := make([]fakeCRD, 0, len(grs))
	for gr, kind := range grs {
		crds = append(crds, fakeCRD{gvr: gr.WithVersion("v1"), kind: kind, namespaced: true})
	}
	m, _ := fakeCRDManager(t, crds)
	byGR := map[schema.GroupResource][]*unstructured.Unstructured{}
	for _, obj := range objs {
		gvk := obj.GroupVersionKind()
		for gr, kind := range grs {
			if gr.Group == gvk.Group && kind == gvk.Kind {
				byGR[gr] = append(byGR[gr], obj)
			}
		}
	}
	for gr := range grs {
		startFakeCRWatch(t, m, gr.WithVersion("v1"), byGR[gr]...)
	}
	cs := fake.NewClientset()
	f := informers.NewSharedInformerFactory(cs, 0)
	for _, s := range services {
		if err := f.Core().V1().Services().Informer().GetStore().Add(s); err != nil {
			t.Fatal(err)
		}
	}
	for _, p := range pods {
		if err := f.Core().V1().Pods().Informer().GetStore().Add(p); err != nil {
			t.Fatal(err)
		}
	}
	w := m.watchers["ctx"]
	w.cs, w.factory = cs, f
	return m
}

func istioPod(ns, name string, labels map[string]string) *corev1.Pod {
	return &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name, Labels: labels}}
}

func TestIstioServiceHost(t *testing.T) {
	cases := []struct {
		host, ns, wantNS, wantName string
		ok                         bool
	}{
		{"reviews", "shop", "shop", "reviews", true},
		// Istio expands only dotless names: these stay unresolved in routing.
		{"reviews.prod", "shop", "", "", false},
		{"reviews.prod.svc", "shop", "", "", false},
		{"api.com", "shop", "", "", false},
		{"reviews.prod.svc.cluster.local", "shop", "prod", "reviews", true},
		{"reviews.prod.svc.corp.internal", "shop", "prod", "reviews", true},
		{"api.payments.example.net", "shop", "", "", false},
		{"*.example.com", "shop", "", "", false},
		{"", "shop", "", "", false},
	}
	for _, tc := range cases {
		ns, name, ok := istioServiceHost(tc.host, tc.ns)
		if ns != tc.wantNS || name != tc.wantName || ok != tc.ok {
			t.Errorf("%q in %s = %s/%s %v, want %s/%s %v", tc.host, tc.ns, ns, name, ok, tc.wantNS, tc.wantName, tc.ok)
		}
	}
}

func TestIstioVirtualServiceRelations(t *testing.T) {
	vs := mustUnstructured(t, `
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata: {name: reviews, namespace: shop}
spec:
  hosts: [reviews, reviews.example.com]
  gateways: [mesh, public, istio-ingress/shared]
  http:
    - route:
        - destination: {host: reviews, subset: v1}
          weight: 90
        - destination: {host: ratings.prod.svc.cluster.local}
          weight: 10
`)
	services := []*corev1.Service{
		{ObjectMeta: metav1.ObjectMeta{Namespace: "shop", Name: "reviews"}},
		{ObjectMeta: metav1.ObjectMeta{Namespace: "prod", Name: "ratings"}},
	}
	m := istioManager(t, services, nil, vs)
	d, err := m.GetIstioVirtualService(context.Background(), "ctx", "shop", "reviews")
	if err != nil {
		t.Fatal(err)
	}
	wantHosts := []IstioServiceRef{{Host: "reviews", Namespace: "shop", Name: "reviews"}, {Host: "reviews.example.com"}}
	if !reflect.DeepEqual(d.HostServices, wantHosts) {
		t.Fatalf("hostServices = %+v", d.HostServices)
	}
	wantGateways := []IstioObjectRef{{Namespace: "shop", Name: "public"}, {Namespace: "istio-ingress", Name: "shared"}}
	if !reflect.DeepEqual(d.GatewayRefs, wantGateways) {
		t.Fatalf("gatewayRefs = %+v", d.GatewayRefs)
	}
	dests := d.HTTPRoutes[0].Destinations
	if dests[0].ServiceName != "reviews" || dests[1].ServiceNamespace != "prod" || dests[1].ServiceName != "ratings" {
		t.Fatalf("destinations = %+v", dests)
	}
}

// A subset's endpoints are the host Service's pods that also carry the
// subset labels.
func TestIstioDestinationRuleSubsetWorkloads(t *testing.T) {
	dr := mustUnstructured(t, `
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata: {name: reviews, namespace: shop}
spec:
  host: reviews
  subsets:
    - {name: v1, labels: {version: v1}}
    - {name: v2, labels: {version: v2}}
    - {name: conflict, labels: {app: ratings, version: v1}}
`)
	svc := &corev1.Service{ObjectMeta: metav1.ObjectMeta{Namespace: "shop", Name: "reviews"},
		Spec: corev1.ServiceSpec{Selector: map[string]string{"app": "reviews"}}}
	pods := []*corev1.Pod{
		istioPod("shop", "reviews-v1-a", map[string]string{"app": "reviews", "version": "v1"}),
		istioPod("shop", "reviews-v1-b", map[string]string{"app": "reviews", "version": "v1"}),
		istioPod("shop", "reviews-v2-a", map[string]string{"app": "reviews", "version": "v2"}),
		// Same version label, but not behind the Service.
		istioPod("shop", "ratings-v1", map[string]string{"app": "ratings", "version": "v1"}),
	}
	m := istioManager(t, []*corev1.Service{svc}, pods, dr)
	d, err := m.GetIstioDestinationRule(context.Background(), "ctx", "shop", "reviews")
	if err != nil {
		t.Fatal(err)
	}
	if d.Service.Name != "reviews" || d.Service.Namespace != "shop" {
		t.Fatalf("service = %+v", d.Service)
	}
	v1 := d.SubsetDetails[0].Workloads
	if v1.Total != 2 || v1.Pods[0].Name != "reviews-v1-a" || v1.Pods[1].Name != "reviews-v1-b" {
		t.Fatalf("v1 workloads = %+v", v1)
	}
	if d.SubsetDetails[1].Workloads.Total != 1 {
		t.Fatalf("v2 workloads = %+v", d.SubsetDetails[1].Workloads)
	}
	// A subset label that contradicts the Service selector leaves no
	// endpoints, even though ratings-v1 carries the subset labels.
	if w := d.SubsetDetails[2].Workloads; w.Total != 0 || len(w.Pods) != 0 || w.Pods == nil {
		t.Fatalf("conflicting subset workloads = %+v", w)
	}
}

func TestIstioGatewayRelations(t *testing.T) {
	gw := istioFixture(t, "networking.istio.io", "gateways")
	bound := mustUnstructured(t, `
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata: {name: storefront, namespace: shop}
spec: {hosts: [shop.example.com], gateways: [istio-ingress/public]}
`)
	other := mustUnstructured(t, `
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata: {name: internal, namespace: shop}
spec: {hosts: [internal], gateways: [mesh]}
`)
	pods := []*corev1.Pod{
		istioPod("istio-ingress", "istio-ingressgateway-1", map[string]string{"istio": "ingressgateway"}),
		istioPod("istio-system", "istio-ingressgateway-2", map[string]string{"istio": "ingressgateway"}),
		istioPod("shop", "storefront-1", map[string]string{"app": "storefront"}),
	}
	m := istioManager(t, nil, pods, gw, bound, other)
	d, err := m.GetIstioGateway(context.Background(), "ctx", "istio-ingress", "public")
	if err != nil {
		t.Fatal(err)
	}
	if d.Ports != "80/HTTP, 443/HTTPS" || !reflect.DeepEqual(d.Hosts, []string{"shop/*.example.com"}) {
		t.Fatalf("summary = %q %v", d.Ports, d.Hosts)
	}
	if d.Servers[1].TLSMode != "SIMPLE" || d.Servers[1].CredentialName != "wildcard-example-com" || !d.Servers[0].HTTPSRedirect {
		t.Fatalf("servers = %+v", d.Servers)
	}
	// The selector picks gateway proxies in any namespace.
	if d.Workloads.Total != 2 {
		t.Fatalf("workloads = %+v", d.Workloads)
	}
	if !reflect.DeepEqual(d.VirtualServices, []IstioObjectRef{{Namespace: "shop", Name: "storefront"}}) {
		t.Fatalf("virtualServices = %+v", d.VirtualServices)
	}
}

func TestIstioAuthorizationPolicyEffect(t *testing.T) {
	cases := []struct {
		name, namespace, spec, effect, scope string
	}{
		{"allow nothing", "shop", `{}`, "Allows no requests (default deny)", "namespace-wide"},
		{"deny without rules", "shop", `{action: DENY, selector: {matchLabels: {app: api}}}`, "Matches no requests", "app=api"},
		{"allow all", "shop", `{rules: [{}]}`, "Matches all requests", "namespace-wide"},
		{"targeted", "shop", `{targetRefs: [{kind: Gateway, group: gateway.networking.k8s.io, name: public}], rules: [{to: [{operation: {methods: [GET]}}]}]}`, "", "Gateway/public"},
		{"root without selector", "istio-system", `{action: DENY, rules: [{}]}`, "Matches all requests", "mesh-wide"},
		{"root selector", "istio-system", `{selector: {matchLabels: {istio: ingressgateway}}, rules: [{}]}`, "Matches all requests", "istio=ingressgateway (all namespaces)"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			obj := mustUnstructured(t, "apiVersion: security.istio.io/v1\nkind: AuthorizationPolicy\nmetadata: {name: p, namespace: "+tc.namespace+"}\nspec: "+tc.spec)
			info := extractIstioAuthorizationPolicy(obj)
			if info.Effect != tc.effect || info.Scope != tc.scope {
				t.Fatalf("effect %q scope %q, want %q %q", info.Effect, info.Scope, tc.effect, tc.scope)
			}
		})
	}
}

func TestIstioAuthorizationPolicyRules(t *testing.T) {
	ap := istioFixture(t, "security.istio.io", "authorizationpolicies")
	pods := []*corev1.Pod{
		istioPod("shop", "orders-api-1", map[string]string{"app": "orders-api"}),
		istioPod("shop", "storefront-1", map[string]string{"app": "storefront"}),
	}
	m := istioManager(t, nil, pods, ap)
	d, err := m.GetIstioAuthorizationPolicy(context.Background(), "ctx", "shop", "orders-api")
	if err != nil {
		t.Fatal(err)
	}
	want := []IstioAuthorizationRule{
		{From: []string{"principals: cluster.local/ns/shop/sa/storefront"}, To: []string{"methods: GET, POST; paths: /api/orders*"}, When: []string{}},
		{From: []string{"namespaces: monitoring"}, To: []string{"ports: 15090"}, When: []string{"request.headers[x-scrape] in prometheus"}},
	}
	if !reflect.DeepEqual(d.RuleList, want) {
		t.Fatalf("rules = %+v", d.RuleList)
	}
	if d.Workloads.Total != 1 || d.Workloads.Pods[0].Name != "orders-api-1" {
		t.Fatalf("workloads = %+v", d.Workloads)
	}
}

func TestIstioRequestAuthenticationRules(t *testing.T) {
	d := istioJWTRules(istioFixture(t, "security.istio.io", "requestauthentications"))
	want := []IstioJWTRule{{
		Issuer: "https://auth.example.com/", Audiences: []string{"storefront"},
		JWKSURI: "https://auth.example.com/.well-known/jwks.json", FromHeaders: []string{"Authorization (prefix Bearer)"},
		FromParams: []string{}, FromCookies: []string{}, ForwardOriginalToken: true,
	}}
	if !reflect.DeepEqual(d, want) {
		t.Fatalf("jwt rules = %+v", d)
	}
}

// Istio matches a root-namespace AuthorizationPolicy or RequestAuthentication
// selector against every namespace's workloads, but looks a Sidecar's
// workloadSelector up only in the workload's own namespace.
func TestIstioRootNamespaceSelectors(t *testing.T) {
	ap := mustUnstructured(t, `
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata: {name: ingress, namespace: istio-system}
spec: {selector: {matchLabels: {istio: ingressgateway}}, rules: [{}]}
`)
	ra := mustUnstructured(t, `
apiVersion: security.istio.io/v1
kind: RequestAuthentication
metadata: {name: ingress-jwt, namespace: istio-system}
spec: {selector: {matchLabels: {istio: ingressgateway}}}
`)
	sc := mustUnstructured(t, `
apiVersion: networking.istio.io/v1
kind: Sidecar
metadata: {name: gateways, namespace: istio-system}
spec: {workloadSelector: {labels: {istio: ingressgateway}}}
`)
	local := mustUnstructured(t, `
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata: {name: ingress, namespace: istio-ingress}
spec: {selector: {matchLabels: {istio: ingressgateway}}, rules: [{}]}
`)
	pods := []*corev1.Pod{
		istioPod("istio-ingress", "istio-ingressgateway-1", map[string]string{"istio": "ingressgateway"}),
		istioPod("istio-system", "istio-ingressgateway-2", map[string]string{"istio": "ingressgateway"}),
		istioPod("shop", "storefront-1", map[string]string{"app": "storefront"}),
	}
	m := istioManager(t, nil, pods, ap, ra, sc, local)
	ctx := context.Background()

	apd, err := m.GetIstioAuthorizationPolicy(ctx, "ctx", "istio-system", "ingress")
	if err != nil {
		t.Fatal(err)
	}
	if apd.Workloads.Total != 2 || !apd.MeshWide {
		t.Fatalf("root authorization policy: workloads %+v meshWide %v", apd.Workloads, apd.MeshWide)
	}
	rad, err := m.GetIstioRequestAuthentication(ctx, "ctx", "istio-system", "ingress-jwt")
	if err != nil {
		t.Fatal(err)
	}
	if rad.Workloads.Total != 2 || !rad.MeshWide || rad.Scope != "istio=ingressgateway (all namespaces)" {
		t.Fatalf("root request authentication: workloads %+v meshWide %v scope %q", rad.Workloads, rad.MeshWide, rad.Scope)
	}
	scd, err := m.GetIstioSidecar(ctx, "ctx", "istio-system", "gateways")
	if err != nil {
		t.Fatal(err)
	}
	if scd.Workloads.Total != 1 || scd.Workloads.Pods[0].Namespace != "istio-system" || scd.Selector != "istio=ingressgateway" {
		t.Fatalf("root sidecar: workloads %+v selector %q", scd.Workloads, scd.Selector)
	}
	lpd, err := m.GetIstioAuthorizationPolicy(ctx, "ctx", "istio-ingress", "ingress")
	if err != nil {
		t.Fatal(err)
	}
	if lpd.Workloads.Total != 1 || lpd.MeshWide {
		t.Fatalf("namespaced authorization policy: workloads %+v meshWide %v", lpd.Workloads, lpd.MeshWide)
	}
}

func TestIstioSidecarScope(t *testing.T) {
	info := extractIstioSidecar(istioFixture(t, "networking.istio.io", "sidecars"))
	if info.Selector != "namespace-wide" || info.OutboundPolicy != "REGISTRY_ONLY" || len(info.EgressHosts) != 3 {
		t.Fatalf("sidecar = %+v", info)
	}
}
