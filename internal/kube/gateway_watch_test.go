package kube

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	authv1 "k8s.io/api/authorization/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/kubernetes/fake"
	clienttesting "k8s.io/client-go/testing"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
	gatewayv1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"
	gwfake "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned/fake"
	gwinformers "sigs.k8s.io/gateway-api/pkg/client/informers/externalversions"
)

type gatewayDiscoveryStub struct {
	discovery.DiscoveryInterface
	resources map[string][]metav1.APIResource
	failures  map[string][]error
	calls     map[string]int
}

func (d *gatewayDiscoveryStub) ServerResourcesForGroupVersion(gv string) (*metav1.APIResourceList, error) {
	if d.calls == nil {
		d.calls = make(map[string]int)
	}
	attempt := d.calls[gv]
	d.calls[gv]++
	if failures := d.failures[gv]; attempt < len(failures) && failures[attempt] != nil {
		return nil, failures[attempt]
	}
	resources, ok := d.resources[gv]
	if !ok {
		return nil, apierrors.NewNotFound(schema.GroupResource{Group: "gateway.networking.k8s.io"}, gv)
	}
	return &metav1.APIResourceList{GroupVersion: gv, APIResources: resources}, nil
}

func gatewayTestResource(kind, resource string) metav1.APIResource {
	return metav1.APIResource{
		Name:       resource,
		Kind:       kind,
		Namespaced: kind != "GatewayClass",
		Verbs:      metav1.Verbs{"get", "list", "watch", "delete", "patch"},
	}
}

func TestDiscoverGatewayVersionsPrefersStablePerResource(t *testing.T) {
	d := &gatewayDiscoveryStub{resources: map[string][]metav1.APIResource{
		"gateway.networking.k8s.io/v1": {
			gatewayTestResource("Gateway", "gateways"),
			gatewayTestResource("GatewayClass", "gatewayclasses"),
			gatewayTestResource("HTTPRoute", "httproutes"),
			gatewayTestResource("GRPCRoute", "grpcroutes"),
			gatewayTestResource("TLSRoute", "tlsroutes"),
			gatewayTestResource("TCPRoute", "tcproutes"),
			gatewayTestResource("UDPRoute", "udproutes"),
			gatewayTestResource("ListenerSet", "listenersets"),
			gatewayTestResource("BackendTLSPolicy", "backendtlspolicies"),
			gatewayTestResource("ReferenceGrant", "referencegrants"),
		},
		"gateway.networking.k8s.io/v1alpha2": {
			gatewayTestResource("TLSRoute", "tlsroutes"),
			gatewayTestResource("TCPRoute", "tcproutes"),
			gatewayTestResource("UDPRoute", "udproutes"),
		},
		"gateway.networking.k8s.io/v1alpha3": {
			gatewayTestResource("TLSRoute", "tlsroutes"),
			gatewayTestResource("BackendTLSPolicy", "backendtlspolicies"),
		},
		"gateway.networking.k8s.io/v1beta1": {gatewayTestResource("ReferenceGrant", "referencegrants")},
	}}
	want := map[string]string{
		"Gateway": "v1", "GatewayClass": "v1", "HTTPRoute": "v1", "GRPCRoute": "v1",
		"TLSRoute": "v1", "TCPRoute": "v1", "UDPRoute": "v1", "ListenerSet": "v1",
		"BackendTLSPolicy": "v1", "ReferenceGrant": "v1",
	}
	if got, pending := discoverGatewayVersions(t.Context(), d); len(pending) != 0 || !reflect.DeepEqual(got, want) {
		t.Fatalf("versions = %v, want %v", got, want)
	}
	for gv, count := range d.calls {
		if count != 1 {
			t.Errorf("discovery requested %s %d times, want a shared result", gv, count)
		}
	}
}

