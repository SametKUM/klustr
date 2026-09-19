package kube

import (
	"reflect"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
)

func TestListenerSetDetailJoinsStatusByName(t *testing.T) {
	set := &gatewayv1.ListenerSet{
		ObjectMeta: metav1.ObjectMeta{Name: "team-listeners", Namespace: "app", Generation: 4},
		Spec: gatewayv1.ListenerSetSpec{
			ParentRef: gatewayv1.ParentGatewayReference{Name: "edge", Namespace: ptr.To(gatewayv1.Namespace("shared"))},
			Listeners: []gatewayv1.ListenerEntry{
				{Name: "web", Protocol: "HTTPS", Port: 443, Hostname: ptr.To(gatewayv1.Hostname("app.example.net")),
					TLS: &gatewayv1.ListenerTLSConfig{CertificateRefs: []gatewayv1.SecretObjectReference{
						{Name: "local-cert"}, {Name: "shared-cert", Namespace: ptr.To(gatewayv1.Namespace("certificates"))},
					}},
					AllowedRoutes: &gatewayv1.AllowedRoutes{
						Kinds:      []gatewayv1.RouteGroupKind{{Kind: "HTTPRoute"}},
						Namespaces: &gatewayv1.RouteNamespaces{From: ptr.To(gatewayv1.NamespacesFromSelector), Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"team": "web"}}},
					}},
				{Name: "tls", Protocol: "TLS", Port: 8443, TLS: &gatewayv1.ListenerTLSConfig{Mode: ptr.To(gatewayv1.TLSModePassthrough)}},
				{Name: "pending", Protocol: "TCP", Port: 9000},
			},
		},
		Status: gatewayv1.ListenerSetStatus{
			Conditions: []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionTrue, ObservedGeneration: 4}, {Type: "Programmed", Status: metav1.ConditionTrue, ObservedGeneration: 3}},
			Listeners: []gatewayv1.ListenerEntryStatus{
				{Name: "tls", AttachedRoutes: 2, SupportedKinds: []gatewayv1.RouteGroupKind{{Kind: "TLSRoute"}}, Conditions: []metav1.Condition{{Type: "Accepted", Status: metav1.ConditionTrue, ObservedGeneration: 3}}},
				{Name: "web", AttachedRoutes: 5, SupportedKinds: []gatewayv1.RouteGroupKind{{Kind: "HTTPRoute"}}, Conditions: []metav1.Condition{{Type: "ResolvedRefs", Status: metav1.ConditionFalse, Reason: "RefNotPermitted", ObservedGeneration: 4}}},
			},
		},
	}
	detail := listenerSetDetail(set)
	if detail.Parent.Group != gatewayv1.GroupName || detail.Parent.Kind != "Gateway" || detail.Parent.Name != "edge" || detail.Parent.Namespace != "shared" {
		t.Fatalf("parent = %+v", detail.Parent)
	}
	web, tls, pending := detail.Listeners[0], detail.Listeners[1], detail.Listeners[2]
	if web.AttachedRoutes != 5 || web.Conditions[0].Reason != "RefNotPermitted" || web.Conditions[0].Status != "False" {
		t.Fatalf("web status = %+v", web)
	}
	if web.TLSMode != "Terminate" || web.AllowedNamespaces != "Selector" || web.NamespaceSelector != "team=web" || web.Hostname != "app.example.net" {
		t.Fatalf("web spec = %+v", web)
	}
	if !reflect.DeepEqual(web.AllowedKinds, []string{gatewayv1.GroupName + "/HTTPRoute"}) || !reflect.DeepEqual(web.SupportedKinds, web.AllowedKinds) {
		t.Fatalf("route kinds = %+v", web)
	}
	if web.CertificateRefs[0].Kind != "Secret" || web.CertificateRefs[0].Group != "" || web.CertificateRefs[0].Namespace != "app" || web.CertificateRefs[1].Namespace != "certificates" {
		t.Fatalf("certificates = %+v", web.CertificateRefs)
	}
	if tls.AttachedRoutes != 2 || tls.TLSMode != "Passthrough" || tls.Conditions[0].Status != "Unknown" {
		t.Fatalf("TLS status = %+v", tls)
	}
	if pending.AllowedNamespaces != "Same" || pending.Conditions == nil || len(pending.Conditions) != 0 || pending.SupportedKinds == nil {
		t.Fatalf("pending listener = %+v", pending)
	}
	if info := listenerSetInfo(set); info.Parent != "shared/edge" || info.AttachedRoutes != 7 || info.Accepted != "True" || info.Programmed != "Unknown" || info.Listeners != "web:443/HTTPS, tls:8443/TLS, pending:9000/TCP" {
		t.Fatalf("listener set info = %+v", info)
	}
	if detail.Conditions[1].Status != "Unknown" {
		t.Fatalf("stale overall condition = %+v", detail.Conditions)
	}
	if set.Status.Listeners[0].Conditions[0].Status != metav1.ConditionTrue {
		t.Fatal("builder changed informer status")
	}
}

