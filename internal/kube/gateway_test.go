package kube

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
)

func TestConditionStatus(t *testing.T) {
	conds := []metav1.Condition{
		{Type: "Accepted", Status: metav1.ConditionTrue},
		{Type: "Programmed", Status: metav1.ConditionFalse},
	}
	if got := conditionStatus(conds, "Accepted"); got != "True" {
		t.Errorf("Accepted: got %q, want True", got)
	}
	if got := conditionStatus(conds, "Programmed"); got != "False" {
		t.Errorf("Programmed: got %q, want False", got)
	}
	if got := conditionStatus(conds, "Missing"); got != "" {
		t.Errorf("Missing: got %q, want empty", got)
	}
	if got := conditionStatus(nil, "Accepted"); got != "" {
		t.Errorf("nil: got %q, want empty", got)
	}
}

func TestAnyParentConditionStatus(t *testing.T) {
	mk := func(s metav1.ConditionStatus) gatewayv1.RouteParentStatus {
		return gatewayv1.RouteParentStatus{
			Conditions: []metav1.Condition{{Type: "Accepted", Status: s}},
		}
	}

	cases := []struct {
		name    string
		parents []gatewayv1.RouteParentStatus
		want    string
	}{
		{"empty", nil, ""},
		{"trueWins", []gatewayv1.RouteParentStatus{mk(metav1.ConditionFalse), mk(metav1.ConditionTrue)}, "True"},
		{"allFalse", []gatewayv1.RouteParentStatus{mk(metav1.ConditionFalse), mk(metav1.ConditionFalse)}, "False"},
		{"falseBeatsUnknown", []gatewayv1.RouteParentStatus{mk(metav1.ConditionUnknown), mk(metav1.ConditionFalse)}, "False"},
		{"unknownOnly", []gatewayv1.RouteParentStatus{mk(metav1.ConditionUnknown)}, "Unknown"},
		{"noTargetCondition", []gatewayv1.RouteParentStatus{{Conditions: []metav1.Condition{{Type: "Other", Status: metav1.ConditionTrue}}}}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := anyParentConditionStatus(tc.parents, "Accepted"); got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestConditionsToDetail(t *testing.T) {
	got := conditionsToDetail(nil)
	if got == nil {
		t.Fatal("should return empty slice, not nil")
	}
	if len(got) != 0 {
		t.Errorf("empty: got %d items, want 0", len(got))
	}

	in := []metav1.Condition{
		{Type: "Accepted", Status: metav1.ConditionTrue, Reason: "Ok", Message: "all good"},
	}
	out := conditionsToDetail(in)
	if len(out) != 1 || out[0].Type != "Accepted" || out[0].Status != "True" ||
		out[0].Reason != "Ok" || out[0].Message != "all good" {
		t.Errorf("got %+v", out)
	}
}

func TestParentRefDetail(t *testing.T) {
	t.Run("defaults", func(t *testing.T) {
		got := parentRefDetail(gatewayv1.ParentReference{Name: "gw1"}, "ns-default")
		if got.Name != "gw1" {
			t.Errorf("name: got %q", got.Name)
		}
		if got.Namespace != "ns-default" {
			t.Errorf("ns fallback: got %q, want ns-default", got.Namespace)
		}
	})

	t.Run("with pointer fields", func(t *testing.T) {
		grp := gatewayv1.Group("gateway.networking.k8s.io")
		kind := gatewayv1.Kind("Gateway")
		ns := gatewayv1.Namespace("explicit-ns")
		section := gatewayv1.SectionName("https")
		port := gatewayv1.PortNumber(443)
		got := parentRefDetail(gatewayv1.ParentReference{
			Name:        "gw1",
			Group:       &grp,
			Kind:        &kind,
			Namespace:   &ns,
			SectionName: &section,
			Port:        &port,
		}, "ns-default")
		if got.Group != "gateway.networking.k8s.io" || got.Kind != "Gateway" ||
			got.Namespace != "explicit-ns" || got.SectionName != "https" || got.Port != 443 {
			t.Errorf("got %+v", got)
		}
	})
}

func TestFormatParentRefShort(t *testing.T) {
	if got := formatParentRefShort(gatewayv1.ParentReference{Name: "gw1"}, "ns"); got != "gw1" {
		t.Errorf("same ns: got %q", got)
	}
	other := gatewayv1.Namespace("other")
	got := formatParentRefShort(gatewayv1.ParentReference{Name: "gw1", Namespace: &other}, "ns")
	if got != "other/gw1" {
		t.Errorf("cross ns: got %q", got)
	}
}

func TestBackendRefDetail(t *testing.T) {
	t.Run("defaults", func(t *testing.T) {
		got := backendRefDetail(gatewayv1.BackendRef{
			BackendObjectReference: gatewayv1.BackendObjectReference{Name: "svc"},
		}, "ns-default", nil)
		if got.Name != "svc" || got.Namespace != "ns-default" || got.Kind != "Service" {
			t.Errorf("got %+v", got)
		}
	})

	t.Run("weight from outer wrapper", func(t *testing.T) {
		w := int32(7)
		got := backendRefDetail(gatewayv1.BackendRef{
			BackendObjectReference: gatewayv1.BackendObjectReference{Name: "svc"},
		}, "ns", &w)
		if got.Weight != 7 {
			t.Errorf("got weight %d, want 7", got.Weight)
		}
	})

	t.Run("weight from inner ref when wrapper nil", func(t *testing.T) {
		inner := int32(3)
		got := backendRefDetail(gatewayv1.BackendRef{
			BackendObjectReference: gatewayv1.BackendObjectReference{Name: "svc"},
			Weight:                 &inner,
		}, "ns", nil)
		if got.Weight != 3 {
			t.Errorf("got weight %d, want 3", got.Weight)
		}
	})
}