func TestDiscoverGatewayVersionsFallsBackIndividually(t *testing.T) {
	d := &gatewayDiscoveryStub{resources: map[string][]metav1.APIResource{
		"gateway.networking.k8s.io/v1": {
			gatewayTestResource("Gateway", "gateways"),
			gatewayTestResource("TLSRoute", "tlsroutes/status"),
		},
		"gateway.networking.k8s.io/v1alpha2": {
			gatewayTestResource("TLSRoute", "tlsroutes"),
			gatewayTestResource("TCPRoute", "tcproutes"),
			gatewayTestResource("UDPRoute", "udproutes"),
		},
		"gateway.networking.k8s.io/v1alpha3": {
			gatewayTestResource("TLSRoute", "tlsroutes"),
			gatewayTestResource("BackendTLSPolicy", "backendtlspolicies"),
		},
		"gateway.networking.k8s.io/v1beta1": {gatewayTestResource("ReferenceGrant", "referencegrants")},
	}}
	want := map[string]string{
		"Gateway": "v1", "TLSRoute": "v1alpha3", "TCPRoute": "v1alpha2",
		"UDPRoute": "v1alpha2", "BackendTLSPolicy": "v1alpha3", "ReferenceGrant": "v1beta1",
	}
	if got, pending := discoverGatewayVersions(t.Context(), d); len(pending) != 0 || !reflect.DeepEqual(got, want) {
		t.Fatalf("versions = %v, want %v", got, want)
	}
	delete(d.resources, "gateway.networking.k8s.io/v1alpha3")
	d.calls = nil
	want["TLSRoute"] = "v1alpha2"
	delete(want, "BackendTLSPolicy")
	if got, pending := discoverGatewayVersions(t.Context(), d); len(pending) != 0 || !reflect.DeepEqual(got, want) {
		t.Fatalf("older versions = %v, want %v", got, want)
	}
}

func TestDiscoverGatewayVersionsRetriesTransientFailure(t *testing.T) {
	for _, tc := range []struct {
		name     string
		failures []error
		want     string
	}{
		{name: "recovers", failures: []error{errors.New("discovery temporarily unavailable")}, want: "v1"},
		{name: "persistent failure does not invent support", failures: []error{errors.New("offline"), errors.New("offline")}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := &gatewayDiscoveryStub{
				resources: map[string][]metav1.APIResource{
					"gateway.networking.k8s.io/v1": {gatewayTestResource("ListenerSet", "listenersets")},
				},
				failures: map[string][]error{"gateway.networking.k8s.io/v1": tc.failures},
			}
			versions, pending := discoverGatewayVersions(t.Context(), d)
			if pending["ListenerSet"] != (tc.want == "") {
				t.Fatalf("unexpected pending discovery: %v", pending)
			}
			if got := versions["ListenerSet"]; got != tc.want {
				t.Fatalf("ListenerSet version = %q, want %q", got, tc.want)
			}
			if got := d.calls["gateway.networking.k8s.io/v1"]; got != 2 {
				t.Errorf("failed version discovery calls = %d, want 2", got)
			}
		})
	}
	if got, pending := discoverGatewayVersions(t.Context(), &gatewayDiscoveryStub{}); len(pending) != 0 || len(got) != 0 {
		t.Fatalf("missing API group yielded versions: %v", got)
	}
}