func TestBackendTLSPolicyDetailPreservesValidationAndAncestors(t *testing.T) {
	policy := &gatewayv1.BackendTLSPolicy{
		ObjectMeta: metav1.ObjectMeta{Name: "backend-tls", Namespace: "app", Generation: 3},
		Spec: gatewayv1.BackendTLSPolicySpec{
			TargetRefs: []gatewayv1.LocalPolicyTargetReferenceWithSectionName{{
				LocalPolicyTargetReference: gatewayv1.LocalPolicyTargetReference{Kind: "Service", Name: "backend"},
				SectionName:                ptr.To(gatewayv1.SectionName("https")),
			}},
			Validation: gatewayv1.BackendTLSPolicyValidation{
				Hostname:          "backend.example.net",
				CACertificateRefs: []gatewayv1.LocalObjectReference{{Kind: "ConfigMap", Name: "backend-ca"}},
				SubjectAltNames: []gatewayv1.SubjectAltName{
					{Type: gatewayv1.HostnameSubjectAltNameType, Hostname: "certificate.example.net"},
					{Type: gatewayv1.URISubjectAltNameType, URI: "spiffe://cluster.example/ns/app/sa/backend"},
				},
			},
			Options: map[gatewayv1.AnnotationKey]gatewayv1.AnnotationValue{"example.net/min-tls-version": "1.3"},
		},
		Status: gatewayv1.PolicyStatus{Ancestors: []gatewayv1.PolicyAncestorStatus{
			{AncestorRef: gatewayv1.ParentReference{Name: "shared", Namespace: ptr.To(gatewayv1.Namespace("edge"))}, ControllerName: "example.net/controller-a", Conditions: []metav1.Condition{
				{Type: "Accepted", Status: metav1.ConditionTrue, ObservedGeneration: 2},
			}},
			{AncestorRef: gatewayv1.ParentReference{Name: "local", Kind: ptr.To(gatewayv1.Kind("ListenerSet"))}, ControllerName: "example.net/controller-b", Conditions: []metav1.Condition{
				{Type: "Accepted", Status: metav1.ConditionFalse, Reason: "Conflicted", ObservedGeneration: 3},
				{Type: "ResolvedRefs", Status: metav1.ConditionFalse, Reason: "InvalidCACertificateRef", Message: "CA reference does not exist", ObservedGeneration: 3},
			}},
		}},
	}
	detail := backendTLSPolicyDetail(policy)
	if got := detail.TargetRefs[0]; got.Group != "" || got.Kind != "Service" || got.Namespace != "app" || got.Name != "backend" || got.SectionName != "https" {
		t.Fatalf("target = %+v", got)
	}
	if got := detail.CACertificateRefs[0]; got.Kind != "ConfigMap" || got.Namespace != "app" || got.Name != "backend-ca" {
		t.Fatalf("CA reference = %+v", got)
	}
	if detail.Hostname != "backend.example.net" || detail.WellKnownCACertificates != "" || detail.SubjectAltNames[0].Value != "certificate.example.net" || detail.SubjectAltNames[1].Value != "spiffe://cluster.example/ns/app/sa/backend" || detail.Options["example.net/min-tls-version"] != "1.3" {
		t.Fatalf("validation = %+v", detail)
	}
	if got := detail.Ancestors[0]; got.Ancestor.Kind != "Gateway" || got.Ancestor.Namespace != "edge" || got.Controller != "example.net/controller-a" || got.Conditions[0].Status != "Unknown" {
		t.Fatalf("first ancestor = %+v", got)
	}
	if got := detail.Ancestors[1]; got.Ancestor.Kind != "ListenerSet" || got.Conditions[1].Reason != "InvalidCACertificateRef" || got.Conditions[1].Message != "CA reference does not exist" {
		t.Fatalf("second ancestor = %+v", got)
	}
	if info := backendTLSPolicyInfo(policy); info.Targets != "Service/backend/https" || info.Accepted != "False" || info.ResolvedRefs != "False" || info.Hostname != detail.Hostname {
		t.Fatalf("policy info = %+v", info)
	}
	policy.Spec.Validation.CACertificateRefs = nil
	policy.Spec.Validation.SubjectAltNames = nil
	policy.Spec.Validation.WellKnownCACertificates = ptr.To(gatewayv1.WellKnownCACertificatesSystem)
	detail = backendTLSPolicyDetail(policy)
	if detail.WellKnownCACertificates != "System" || detail.CACertificateRefs == nil || len(detail.CACertificateRefs) != 0 || detail.SubjectAltNames == nil {
		t.Fatalf("system CA detail = %+v", detail)
	}
}
