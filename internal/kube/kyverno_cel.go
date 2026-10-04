package kube

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// Kyverno's CEL policy family (policies.kyverno.io, v1 since Kyverno 1.16)
// mirrors Kubernetes ValidatingAdmissionPolicy. Klustr covers the validating
// kinds: the cluster-scoped ValidatingPolicy and NamespacedValidatingPolicy,
// which applies only within its own namespace.
const (
	kyvernoCELGroup                             = "policies.kyverno.io"
	kyvernoValidatingPoliciesResource           = "validatingpolicies"
	kyvernoNamespacedValidatingPoliciesResource = "namespacedvalidatingpolicies"
)

// KyvernoValidatingPolicyInfo is the row shape for both ValidatingPolicy lists.
// Actions are the validationActions (Deny, Audit, Warn); Resources summarizes
// the matched resource rules.
type KyvernoValidatingPolicyInfo struct {
	Name        string   `json:"name"`
	Namespace   string   `json:"namespace"`
	Actions     []string `json:"actions"`
	Resources   []string `json:"resources"`
	Validations int      `json:"validations"`
	Admission   bool     `json:"admission"`
	Background  bool     `json:"background"`
	Ready       string   `json:"ready"`
	CreatedAt   string   `json:"createdAt"`
}

// KyvernoCELExpression is a named CEL expression: a match condition or a
// variable.
type KyvernoCELExpression struct {
	Name       string `json:"name"`
	Expression string `json:"expression"`
}

// KyvernoCELValidation is one validation: the expression that must hold and
// the message (static or computed) reported when it doesn't.
type KyvernoCELValidation struct {
	Expression        string `json:"expression"`
	Message           string `json:"message"`
	MessageExpression string `json:"messageExpression"`
	Reason            string `json:"reason"`
}

type KyvernoPolicyCondition struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason"`
	Message string `json:"message"`
}

type KyvernoValidatingPolicyDetail struct {
	KyvernoValidatingPolicyInfo
	ReportKey         string                   `json:"reportKey"`
	FailurePolicy     string                   `json:"failurePolicy"`
	Mode              string                   `json:"mode"`
	NamespaceSelector string                   `json:"namespaceSelector"`
	ObjectSelector    string                   `json:"objectSelector"`
	MatchConditions   []KyvernoCELExpression   `json:"matchConditions"`
	Variables         []KyvernoCELExpression   `json:"variables"`
	Validations       []KyvernoCELValidation   `json:"validationRules"`
	AuditAnnotations  []KyvernoCELExpression   `json:"auditAnnotations"`
	Conditions        []KyvernoPolicyCondition `json:"conditions"`
}

func (m *ClientManager) ListKyvernoValidatingPolicies(contextName string) []KyvernoValidatingPolicyInfo {
	return m.listKyvernoValidatingPolicies(contextName, kyvernoValidatingPoliciesResource, "")
}

func (m *ClientManager) ListKyvernoNamespacedValidatingPolicies(contextName, namespace string) []KyvernoValidatingPolicyInfo {
	return m.listKyvernoValidatingPolicies(contextName, kyvernoNamespacedValidatingPoliciesResource, namespace)
}