func TestDiscoverGatewayAccessRequiresListAndWatchPerKind(t *testing.T) {
	versions := map[string]string{
		"TLSRoute": "v1alpha2", "TCPRoute": "v1", "UDPRoute": "v1",
		"ListenerSet": "v1", "BackendTLSPolicy": "v1alpha3", "GatewayClass": "v1",
	}
	cs := fakeSAR(t, map[string]bool{
		"list:tlsroutes:": true, "watch:tlsroutes:": true,
		"list:tcproutes:":       true,
		"list:tcproutes:team-a": true, "watch:tcproutes:team-a": true,
		"list:udproutes:": true, "list:udproutes:team-a": true,
		"watch:listenersets:": true, "watch:listenersets:team-a": true,
		"list:backendtlspolicies:team-a": true, "watch:backendtlspolicies:team-a": true,
		"list:gatewayclasses:team-a": true, "watch:gatewayclasses:team-a": true,
	})
	got := discoverGatewayAccess(t.Context(), cs, versions, "team-a", nil)
	for kind, want := range map[string]KindAccess{
		"TLSRoute":         {Mode: AccessCluster},
		"TCPRoute":         {Mode: AccessNamespaced, Namespace: "team-a"},
		"UDPRoute":         {Mode: AccessDenied},
		"ListenerSet":      {Mode: AccessDenied},
		"BackendTLSPolicy": {Mode: AccessNamespaced, Namespace: "team-a"},
		"GatewayClass":     {Mode: AccessDenied},
	} {
		if access := got.For(kind); access != want {
			t.Errorf("%s access = %+v, want %+v", kind, access, want)
		}
	}
	for _, action := range cs.Actions() {
		r := action.(clienttesting.CreateAction).GetObject().(*authv1.SelfSubjectAccessReview).Spec.ResourceAttributes
		if r.Group != "gateway.networking.k8s.io" || (r.Verb != "list" && r.Verb != "watch") {
			t.Errorf("unexpected access probe: %+v", r)
		}
		if r.Resource == "tlsroutes" && r.Version != "v1alpha2" {
			t.Errorf("TLSRoute probe version = %q, want v1alpha2", r.Version)
		}
		if r.Resource == "backendtlspolicies" && r.Version != "v1alpha3" {
			t.Errorf("BackendTLSPolicy probe version = %q, want v1alpha3", r.Version)
		}
		if r.Resource == "gateways" || (r.Resource == "gatewayclasses" && r.Namespace != "") {
			t.Errorf("probed an unavailable or invalid namespace target: %+v", r)
		}
	}
}

func TestDiscoverGatewayAccessWithoutNamespaceDoesNotProbeScopes(t *testing.T) {
	cs := fakeSAR(t, map[string]bool{"list:tcproutes:team-a": true, "watch:tcproutes:team-a": true})
	got := discoverGatewayAccess(t.Context(), cs, map[string]string{"TCPRoute": "v1alpha2"}, "", nil)
	if access := got.For("TCPRoute"); access.Mode != AccessDenied {
		t.Fatalf("access = %+v, want denied", access)
	}
	for _, action := range cs.Actions() {
		r := action.(clienttesting.CreateAction).GetObject().(*authv1.SelfSubjectAccessReview).Spec.ResourceAttributes
		if r.Namespace != "" {
			t.Errorf("unexpected namespace probe: %q", r.Namespace)
		}
	}
	cs.ClearActions()
	discoverGatewayAccess(t.Context(), cs, map[string]string{}, "team-a", nil)
	if actions := cs.Actions(); len(actions) != 0 {
		t.Fatalf("unserved resources triggered access requests: %v", actions)
	}
}

func TestDiscoverGatewayAccessRetriesOnlyErrors(t *testing.T) {
	for _, tc := range []struct {
		name      string
		errors    int
		allowed   bool
		wantMode  AccessMode
		wantLists int
	}{
		{name: "transient failure", errors: 1, allowed: true, wantMode: AccessCluster, wantLists: 2},
		{name: "persistent failure", errors: 2, allowed: true, wantMode: AccessUnknown, wantLists: 2},
		{name: "authoritative denial", allowed: false, wantMode: AccessDenied, wantLists: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cs := fake.NewClientset()
			lists := 0
			cs.PrependReactor("create", "selfsubjectaccessreviews", func(action clienttesting.Action) (bool, runtime.Object, error) {
				review := action.(clienttesting.CreateAction).GetObject().(*authv1.SelfSubjectAccessReview)
				if review.Spec.ResourceAttributes.Verb == "list" {
					lists++
					if lists <= tc.errors {
						return true, nil, errors.New("temporary access review error")
					}
				}
				return true, &authv1.SelfSubjectAccessReview{Status: authv1.SubjectAccessReviewStatus{Allowed: tc.allowed}}, nil
			})
			got := discoverGatewayAccess(t.Context(), cs, map[string]string{"TLSRoute": "v1"}, "", nil)
			if mode := got.For("TLSRoute").Mode; mode != tc.wantMode {
				t.Errorf("access mode = %v, want %v", mode, tc.wantMode)
			}
			if lists != tc.wantLists {
				t.Errorf("list access probes = %d, want %d", lists, tc.wantLists)
			}
		})
	}
}

