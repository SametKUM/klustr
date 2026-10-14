package kube

import "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

// ConditionDetail is one status condition in the metav1.Condition shape, the
// form every detail body renders. Built-in kinds map their typed conditions
// into it; CRs are read with crConditions.
type ConditionDetail struct {
	Type               string `json:"type"`
	Status             string `json:"status"`
	Reason             string `json:"reason"`
	Message            string `json:"message"`
	LastTransitionTime string `json:"lastTransitionTime"`
}

// crConditions reads .status.conditions[], where every integration CR keeps
// its metav1.Condition list.
func crConditions(obj *unstructured.Unstructured) []ConditionDetail {
	return conditionsAt(obj, "status", "conditions")
}

// conditionsAt reads a metav1.Condition list at path. Entries without a type
// or status are skipped, and the result is never nil, so a resource the
// controller has not reconciled yet encodes as [] rather than null.
func conditionsAt(obj *unstructured.Unstructured, path ...string) []ConditionDetail {
	raw, found, _ := nestedSliceNoCopy(obj.Object, path...)
	if !found {
		return []ConditionDetail{}
	}
	out := make([]ConditionDetail, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		c := ConditionDetail{}
		c.Type, _ = m["type"].(string)
		c.Status, _ = m["status"].(string)
		if c.Type == "" || c.Status == "" {
			continue
		}
		c.Reason, _ = m["reason"].(string)
		c.Message, _ = m["message"].(string)
		c.LastTransitionTime, _ = m["lastTransitionTime"].(string)
		out = append(out, c)
	}
	return out
}

// findCondition returns the condition of type t.
func findCondition(conds []ConditionDetail, t string) (ConditionDetail, bool) {
	for _, c := range conds {
		if c.Type == t {
			return c, true
		}
	}
	return ConditionDetail{}, false
}

// conditionStatusByType returns the status ("True", "False", "Unknown") of
// the condition of type t, or "" when it is absent.
func conditionStatusByType(conds []ConditionDetail, t string) string {
	c, _ := findCondition(conds, t)
	return c.Status
}

// readyCondition returns the status of the Ready condition, the headline
// health signal of Flux, cert-manager, Karpenter and Kyverno resources, with
// its message, or its reason when the controller left the message empty.
// Both are "" before the first reconcile.
func readyCondition(conds []ConditionDetail) (status, message string) {
	c, ok := findCondition(conds, "Ready")
	if !ok {
		return "", ""
	}
	if c.Message == "" {
		return c.Status, c.Reason
	}
	return c.Status, c.Message
}