func (m *ClientManager) listKyvernoValidatingPolicies(contextName, resource, namespace string) []KyvernoValidatingPolicyInfo {
	gvr, ok := m.servedGVR(contextName, kyvernoCELGroup, resource)
	if !ok {
		return []KyvernoValidatingPolicyInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]KyvernoValidatingPolicyInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractKyvernoValidatingPolicy(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetKyvernoValidatingPolicy(ctx context.Context, contextName, name string) (*KyvernoValidatingPolicyDetail, error) {
	return m.getKyvernoValidatingPolicy(ctx, contextName, kyvernoValidatingPoliciesResource, "", name)
}

func (m *ClientManager) GetKyvernoNamespacedValidatingPolicy(ctx context.Context, contextName, namespace, name string) (*KyvernoValidatingPolicyDetail, error) {
	return m.getKyvernoValidatingPolicy(ctx, contextName, kyvernoNamespacedValidatingPoliciesResource, namespace, name)
}

func (m *ClientManager) getKyvernoValidatingPolicy(ctx context.Context, contextName, resource, namespace, name string) (*KyvernoValidatingPolicyDetail, error) {
	gvr, ok := m.servedGVR(contextName, kyvernoCELGroup, resource)
	if !ok {
		return nil, fmt.Errorf("%s.%s is not served by this cluster", resource, kyvernoCELGroup)
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoValidatingPolicyDetail(obj), nil
}

func extractKyvernoValidatingPolicy(obj *unstructured.Unstructured) KyvernoValidatingPolicyInfo {
	actions, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "validationActions")
	validations, _, _ := nestedSliceNoCopy(obj.Object, "spec", "validations")
	ready := ""
	if r, found, _ := unstructured.NestedBool(obj.Object, "status", "conditionStatus", "ready"); found {
		ready = "False"
		if r {
			ready = "True"
		}
	}
	return KyvernoValidatingPolicyInfo{
		Name:        obj.GetName(),
		Namespace:   obj.GetNamespace(),
		Actions:     append([]string{}, actions...),
		Resources:   summarizeResourceRules(nestedField(obj.Object, "spec", "matchConstraints", "resourceRules")),
		Validations: len(validations),
		Admission:   nestedBoolOrTrue(obj.Object, "spec", "evaluation", "admission", "enabled"),
		Background:  nestedBoolOrTrue(obj.Object, "spec", "evaluation", "background", "enabled"),
		Ready:       ready,
		CreatedAt:   crCreatedAt(obj),
	}
}

func extractKyvernoValidatingPolicyDetail(obj *unstructured.Unstructured) *KyvernoValidatingPolicyDetail {
	failurePolicy, _, _ := unstructured.NestedString(obj.Object, "spec", "failurePolicy")
	mode, _, _ := unstructured.NestedString(obj.Object, "spec", "evaluation", "mode")

	validations := []KyvernoCELValidation{}
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "validations")
	for _, item := range raw {
		v, ok := item.(map[string]any)
		if !ok {
			continue
		}
		expression, _ := v["expression"].(string)
		message, _ := v["message"].(string)
		messageExpression, _ := v["messageExpression"].(string)
		reason, _ := v["reason"].(string)
		validations = append(validations, KyvernoCELValidation{
			Expression:        expression,
			Message:           message,
			MessageExpression: messageExpression,
			Reason:            reason,
		})
	}

	conditions := []KyvernoPolicyCondition{}
	rawConds, _, _ := nestedSliceNoCopy(obj.Object, "status", "conditionStatus", "conditions")
	for _, item := range rawConds {
		c, ok := item.(map[string]any)
		if !ok {
			continue
		}
		typ, _ := c["type"].(string)
		status, _ := c["status"].(string)
		reason, _ := c["reason"].(string)
		message, _ := c["message"].(string)
		conditions = append(conditions, KyvernoPolicyCondition{Type: typ, Status: status, Reason: reason, Message: message})
	}

	reportKey := obj.GetName()
	if obj.GetNamespace() != "" {
		reportKey = obj.GetNamespace() + "/" + obj.GetName()
	}
	return &KyvernoValidatingPolicyDetail{
		KyvernoValidatingPolicyInfo: extractKyvernoValidatingPolicy(obj),
		ReportKey:                   reportKey,
		FailurePolicy:               failurePolicy,
		Mode:                        mode,
		NamespaceSelector:           summarizeLabelSelector(nestedField(obj.Object, "spec", "matchConstraints", "namespaceSelector")),
		ObjectSelector:              summarizeLabelSelector(nestedField(obj.Object, "spec", "matchConstraints", "objectSelector")),
		MatchConditions:             extractCELExpressions(obj, "name", "expression", "spec", "matchConditions"),
		Variables:                   extractCELExpressions(obj, "name", "expression", "spec", "variables"),
		Validations:                 validations,
		AuditAnnotations:            extractCELExpressions(obj, "key", "valueExpression", "spec", "auditAnnotations"),
		Conditions:                  conditions,
	}
}

// extractCELExpressions reads a list of named expressions (match conditions,
// variables, audit annotations) whose name and expression fields vary.
func extractCELExpressions(obj *unstructured.Unstructured, nameField, exprField string, fields ...string) []KyvernoCELExpression {
	raw, _, _ := nestedSliceNoCopy(obj.Object, fields...)
	out := make([]KyvernoCELExpression, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m[nameField].(string)
		expression, _ := m[exprField].(string)
		out = append(out, KyvernoCELExpression{Name: name, Expression: expression})
	}
	return out
}

// summarizeResourceRules renders admission resourceRules as
// "deployments.apps (CREATE, UPDATE)", one entry per rule.
func summarizeResourceRules(raw any) []string {
	rules, _ := raw.([]any)
	out := make([]string, 0, len(rules))
	for _, item := range rules {
		rule, ok := item.(map[string]any)
		if !ok {
			continue
		}
		groups := nestedStrings(rule, "apiGroups")
		resources := nestedStrings(rule, "resources")
		names := make([]string, 0, len(resources))
		for _, resource := range resources {
			name := resource
			// The core group is "" and needs no suffix; a "*" group reads as is.
			for _, group := range groups {
				if group != "" {
					name = resource + "." + group
					break
				}
			}
			names = append(names, name)
		}
		entry := strings.Join(names, ", ")
		if ops := nestedStrings(rule, "operations"); len(ops) > 0 {
			entry += " (" + strings.Join(ops, ", ") + ")"
		}
		out = append(out, entry)
	}
	return out
}