func TestGatewayFactoryRoutesByKindAndAvailability(t *testing.T) {
	gw := gwfake.NewClientset()
	cluster := gwinformers.NewSharedInformerFactory(gw, 0)
	scoped := gwinformers.NewSharedInformerFactoryWithOptions(gw, 0, gwinformers.WithNamespace("team-a"))
	w := &contextWatcher{
		gwFactory: cluster, gwScoped: scoped,
		gwVersions: map[string]string{"TLSRoute": "v1", "TCPRoute": "v1alpha2", "UDPRoute": "v1"},
		gwAccess: &contextAccess{kinds: map[string]KindAccess{
			"TLSRoute": {Mode: AccessCluster}, "TCPRoute": {Mode: AccessNamespaced, Namespace: "team-a"},
			"UDPRoute": {Mode: AccessDenied}, "ListenerSet": {Mode: AccessCluster},
		}},
	}
	for kind, want := range map[string]gwinformers.SharedInformerFactory{
		"TLSRoute": cluster, "TCPRoute": scoped, "UDPRoute": nil, "ListenerSet": nil, "Unknown": nil,
	} {
		if got := w.gatewayFactoryFor(kind); got != want {
			t.Errorf("factory for %s = %v, want %v", kind, got, want)
		}
	}
}

func TestResolveGatewayKindUsesSelectedContextVersion(t *testing.T) {
	m := &ClientManager{watchers: map[string]*contextWatcher{
		"modern": {gwVersions: map[string]string{"TLSRoute": "v1", "TCPRoute": "v1", "UDPRoute": "v1", "BackendTLSPolicy": "v1", "ReferenceGrant": "v1"}},
		"legacy": {gwVersions: map[string]string{"TLSRoute": "v1alpha2", "TCPRoute": "v1alpha2", "UDPRoute": "v1alpha2", "BackendTLSPolicy": "v1alpha3", "ReferenceGrant": "v1beta1"}},
	}}
	for contextName, w := range m.watchers {
		for kind, version := range w.gwVersions {
			got, err := m.resolveKind(contextName, kind)
			if err != nil {
				t.Fatalf("resolve %s in %s: %v", kind, contextName, err)
			}
			if got.Version != version || got.Group != "gateway.networking.k8s.io" {
				t.Errorf("resolve %s in %s = %v, want selected version %s", kind, contextName, got, version)
			}
		}
	}
	if _, err := m.resolveKind("legacy", "ListenerSet"); err == nil {
		t.Fatal("resolved an unavailable ListenerSet version")
	}
}

func newGatewayWatchFixture(t *testing.T, gw *gwfake.Clientset, versions map[string]string, access map[string]KindAccess) (*contextWatcher, <-chan string) {
	t.Helper()
	ctx, cancel := context.WithCancel(t.Context())
	changes := make(chan string, 64)
	allow := make(map[string]bool)
	for kind, mode := range access {
		if mode.Mode == AccessDenied {
			continue
		}
		namespace := ""
		if mode.Mode == AccessNamespaced {
			namespace = mode.Namespace
		}
		resource := kindToGVR[kind].Resource
		allow["list:"+resource+":"+namespace] = true
		allow["watch:"+resource+":"+namespace] = true
	}
	w := &contextWatcher{
		cs: fakeSAR(t, allow), defaultNS: "team-a",
		gwFactory:  gwinformers.NewSharedInformerFactory(gw, 0),
		gwScoped:   gwinformers.NewSharedInformerFactoryWithOptions(gw, 0, gwinformers.WithNamespace("team-a")),
		gwVersions: versions,
		gwAccess:   &contextAccess{kinds: access},
		pending:    make(map[string]*pendingKind), gen: make(map[string]uint64), cancel: cancel,
		onChange: func(kind string, _ *KindDelta) { changes <- kind },
	}
	t.Cleanup(func() {
		w.stop()
		w.gwFactory.Shutdown()
		w.gwScoped.Shutdown()
	})
	if err := w.startGatewayInformers(ctx); err != nil {
		t.Fatalf("start Gateway informers: %v", err)
	}
	return w, changes
}

