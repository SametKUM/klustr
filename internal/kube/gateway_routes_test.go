package kube

import (
	"reflect"
	"strings"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
)

func TestL4RouteDetailsPreserveReferencesAndDefaults(t *testing.T) {
	parents := []gatewayv1.ParentReference{
		{Name: "local-gateway"},
		{Name: "shared-listeners", Kind: ptr.To(gatewayv1.Kind("ListenerSet")), Namespace: ptr.To(gatewayv1.Namespace("edge")), SectionName: ptr.To(gatewayv1.SectionName("tls")), Port: ptr.To(gatewayv1.PortNumber(443))},
		{Name: "mesh-service", Group: ptr.To(gatewayv1.Group("")), Kind: ptr.To(gatewayv1.Kind("Service"))},
	}
	backends := []gatewayv1.BackendRef{
		{BackendObjectReference: gatewayv1.BackendObjectReference{Name: "service", Port: ptr.To(gatewayv1.PortNumber(8443))}},
		{BackendObjectReference: gatewayv1.BackendObjectReference{Name: "disabled"}, Weight: ptr.To(int32(0))},
		{BackendObjectReference: gatewayv1.BackendObjectReference{Name: "custom", Namespace: ptr.To(gatewayv1.Namespace("other")), Group: ptr.To(gatewayv1.Group("example.net")), Kind: ptr.To(gatewayv1.Kind("Backend"))}, Weight: ptr.To(int32(20))},
	}
	status := gatewayv1.RouteStatus{Parents: []gatewayv1.RouteParentStatus{
		{ParentRef: parents[0], ControllerName: "example.net/controller", Conditions: []metav1.Condition{
			{Type: "Accepted", Status: metav1.ConditionTrue, ObservedGeneration: 2},
			{Type: "ResolvedRefs", Status: metav1.ConditionFalse, ObservedGeneration: 2, Reason: "RefNotPermitted", Message: "cross-namespace backend requires a grant"},
		}},
	}}
	metadata := metav1.ObjectMeta{Name: "route", Namespace: "app", UID: "route-uid", Generation: 2, CreationTimestamp: metav1.NewTime(time.Date(2026, 9, 20, 1, 2, 3, 0, time.UTC))}
	tls := &gatewayv1.TLSRoute{ObjectMeta: metadata, Spec: gatewayv1.TLSRouteSpec{
		CommonRouteSpec: gatewayv1.CommonRouteSpec{ParentRefs: parents}, Hostnames: []gatewayv1.Hostname{"*.example.net", "secure.example.org"},
		Rules: []gatewayv1.TLSRouteRule{{Name: ptr.To(gatewayv1.SectionName("primary")), BackendRefs: backends}},
	}, Status: gatewayv1.TLSRouteStatus{RouteStatus: status}}
	tcp := &gatewayv1.TCPRoute{ObjectMeta: metadata, Spec: gatewayv1.TCPRouteSpec{CommonRouteSpec: tls.Spec.CommonRouteSpec, Rules: []gatewayv1.TCPRouteRule{{Name: tls.Spec.Rules[0].Name, BackendRefs: backends}}}, Status: gatewayv1.TCPRouteStatus{RouteStatus: status}}
	udp := &gatewayv1.UDPRoute{ObjectMeta: metadata, Spec: gatewayv1.UDPRouteSpec{CommonRouteSpec: tls.Spec.CommonRouteSpec, Rules: []gatewayv1.UDPRouteRule{{Name: tls.Spec.Rules[0].Name, BackendRefs: backends}}}, Status: gatewayv1.UDPRouteStatus{RouteStatus: status}}
	tlsDetail, tcpDetail, udpDetail := tlsRouteDetail(tls), tcpRouteDetail(tcp), udpRouteDetail(udp)
	for _, test := range []struct {
		name    string
		parents []ParentRefDetail
		rules   []L4RouteRuleDetail
		status  []RouteParentStatusDetail
	}{
		{"TLSRoute", tlsDetail.Parents, tlsDetail.Rules, tlsDetail.Status},
		{"TCPRoute", tcpDetail.Parents, tcpDetail.Rules, tcpDetail.Status},
		{"UDPRoute", udpDetail.Parents, udpDetail.Rules, udpDetail.Status},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := test.parents[0]; got.Group != gatewayv1.GroupName || got.Kind != "Gateway" || got.Namespace != "app" {
				t.Fatalf("parent defaults = %+v", got)
			}
			if got := test.parents[1]; got.Kind != "ListenerSet" || got.Namespace != "edge" || got.SectionName != "tls" || got.Port != 443 {
				t.Fatalf("listener parent = %+v", got)
			}
			if got := test.parents[2]; got.Group != "" || got.Kind != "Service" {
				t.Fatalf("explicit core parent = %+v", got)
			}
			rule := test.rules[0]
			if rule.Name != "primary" || len(rule.Backends) != 3 {
				t.Fatalf("rule = %+v", rule)
			}
			if got := rule.Backends[0]; got.Kind != "Service" || got.Group != "" || got.Namespace != "app" || got.Weight != 1 || got.Port != 8443 {
				t.Fatalf("backend defaults = %+v", got)
			}
			if got := rule.Backends[1]; got.Weight != 0 || got.Port != 0 {
				t.Fatalf("explicit zero weight or omitted port lost: %+v", got)
			}
			if got := rule.Backends[2]; got.Kind != "Backend" || got.Group != "example.net" || got.Namespace != "other" || got.Weight != 20 {
				t.Fatalf("custom backend = %+v", got)
			}
			if got := test.status[0]; got.Parent.Kind != "Gateway" || got.Controller != "example.net/controller" || got.Conditions[1].Reason != "RefNotPermitted" || got.Conditions[1].Status != "False" {
				t.Fatalf("status = %+v", got)
			}
		})
	}
	if !reflect.DeepEqual(tlsDetail.Hostnames, []string{"*.example.net", "secure.example.org"}) || tlsDetail.UID != "route-uid" || tlsDetail.CreatedAt != "2026-09-20T01:02:03Z" {
		t.Fatalf("TLS metadata/hostnames = %+v", tlsDetail)
	}
	if info := tlsRouteInfo(tls); info.Hostnames != "*.example.net, secure.example.org" || info.Parents != "local-gateway, edge/shared-listeners, mesh-service" || info.Rules != 1 || info.Accepted != "True" || info.ResolvedRefs != "False" {
		t.Fatalf("TLS info = %+v", info)
	}
	if info := tcpRouteInfo(tcp); info.Rules != 1 || info.Accepted != "True" || info.ResolvedRefs != "False" {
		t.Fatalf("TCP info = %+v", info)
	}
	if info := udpRouteInfo(udp); info.Rules != 1 || info.Accepted != "True" || info.ResolvedRefs != "False" {
		t.Fatalf("UDP info = %+v", info)
	}
}

