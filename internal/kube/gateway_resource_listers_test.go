package kube

import (
	"encoding/json"
	"reflect"
	"testing"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/utils/ptr"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
	gatewayv1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
	gatewayv1alpha3 "sigs.k8s.io/gateway-api/apis/v1alpha3"
	gwfake "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned/fake"
	gwinformers "sigs.k8s.io/gateway-api/pkg/client/informers/externalversions"
)

type gatewayResourceTestCase struct {
	kind     string
	resource string
	object   runtime.Object
	list     func(*ClientManager, string, string) any
	get      func(*ClientManager, string, string, string) (any, error)
	versions map[string]runtime.Object
}

func gatewayResourceTestCases() []gatewayResourceTestCase {
	metadata := metav1.ObjectMeta{Name: "resource", Namespace: "app", UID: "resource-uid", Generation: 2}
	common := gatewayv1.CommonRouteSpec{ParentRefs: []gatewayv1.ParentReference{{Name: "gateway", SectionName: ptr.To(gatewayv1.SectionName("listener"))}}}
	backends := []gatewayv1.BackendRef{{BackendObjectReference: gatewayv1.BackendObjectReference{Name: "backend", Port: ptr.To(gatewayv1.PortNumber(8080))}, Weight: ptr.To(int32(0))}}
	status := gatewayv1.RouteStatus{Parents: []gatewayv1.RouteParentStatus{{ParentRef: common.ParentRefs[0], ControllerName: "example.net/controller", Conditions: []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionTrue, ObservedGeneration: 2}}}}}
	return []gatewayResourceTestCase{
		{kind: "TLSRoute", resource: "tlsroutes", object: &gatewayv1.TLSRoute{ObjectMeta: metadata, Spec: gatewayv1.TLSRouteSpec{CommonRouteSpec: common, Hostnames: []gatewayv1.Hostname{"app.example.net"}, Rules: []gatewayv1.TLSRouteRule{{Name: ptr.To(gatewayv1.SectionName("tls-rule")), BackendRefs: backends}}}, Status: gatewayv1.TLSRouteStatus{RouteStatus: status}},
			list:     func(m *ClientManager, ctx, ns string) any { return m.TLSRoutes(ctx, ns) },
			get:      func(m *ClientManager, ctx, ns, name string) (any, error) { return m.TLSRoute(ctx, ns, name) },
			versions: map[string]runtime.Object{"v1": &gatewayv1.TLSRoute{}, "v1alpha3": &gatewayv1alpha3.TLSRoute{}, "v1alpha2": &gatewayv1alpha2.TLSRoute{}}},
		{kind: "TCPRoute", resource: "tcproutes", object: &gatewayv1.TCPRoute{ObjectMeta: metadata, Spec: gatewayv1.TCPRouteSpec{CommonRouteSpec: common, Rules: []gatewayv1.TCPRouteRule{{Name: ptr.To(gatewayv1.SectionName("tcp-rule")), BackendRefs: backends}}}, Status: gatewayv1.TCPRouteStatus{RouteStatus: status}},
			list:     func(m *ClientManager, ctx, ns string) any { return m.TCPRoutes(ctx, ns) },
			get:      func(m *ClientManager, ctx, ns, name string) (any, error) { return m.TCPRoute(ctx, ns, name) },
			versions: map[string]runtime.Object{"v1": &gatewayv1.TCPRoute{}, "v1alpha2": &gatewayv1alpha2.TCPRoute{}}},
		{kind: "UDPRoute", resource: "udproutes", object: &gatewayv1.UDPRoute{ObjectMeta: metadata, Spec: gatewayv1.UDPRouteSpec{CommonRouteSpec: common, Rules: []gatewayv1.UDPRouteRule{{Name: ptr.To(gatewayv1.SectionName("udp-rule")), BackendRefs: backends}}}, Status: gatewayv1.UDPRouteStatus{RouteStatus: status}},
			list:     func(m *ClientManager, ctx, ns string) any { return m.UDPRoutes(ctx, ns) },
			get:      func(m *ClientManager, ctx, ns, name string) (any, error) { return m.UDPRoute(ctx, ns, name) },
			versions: map[string]runtime.Object{"v1": &gatewayv1.UDPRoute{}, "v1alpha2": &gatewayv1alpha2.UDPRoute{}}},
		{kind: "ListenerSet", resource: "listenersets", object: &gatewayv1.ListenerSet{ObjectMeta: metadata, Spec: gatewayv1.ListenerSetSpec{ParentRef: gatewayv1.ParentGatewayReference{Name: "gateway"}, Listeners: []gatewayv1.ListenerEntry{{Name: "web", Protocol: "HTTP", Port: 80}}}, Status: gatewayv1.ListenerSetStatus{Conditions: status.Parents[0].Conditions}},
			list:     func(m *ClientManager, ctx, ns string) any { return m.ListenerSets(ctx, ns) },
			get:      func(m *ClientManager, ctx, ns, name string) (any, error) { return m.ListenerSet(ctx, ns, name) },
			versions: map[string]runtime.Object{"v1": &gatewayv1.ListenerSet{}}},
		{kind: "BackendTLSPolicy", resource: "backendtlspolicies", object: &gatewayv1.BackendTLSPolicy{ObjectMeta: metadata, Spec: gatewayv1.BackendTLSPolicySpec{TargetRefs: []gatewayv1.LocalPolicyTargetReferenceWithSectionName{{LocalPolicyTargetReference: gatewayv1.LocalPolicyTargetReference{Kind: "Service", Name: "backend"}, SectionName: ptr.To(gatewayv1.SectionName("https"))}}, Validation: gatewayv1.BackendTLSPolicyValidation{Hostname: "backend.example.net", WellKnownCACertificates: ptr.To(gatewayv1.WellKnownCACertificatesSystem)}}, Status: gatewayv1.PolicyStatus{Ancestors: []gatewayv1.PolicyAncestorStatus{{AncestorRef: common.ParentRefs[0], ControllerName: status.Parents[0].ControllerName, Conditions: status.Parents[0].Conditions}}}},
			list:     func(m *ClientManager, ctx, ns string) any { return m.BackendTLSPolicies(ctx, ns) },
			get:      func(m *ClientManager, ctx, ns, name string) (any, error) { return m.BackendTLSPolicy(ctx, ns, name) },
			versions: map[string]runtime.Object{"v1": &gatewayv1.BackendTLSPolicy{}, "v1alpha3": &gatewayv1alpha3.BackendTLSPolicy{}}},
	}
}