func awaitGatewayChanges(t *testing.T, changes <-chan string, kinds ...string) {
	t.Helper()
	remaining := make(map[string]bool, len(kinds))
	for _, kind := range kinds {
		remaining[kind] = true
	}
	timer := time.NewTimer(3 * time.Second)
	defer timer.Stop()
	for len(remaining) != 0 {
		select {
		case kind := <-changes:
			delete(remaining, kind)
		case <-timer.C:
			t.Fatalf("no cache-sync notifications for %v", remaining)
		}
	}
}

func TestGatewayInformersStartOnlyAllowedServedVersions(t *testing.T) {
	gw := gwfake.NewClientset()
	_, changes := newGatewayWatchFixture(t, gw,
		map[string]string{"TLSRoute": "v1alpha2", "TCPRoute": "v1", "UDPRoute": "v1", "BackendTLSPolicy": "v1alpha3"},
		map[string]KindAccess{
			"TLSRoute": {Mode: AccessCluster}, "TCPRoute": {Mode: AccessNamespaced, Namespace: "team-a"},
			"UDPRoute": {Mode: AccessDenied}, "BackendTLSPolicy": {Mode: AccessCluster}, "ListenerSet": {Mode: AccessCluster},
		},
	)
	awaitGatewayChanges(t, changes, "TLSRoute", "TCPRoute", "BackendTLSPolicy")
	seen := make(map[string]bool)
	for _, action := range gw.Actions() {
		if action.GetVerb() != "list" && action.GetVerb() != "watch" {
			continue
		}
		gvr := action.GetResource()
		key := action.GetVerb() + ":" + gvr.Resource
		seen[key] = true
		switch gvr.Resource {
		case "tlsroutes":
			if gvr.Version != "v1alpha2" || action.GetNamespace() != "" {
				t.Errorf("TLSRoute action = %#v", action)
			}
		case "tcproutes":
			if gvr.Version != "v1" || action.GetNamespace() != "team-a" {
				t.Errorf("TCPRoute action = %#v", action)
			}
		case "backendtlspolicies":
			if gvr.Version != "v1alpha3" || action.GetNamespace() != "" {
				t.Errorf("BackendTLSPolicy action = %#v", action)
			}
		default:
			t.Errorf("unexpected informer request for denied or unavailable resource: %#v", action)
		}
	}
	for _, resource := range []string{"tlsroutes", "tcproutes", "backendtlspolicies"} {
		for _, verb := range []string{"list", "watch"} {
			if !seen[verb+":"+resource] {
				t.Errorf("missing %s request for %s", verb, resource)
			}
		}
	}
}

func TestGatewayInformerFailureDoesNotBlockAnotherKind(t *testing.T) {
	gw := gwfake.NewClientset()
	gw.PrependReactor("list", "gateways", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewForbidden(schema.GroupResource{Group: "gateway.networking.k8s.io", Resource: "gateways"}, "", errors.New("access changed"))
	})
	_, changes := newGatewayWatchFixture(t, gw,
		map[string]string{"Gateway": "v1", "ListenerSet": "v1"},
		map[string]KindAccess{"Gateway": {Mode: AccessCluster}, "ListenerSet": {Mode: AccessCluster}},
	)
	awaitGatewayChanges(t, changes, "ListenerSet")
	for _, action := range gw.Actions() {
		if action.GetVerb() == "watch" && action.GetResource().Resource == "gateways" {
			t.Fatal("started a watch after the Gateway list failed")
		}
	}
}