func TestNewGatewayDetailsNeverReturnNilSlices(t *testing.T) {
	for _, test := range []struct {
		name   string
		detail any
	}{
		{"TLSRoute", tlsRouteDetail(&gatewayv1.TLSRoute{Spec: gatewayv1.TLSRouteSpec{Rules: []gatewayv1.TLSRouteRule{{}}}})},
		{"TCPRoute", tcpRouteDetail(&gatewayv1.TCPRoute{Spec: gatewayv1.TCPRouteSpec{Rules: []gatewayv1.TCPRouteRule{{}}}})},
		{"UDPRoute", udpRouteDetail(&gatewayv1.UDPRoute{Spec: gatewayv1.UDPRouteSpec{Rules: []gatewayv1.UDPRouteRule{{}}}})},
		{"ListenerSet", listenerSetDetail(&gatewayv1.ListenerSet{Spec: gatewayv1.ListenerSetSpec{Listeners: []gatewayv1.ListenerEntry{{}}}})},
		{"BackendTLSPolicy", backendTLSPolicyDetail(&gatewayv1.BackendTLSPolicy{})},
	} {
		t.Run(test.name, func(t *testing.T) { requireGatewaySlices(t, reflect.ValueOf(test.detail), test.name) })
	}
}

func requireGatewaySlices(t *testing.T, value reflect.Value, path string) {
	t.Helper()
	switch value.Kind() {
	case reflect.Pointer:
		requireGatewaySlices(t, value.Elem(), path)
	case reflect.Struct:
		for i := 0; i < value.NumField(); i++ {
			requireGatewaySlices(t, value.Field(i), path+"."+value.Type().Field(i).Name)
		}
	case reflect.Slice:
		if value.IsNil() {
			t.Errorf("%s is nil and would serialize as null", path)
		}
		for i := 0; i < value.Len(); i++ {
			requireGatewaySlices(t, value.Index(i), path+"[]")
		}
	}
}

func TestGatewayConditionsDistinguishStaleAndMissingStatus(t *testing.T) {
	for _, test := range []struct {
		name    string
		parents []gatewayv1.RouteParentStatus
		want    string
	}{
		{"missing", nil, ""},
		{"missing condition", []gatewayv1.RouteParentStatus{{}}, ""},
		{"stale acceptance", []gatewayv1.RouteParentStatus{{Conditions: []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionTrue, ObservedGeneration: 1}}}}, "Unknown"},
		{"omitted generation", []gatewayv1.RouteParentStatus{{Conditions: []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionTrue}}}}, "Unknown"},
		{"current acceptance and rejection", []gatewayv1.RouteParentStatus{
			{Conditions: []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionFalse, ObservedGeneration: 2}}},
			{Conditions: []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionTrue, ObservedGeneration: 2}}},
		}, "True"},
		{"stale acceptance and current rejection", []gatewayv1.RouteParentStatus{
			{Conditions: []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionTrue, ObservedGeneration: 1}}},
			{Conditions: []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionFalse, ObservedGeneration: 2}}},
		}, "False"},
	} {
		t.Run(test.name, func(t *testing.T) {
			route := &gatewayv1.TLSRoute{ObjectMeta: metav1.ObjectMeta{Generation: 2}, Status: gatewayv1.TLSRouteStatus{RouteStatus: gatewayv1.RouteStatus{Parents: test.parents}}}
			if got := tlsRouteInfo(route).Accepted; got != test.want {
				t.Fatalf("Accepted = %q, want %q", got, test.want)
			}
		})
	}
	conditions := []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionTrue, Reason: "Accepted", Message: "previous config accepted", ObservedGeneration: 1}}
	got := conditionsToDetail(conditions, 2)[0]
	if got.Status != "Unknown" || got.Reason != "Accepted" || !strings.Contains(got.Message, "observed generation 1, current generation 2") || !strings.Contains(got.Message, "previous config accepted") {
		t.Fatalf("stale detail = %+v", got)
	}
	if conditions[0].Status != metav1.ConditionTrue || conditions[0].Message != "previous config accepted" {
		t.Fatal("building detail mutated the informer object")
	}
}