func TestGatewayResourceListersAcrossServedVersions(t *testing.T) {
	for _, test := range gatewayResourceTestCases() {
		t.Run(test.kind, func(t *testing.T) {
			baseline := newGatewayResourceManager(t, test.kind, test.resource, "v1", test.object)
			wantDetail, err := test.get(baseline, "ctx", "app", "resource")
			if err != nil {
				t.Fatal(err)
			}
			wantList := test.list(baseline, "ctx", "app")
			data, err := json.Marshal(test.object)
			if err != nil {
				t.Fatal(err)
			}
			for version, target := range test.versions {
				t.Run(version, func(t *testing.T) {
					if err := json.Unmarshal(data, target); err != nil {
						t.Fatal(err)
					}
					m := newGatewayResourceManager(t, test.kind, test.resource, version, target)
					got, err := test.get(m, "ctx", "app", "resource")
					if err != nil {
						t.Fatal(err)
					}
					if !reflect.DeepEqual(got, wantDetail) {
						t.Fatalf("%s detail = %#v, want %#v", version, got, wantDetail)
					}
					if gotList := test.list(m, "ctx", "app"); !reflect.DeepEqual(gotList, wantList) {
						t.Fatalf("%s list = %#v, want %#v", version, gotList, wantList)
					}
					if _, err := test.get(m, "ctx", "other", "resource"); err == nil {
						t.Fatal("detail lookup crossed namespaces")
					}
				})
			}
		})
	}
}

func TestGatewayResourceManagersPreserveNamespaceSelection(t *testing.T) {
	for _, test := range gatewayResourceTestCases() {
		t.Run(test.kind, func(t *testing.T) {
			objects := make([]runtime.Object, 0, 3)
			for _, row := range []struct{ ns, name string }{{"b", "one"}, {"a", "two"}, {"a", "one"}} {
				object := test.object.DeepCopyObject()
				metadata, err := meta.Accessor(object)
				if err != nil {
					t.Fatal(err)
				}
				metadata.SetNamespace(row.ns)
				metadata.SetName(row.name)
				objects = append(objects, object)
			}
			m := newGatewayResourceManager(t, test.kind, test.resource, "v1", objects...)
			for _, selection := range []struct {
				namespaces string
				want       []string
			}{
				{"", []string{"a/one", "a/two", "b/one"}},
				{"a", []string{"a/one", "a/two"}},
				{"a,b", []string{"a/one", "a/two", "b/one"}},
				{"missing", []string{}},
			} {
				got := gatewayListNames(test.list(m, "ctx", selection.namespaces))
				if !reflect.DeepEqual(got, selection.want) {
					t.Errorf("namespaces %q: got %v, want %v", selection.namespaces, got, selection.want)
				}
			}
		})
	}
}

func TestGatewayResourceManagersUnavailableOrDisconnected(t *testing.T) {
	for _, test := range gatewayResourceTestCases() {
		t.Run(test.kind, func(t *testing.T) {
			for _, m := range []*ClientManager{
				{}, {watchers: map[string]*contextWatcher{"ctx": {}}},
			} {
				rows := reflect.ValueOf(test.list(m, "ctx", "app"))
				if rows.IsNil() || rows.Len() != 0 {
					t.Fatalf("unavailable list = %v", rows)
				}
				if _, err := test.get(m, "ctx", "app", "resource"); err == nil {
					t.Fatal("unavailable detail succeeded")
				}
			}
		})
	}
}

func newGatewayResourceManager(t *testing.T, kind, resource, version string, objects ...runtime.Object) *ClientManager {
	t.Helper()
	factory := gwinformers.NewSharedInformerFactory(gwfake.NewSimpleClientset(), 0)
	informer, err := factory.ForResource(schema.GroupVersionResource{Group: gatewayv1.GroupName, Version: version, Resource: resource})
	if err != nil {
		t.Fatal(err)
	}
	for _, object := range objects {
		if err := informer.Informer().GetIndexer().Add(object); err != nil {
			t.Fatal(err)
		}
	}
	return &ClientManager{watchers: map[string]*contextWatcher{"ctx": {gwFactory: factory, gwVersions: map[string]string{kind: version}}}}
}

func gatewayListNames(list any) []string {
	rows := reflect.ValueOf(list)
	out := make([]string, 0, rows.Len())
	for i := 0; i < rows.Len(); i++ {
		row := rows.Index(i)
		out = append(out, row.FieldByName("Namespace").String()+"/"+row.FieldByName("Name").String())
	}
	return out
}