func TestGatewayInformersSupportEverySelectedVersion(t *testing.T) {
	for _, tc := range []struct {
		name     string
		versions map[string]string
	}{
		{name: "stable", versions: map[string]string{
			"Gateway": "v1", "GatewayClass": "v1", "HTTPRoute": "v1", "GRPCRoute": "v1",
			"TLSRoute": "v1", "TCPRoute": "v1", "UDPRoute": "v1", "ListenerSet": "v1",
			"BackendTLSPolicy": "v1", "ReferenceGrant": "v1",
		}},
		{name: "legacy", versions: map[string]string{
			"TLSRoute": "v1alpha3", "TCPRoute": "v1alpha2", "UDPRoute": "v1alpha2",
			"BackendTLSPolicy": "v1alpha3", "ReferenceGrant": "v1beta1",
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gw := gwfake.NewClientset()
			access := make(map[string]KindAccess, len(tc.versions))
			kinds := make([]string, 0, len(tc.versions))
			wantResources := make(map[schema.GroupVersionResource]bool, len(tc.versions))
			for kind, version := range tc.versions {
				access[kind] = KindAccess{Mode: AccessCluster}
				kinds = append(kinds, kind)
				gvr := kindToGVR[kind]
				gvr.Version = version
				wantResources[gvr] = true
			}
			_, changes := newGatewayWatchFixture(t, gw, tc.versions, access)
			awaitGatewayChanges(t, changes, kinds...)
			for _, action := range gw.Actions() {
				if action.GetVerb() == "watch" {
					if !wantResources[action.GetResource()] {
						t.Errorf("unexpected watched resource: %s", action.GetResource())
					}
					delete(wantResources, action.GetResource())
				}
			}
			if len(wantResources) != 0 {
				t.Errorf("selected resources without a watch: %v", wantResources)
			}
		})
	}
}

