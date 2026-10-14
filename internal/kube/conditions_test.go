package kube

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestCRConditions(t *testing.T) {
	if got := crConditions(&unstructured.Unstructured{Object: map[string]any{}}); got == nil || len(got) != 0 {
		t.Fatalf("missing status must read as an empty slice, got %#v", got)
	}
	obj := &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{
			"conditions": []any{
				map[string]any{"type": "Ready"},
				map[string]any{"status": "True"},
				map[string]any{"type": "Reconciling", "status": "True", "reason": "Pulling", "lastTransitionTime": "2026-10-01T09:00:00Z"},
			},
		},
	}}
	got := crConditions(obj)
	if len(got) != 1 || got[0].Type != "Reconciling" || got[0].LastTransitionTime != "2026-10-01T09:00:00Z" {
		t.Fatalf("entries without a type or status must be skipped, got %+v", got)
	}
}

func TestConditionsAtNestedPath(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{
			"conditionStatus": map[string]any{
				"conditions": []any{map[string]any{"type": "WebhookConfigured", "status": "True"}},
			},
		},
	}}
	if got := conditionsAt(obj, "status", "conditionStatus", "conditions"); len(got) != 1 || got[0].Type != "WebhookConfigured" {
		t.Fatalf("got %+v", got)
	}
}

func TestReadyCondition(t *testing.T) {
	for _, tc := range []struct {
		name          string
		conds         []ConditionDetail
		status, label string
	}{
		{"absent", []ConditionDetail{{Type: "Issuing", Status: "True"}}, "", ""},
		{"message", []ConditionDetail{{Type: "Ready", Status: "False", Reason: "Failed", Message: "chart not found"}}, "False", "chart not found"},
		{"reason when message is empty", []ConditionDetail{{Type: "Ready", Status: "True", Reason: "Succeeded"}}, "True", "Succeeded"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			status, label := readyCondition(tc.conds)
			if status != tc.status || label != tc.label {
				t.Fatalf("readyCondition = %q %q, want %q %q", status, label, tc.status, tc.label)
			}
		})
	}
	conds := []ConditionDetail{{Type: "Approved", Status: "True"}}
	if conditionStatusByType(conds, "Approved") != "True" || conditionStatusByType(conds, "Denied") != "" {
		t.Fatal("conditionStatusByType mismatch")
	}
}