func TestGatewayInformerPropagatesResourceChanges(t *testing.T) {
	gw := gwfake.NewClientset()
	w, changes := newGatewayWatchFixture(t, gw,
		map[string]string{"TLSRoute": "v1"},
		map[string]KindAccess{"TLSRoute": {Mode: AccessCluster}},
	)
	awaitGatewayChanges(t, changes, "TLSRoute")
	client := gw.GatewayV1().TLSRoutes("team-a")
	created, err := client.Create(t.Context(), &gatewayv1.TLSRoute{
		ObjectMeta: metav1.ObjectMeta{Name: "database", Namespace: "team-a", ResourceVersion: "1"},
		Spec:       gatewayv1.TLSRouteSpec{Hostnames: []gatewayv1.Hostname{"database.example.test"}},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatal(err)
	}
	awaitGatewayChanges(t, changes, "TLSRoute")
	lister := w.gwFactory.Gateway().V1().TLSRoutes().Lister().TLSRoutes("team-a")
	listed, err := lister.Get("database")
	if err != nil || len(listed.Spec.Hostnames) != 1 || listed.Spec.Hostnames[0] != "database.example.test" {
		t.Fatalf("created TLSRoute missing from informer: object=%v error=%v", listed, err)
	}
	created.Spec.Hostnames = []gatewayv1.Hostname{"updated.example.test"}
	created.ResourceVersion = "2"
	if _, err := client.Update(t.Context(), created, metav1.UpdateOptions{}); err != nil {
		t.Fatal(err)
	}
	awaitGatewayChanges(t, changes, "TLSRoute")
	listed, err = lister.Get("database")
	if err != nil || len(listed.Spec.Hostnames) != 1 || listed.Spec.Hostnames[0] != "updated.example.test" {
		t.Fatalf("updated TLSRoute missing from informer: object=%v error=%v", listed, err)
	}
	if err := client.Delete(t.Context(), "database", metav1.DeleteOptions{}); err != nil {
		t.Fatal(err)
	}
	awaitGatewayChanges(t, changes, "TLSRoute")
	if _, err := lister.Get("database"); !apierrors.IsNotFound(err) {
		t.Fatalf("deleted TLSRoute still cached: %v", err)
	}
}

func TestGatewayInformerStopsWithContext(t *testing.T) {
	gw := gwfake.NewClientset()
	stream := watch.NewRaceFreeFake()
	gw.PrependWatchReactor("listenersets", func(clienttesting.Action) (bool, watch.Interface, error) {
		return true, stream, nil
	})
	w, changes := newGatewayWatchFixture(t, gw,
		map[string]string{"ListenerSet": "v1"},
		map[string]KindAccess{"ListenerSet": {Mode: AccessCluster}},
	)
	awaitGatewayChanges(t, changes, "ListenerSet")
	w.stop()
	w.gwFactory.Shutdown()
	if !stream.IsStopped() {
		t.Fatal("watch stream remained open after stopping context")
	}
}

func TestExistingGatewayViewsUseScopedFactory(t *testing.T) {
	for _, grantVersion := range []string{"v1", "v1beta1"} {
		t.Run(grantVersion, func(t *testing.T) {
			objects := []runtime.Object{&gatewayv1.GatewayClass{ObjectMeta: metav1.ObjectMeta{Name: "hidden"}}}
			for _, namespace := range []string{"team-a", "team-b"} {
				meta := metav1.ObjectMeta{Name: "example", Namespace: namespace}
				objects = append(objects,
					&gatewayv1.HTTPRoute{ObjectMeta: meta},
					&gatewayv1.GRPCRoute{ObjectMeta: meta},
				)
				grant := gatewayv1.ReferenceGrant{ObjectMeta: meta}
				if grantVersion == "v1" {
					objects = append(objects, &grant)
				} else {
					legacy := gatewayv1beta1.ReferenceGrant(grant)
					objects = append(objects, &legacy)
				}
			}
			gw := gwfake.NewSimpleClientset(objects...)
			for _, namespace := range []string{"team-a", "team-b"} {
				if _, err := gw.GatewayV1().Gateways(namespace).Create(t.Context(), &gatewayv1.Gateway{
					ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: namespace},
				}, metav1.CreateOptions{}); err != nil {
					t.Fatal(err)
				}
			}
			versions := map[string]string{"Gateway": "v1", "HTTPRoute": "v1", "GRPCRoute": "v1", "GatewayClass": "v1", "ReferenceGrant": grantVersion}
			access := map[string]KindAccess{"GatewayClass": {Mode: AccessDenied}}
			for _, kind := range []string{"Gateway", "HTTPRoute", "GRPCRoute", "ReferenceGrant"} {
				access[kind] = KindAccess{Mode: AccessNamespaced, Namespace: "team-a"}
			}
			w, changes := newGatewayWatchFixture(t, gw, versions, access)
			awaitGatewayChanges(t, changes, "Gateway", "HTTPRoute", "GRPCRoute", "ReferenceGrant")
			for _, tc := range []struct {
				kind string
				list func(string) int
				get  func(string) error
			}{
				{"Gateway", func(ns string) int { return len(w.Gateways(ns)) }, func(ns string) error { _, err := w.Gateway(ns, "example"); return err }},
				{"HTTPRoute", func(ns string) int { return len(w.HTTPRoutes(ns)) }, func(ns string) error { _, err := w.HTTPRoute(ns, "example"); return err }},
				{"GRPCRoute", func(ns string) int { return len(w.GRPCRoutes(ns)) }, func(ns string) error { _, err := w.GRPCRoute(ns, "example"); return err }},
				{"ReferenceGrant", func(ns string) int { return len(w.ReferenceGrants(ns)) }, func(ns string) error { _, err := w.ReferenceGrant(ns, "example"); return err }},
			} {
				if count := tc.list(""); count != 1 {
					t.Errorf("%s all-namespace view contains %d objects, want scoped count 1", tc.kind, count)
				}
				if count := tc.list("team-b"); count != 0 {
					t.Errorf("%s leaked %d resources outside the allowed namespace", tc.kind, count)
				}
				if err := tc.get("team-a"); err != nil {
					t.Errorf("%s allowed detail: %v", tc.kind, err)
				}
				if err := tc.get("team-b"); !apierrors.IsNotFound(err) {
					t.Errorf("%s out-of-scope detail error = %v, want not found", tc.kind, err)
				}
			}
			if len(w.GatewayClasses()) != 0 {
				t.Error("denied GatewayClass view returned resources")
			}
			if _, err := w.GatewayClass("hidden"); err == nil {
				t.Error("denied GatewayClass detail returned a resource")
			}
		})
	}
}
