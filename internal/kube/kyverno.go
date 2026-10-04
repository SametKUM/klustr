package kube

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// Kyverno's classic policy kinds live under kyverno.io (ClusterPolicy and
// Policy at v1, PolicyException at v2 since Kyverno 1.11); versions are
// resolved from the discovered CRDs like Tekton's. The CEL policy family is in
// kyverno_cel.go and the wgpolicyk8s.io reports in policyreport.go.
const (
	kyvernoGroup                    = "kyverno.io"
	kyvernoClusterPoliciesResource  = "clusterpolicies"
	kyvernoPoliciesResource         = "policies"
	kyvernoPolicyExceptionsResource = "policyexceptions"
)

// Annotations the Kyverno policy library puts on every policy; the UI shows
// them as the policy's title, category and severity.
const (
	kyvernoTitleAnnotation       = "policies.kyverno.io/title"
	kyvernoCategoryAnnotation    = "policies.kyverno.io/category"
	kyvernoSeverityAnnotation    = "policies.kyverno.io/severity"
	kyvernoDescriptionAnnotation = "policies.kyverno.io/description"
)

// ---------------------------------------------------------------------------
// ClusterPolicy / Policy
// ---------------------------------------------------------------------------

// KyvernoPolicyInfo is the row shape shared by the ClusterPolicies and Policies
// lists. Action collapses the per-rule validate failure actions ("Audit",
// "Enforce", or "Mixed"); it is empty for a policy without validate rules.
type KyvernoPolicyInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Title        string `json:"title"`
	Category     string `json:"category"`
	Severity     string `json:"severity"`
	Action       string `json:"action"`
	Background   bool   `json:"background"`
	Admission    bool   `json:"admission"`
	Ready        string `json:"ready"`
	Message      string `json:"message"`
	Validate     int    `json:"validate"`
	Mutate       int    `json:"mutate"`
	Generate     int    `json:"generate"`
	VerifyImages int    `json:"verifyImages"`
	CreatedAt    string `json:"createdAt"`
}

// KyvernoRule is one rule of a policy. Type is the rule's action (validate,
// mutate, generate, verifyImages); Subtype says how a validate rule checks
// (pattern, anyPattern, deny, cel, podSecurity, foreach, assert). Match and
// Exclude hold one summarized clause per resource filter.
type KyvernoRule struct {
	Name          string   `json:"name"`
	Type          string   `json:"type"`
	Subtype       string   `json:"subtype"`
	FailureAction string   `json:"failureAction"`
	Message       string   `json:"message"`
	MatchMode     string   `json:"matchMode"`
	Match         []string `json:"match"`
	ExcludeMode   string   `json:"excludeMode"`
	Exclude       []string `json:"exclude"`
	Preconditions bool     `json:"preconditions"`
}

// KyvernoAutogenRule is a rule Kyverno derived from a Pod rule for the Pod
// controllers (Deployment, Job, ...). Reports and exceptions refer to it by
// its "autogen-" name.
type KyvernoAutogenRule struct {
	Name  string   `json:"name"`
	Kinds []string `json:"kinds"`
}

type KyvernoPolicyDetail struct {
	KyvernoPolicyInfo
	Description  string               `json:"description"`
	ReportKey    string               `json:"reportKey"`
	Rules        []KyvernoRule        `json:"rules"`
	AutogenRules []KyvernoAutogenRule `json:"autogenRules"`
	VAPGenerated bool                 `json:"vapGenerated"`
	VAPMessage   string               `json:"vapMessage"`
}

func (m *ClientManager) ListKyvernoClusterPolicies(contextName string) []KyvernoPolicyInfo {
	return m.listKyvernoPolicies(contextName, kyvernoClusterPoliciesResource, "")
}

func (m *ClientManager) ListKyvernoPolicies(contextName, namespace string) []KyvernoPolicyInfo {
	return m.listKyvernoPolicies(contextName, kyvernoPoliciesResource, namespace)
}

func (m *ClientManager) listKyvernoPolicies(contextName, resource, namespace string) []KyvernoPolicyInfo {
	gvr, ok := m.servedGVR(contextName, kyvernoGroup, resource)
	if !ok {
		return []KyvernoPolicyInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]KyvernoPolicyInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractKyvernoPolicy(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetKyvernoClusterPolicy(ctx context.Context, contextName, name string) (*KyvernoPolicyDetail, error) {
	return m.getKyvernoPolicy(ctx, contextName, kyvernoClusterPoliciesResource, "", name)
}

func (m *ClientManager) GetKyvernoPolicy(ctx context.Context, contextName, namespace, name string) (*KyvernoPolicyDetail, error) {
	return m.getKyvernoPolicy(ctx, contextName, kyvernoPoliciesResource, namespace, name)
}

func (m *ClientManager) getKyvernoPolicy(ctx context.Context, contextName, resource, namespace, name string) (*KyvernoPolicyDetail, error) {
	gvr, ok := m.servedGVR(contextName, kyvernoGroup, resource)
	if !ok {
		return nil, fmt.Errorf("%s.%s is not served by this cluster", resource, kyvernoGroup)
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoPolicyDetail(obj), nil
}

func extractKyvernoPolicy(obj *unstructured.Unstructured) KyvernoPolicyInfo {
	annotations := obj.GetAnnotations()
	info := KyvernoPolicyInfo{
		Name:       obj.GetName(),
		Namespace:  obj.GetNamespace(),
		Title:      annotations[kyvernoTitleAnnotation],
		Category:   annotations[kyvernoCategoryAnnotation],
		Severity:   annotations[kyvernoSeverityAnnotation],
		Background: nestedBoolOrTrue(obj.Object, "spec", "background"),
		Admission:  nestedBoolOrTrue(obj.Object, "spec", "admission"),
		CreatedAt:  crCreatedAt(obj),
	}
	info.Ready, info.Message = kyvernoReady(obj)

	actions := map[string]bool{}
	policyAction, _, _ := unstructured.NestedString(obj.Object, "spec", "validationFailureAction")
	rules, _, _ := nestedSliceNoCopy(obj.Object, "spec", "rules")
	for _, item := range rules {
		rule, ok := item.(map[string]any)
		if !ok {
			continue
		}
		switch kyvernoRuleType(rule) {
		case "validate":
			info.Validate++
			actions[kyvernoFailureAction(rule, policyAction)] = true
		case "mutate":
			info.Mutate++
		case "generate":
			info.Generate++
		case "verifyImages":
			info.VerifyImages++
		}
	}
	switch len(actions) {
	case 0:
	case 1:
		for action := range actions {
			info.Action = action
		}
	default:
		info.Action = "Mixed"
	}
	return info
}

func extractKyvernoPolicyDetail(obj *unstructured.Unstructured) *KyvernoPolicyDetail {
	policyAction, _, _ := unstructured.NestedString(obj.Object, "spec", "validationFailureAction")
	rawRules, _, _ := nestedSliceNoCopy(obj.Object, "spec", "rules")
	rules := make([]KyvernoRule, 0, len(rawRules))
	for _, item := range rawRules {
		if rule, ok := item.(map[string]any); ok {
			rules = append(rules, extractKyvernoRule(rule, policyAction))
		}
	}

	autogen := []KyvernoAutogenRule{}
	rawAutogen, _, _ := nestedSliceNoCopy(obj.Object, "status", "autogen", "rules")
	for _, item := range rawAutogen {
		rule, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := rule["name"].(string)
		kinds := map[string]bool{}
		for _, clause := range kyvernoResourceFilters(rule["match"]) {
			for _, kind := range nestedStrings(clause, "kinds") {
				kinds[kind] = true
			}
		}
		autogen = append(autogen, KyvernoAutogenRule{Name: name, Kinds: sortedKeys(kinds)})
	}

	vapGenerated, _, _ := unstructured.NestedBool(obj.Object, "status", "validatingadmissionpolicy", "generated")
	vapMessage, _, _ := unstructured.NestedString(obj.Object, "status", "validatingadmissionpolicy", "message")
	reportKey := obj.GetName()
	if obj.GetNamespace() != "" {
		// Reports name a namespaced Policy as "<namespace>/<name>".
		reportKey = obj.GetNamespace() + "/" + obj.GetName()
	}
	return &KyvernoPolicyDetail{
		KyvernoPolicyInfo: extractKyvernoPolicy(obj),
		Description:       obj.GetAnnotations()[kyvernoDescriptionAnnotation],
		ReportKey:         reportKey,
		Rules:             rules,
		AutogenRules:      autogen,
		VAPGenerated:      vapGenerated,
		VAPMessage:        vapMessage,
	}
}

func extractKyvernoRule(rule map[string]any, policyAction string) KyvernoRule {
	name, _ := rule["name"].(string)
	typ := kyvernoRuleType(rule)
	out := KyvernoRule{Name: name, Type: typ}
	if typ == "validate" {
		validate, _ := rule["validate"].(map[string]any)
		out.Subtype = kyvernoValidateSubtype(validate)
		out.FailureAction = kyvernoFailureAction(rule, policyAction)
		out.Message, _ = validate["message"].(string)
	}
	out.MatchMode, out.Match = summarizeKyvernoFilter(rule["match"])
	out.ExcludeMode, out.Exclude = summarizeKyvernoFilter(rule["exclude"])
	_, out.Preconditions = rule["preconditions"]
	return out
}

func kyvernoRuleType(rule map[string]any) string {
	for _, typ := range []string{"validate", "mutate", "generate", "verifyImages"} {
		if _, ok := rule[typ]; ok {
			return typ
		}
	}
	return ""
}

func kyvernoValidateSubtype(validate map[string]any) string {
	for _, subtype := range []string{"pattern", "anyPattern", "deny", "cel", "podSecurity", "foreach", "assert", "manifests"} {
		if _, ok := validate[subtype]; ok {
			return subtype
		}
	}
	return ""
}

// kyvernoFailureAction is a validate rule's effective action: its own
// validate.failureAction (Kyverno 1.13+), else the deprecated policy-wide
// spec.validationFailureAction, else Kyverno's default, Audit. Older
// policies spell the values in lower case.
func kyvernoFailureAction(rule map[string]any, policyAction string) string {
	action, _, _ := unstructured.NestedString(rule, "validate", "failureAction")
	if action == "" {
		action = policyAction
	}
	switch strings.ToLower(action) {
	case "enforce":
		return "Enforce"
	default:
		return "Audit"
	}
}

// kyvernoReady reads the Ready condition Kyverno sets once a policy compiled
// and its webhooks are registered.
func kyvernoReady(obj *unstructured.Unstructured) (status, message string) {
	conds, _, _ := nestedSliceNoCopy(obj.Object, "status", "conditions")
	for _, item := range conds {
		cond, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if t, _ := cond["type"].(string); t == "Ready" {
			status, _ = cond["status"].(string)
			message, _ = cond["message"].(string)
			return status, message
		}
	}
	return "", ""
}

// kyvernoResourceFilters returns the resources blocks of a match or exclude
// filter: each entry of any/all, or the legacy top-level resources block.
func kyvernoResourceFilters(filter any) []map[string]any {
	f, ok := filter.(map[string]any)
	if !ok {
		return nil
	}
	var out []map[string]any
	for _, mode := range []string{"any", "all"} {
		list, _ := f[mode].([]any)
		for _, item := range list {
			if entry, ok := item.(map[string]any); ok {
				if resources, ok := entry["resources"].(map[string]any); ok {
					out = append(out, resources)
				}
			}
		}
	}
	if resources, ok := f["resources"].(map[string]any); ok && len(resources) > 0 {
		out = append(out, resources)
	}
	return out
}

// summarizeKyvernoFilter renders a match or exclude filter as its mode ("any",
// "all", or "" for the legacy single block) and one clause per entry, e.g.
// "Pod · namespaces: tekton-pipelines · names: *build*". Entries matching
// users or roles instead of resources are summarized by those.
func summarizeKyvernoFilter(filter any) (mode string, clauses []string) {
	clauses = []string{}
	f, ok := filter.(map[string]any)
	if !ok {
		return "", clauses
	}
	for _, m := range []string{"any", "all"} {
		list, _ := f[m].([]any)
		for _, item := range list {
			if entry, ok := item.(map[string]any); ok {
				mode = m
				clauses = append(clauses, summarizeKyvernoFilterEntry(entry))
			}
		}
	}
	if mode == "" && len(f) > 0 {
		clauses = append(clauses, summarizeKyvernoFilterEntry(f))
	}
	return mode, clauses
}

func summarizeKyvernoFilterEntry(entry map[string]any) string {
	var parts []string
	if resources, ok := entry["resources"].(map[string]any); ok {
		if kinds := nestedStrings(resources, "kinds"); len(kinds) > 0 {
			parts = append(parts, strings.Join(kinds, ", "))
		}
		for _, field := range []string{"namespaces", "names", "operations"} {
			if values := nestedStrings(resources, field); len(values) > 0 {
				parts = append(parts, field+": "+strings.Join(values, ", "))
			}
		}
		if name, _ := resources["name"].(string); name != "" {
			parts = append(parts, "name: "+name)
		}
		for _, field := range []string{"selector", "namespaceSelector"} {
			if sel := summarizeLabelSelector(resources[field]); sel != "" {
				parts = append(parts, field+": "+sel)
			}
		}
	}
	for _, field := range []string{"roles", "clusterRoles"} {
		if values := nestedStrings(entry, field); len(values) > 0 {
			parts = append(parts, field+": "+strings.Join(values, ", "))
		}
	}
	if subjects, ok := entry["subjects"].([]any); ok && len(subjects) > 0 {
		names := make([]string, 0, len(subjects))
		for _, s := range subjects {
			if subject, ok := s.(map[string]any); ok {
				kind, _ := subject["kind"].(string)
				name, _ := subject["name"].(string)
				names = append(names, kind+" "+name)
			}
		}
		parts = append(parts, "subjects: "+strings.Join(names, ", "))
	}
	if len(parts) == 0 {
		return "any resource"
	}
	return strings.Join(parts, " · ")
}

// summarizeLabelSelector renders an unstructured label selector as
// "k=v, k2 In (a, b)"; "" for an absent or empty selector.
func summarizeLabelSelector(raw any) string {
	sel, ok := raw.(map[string]any)
	if !ok {
		return ""
	}
	var parts []string
	if labels, ok := sel["matchLabels"].(map[string]any); ok {
		keys := make([]string, 0, len(labels))
		for k := range labels {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			parts = append(parts, fmt.Sprintf("%s=%v", k, labels[k]))
		}
	}
	if exprs, ok := sel["matchExpressions"].([]any); ok {
		for _, item := range exprs {
			expr, ok := item.(map[string]any)
			if !ok {
				continue
			}
			key, _ := expr["key"].(string)
			op, _ := expr["operator"].(string)
			values := nestedStrings(expr, "values")
			if len(values) > 0 {
				parts = append(parts, fmt.Sprintf("%s %s (%s)", key, op, strings.Join(values, ", ")))
			} else {
				parts = append(parts, key+" "+op)
			}
		}
	}
	return strings.Join(parts, ", ")
}

// ---------------------------------------------------------------------------
// PolicyException
// ---------------------------------------------------------------------------

// KyvernoPolicyExceptionInfo is the row shape for the PolicyExceptions list.
// Policies lists the exempted policy names; Match summarizes what is exempt.
type KyvernoPolicyExceptionInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Policies  []string `json:"policies"`
	Match     []string `json:"match"`
	CreatedAt string   `json:"createdAt"`
}

// KyvernoExceptionTarget is one policy an exception applies to, with the rules
// it exempts (often "autogen-" rules for Pod controllers).
type KyvernoExceptionTarget struct {
	PolicyName string   `json:"policyName"`
	RuleNames  []string `json:"ruleNames"`
}

type KyvernoPolicyExceptionDetail struct {
	KyvernoPolicyExceptionInfo
	Targets     []KyvernoExceptionTarget `json:"targets"`
	MatchMode   string                   `json:"matchMode"`
	ExcludeMode string                   `json:"excludeMode"`
	Exclude     []string                 `json:"exclude"`
	Background  bool                     `json:"background"`
	Conditions  bool                     `json:"conditions"`
	PodSecurity []string                 `json:"podSecurity"`
}

func (m *ClientManager) ListKyvernoPolicyExceptions(contextName, namespace string) []KyvernoPolicyExceptionInfo {
	gvr, ok := m.servedGVR(contextName, kyvernoGroup, kyvernoPolicyExceptionsResource)
	if !ok {
		return []KyvernoPolicyExceptionInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]KyvernoPolicyExceptionInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractKyvernoPolicyException(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetKyvernoPolicyException(ctx context.Context, contextName, namespace, name string) (*KyvernoPolicyExceptionDetail, error) {
	gvr, ok := m.servedGVR(contextName, kyvernoGroup, kyvernoPolicyExceptionsResource)
	if !ok {
		return nil, fmt.Errorf("%s.%s is not served by this cluster", kyvernoPolicyExceptionsResource, kyvernoGroup)
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	targets := []KyvernoExceptionTarget{}
	rawTargets, _, _ := nestedSliceNoCopy(obj.Object, "spec", "exceptions")
	for _, item := range rawTargets {
		target, ok := item.(map[string]any)
		if !ok {
			continue
		}
		policy, _ := target["policyName"].(string)
		targets = append(targets, KyvernoExceptionTarget{PolicyName: policy, RuleNames: nestedStrings(target, "ruleNames")})
	}
	podSecurity := []string{}
	rawControls, _, _ := nestedSliceNoCopy(obj.Object, "spec", "podSecurity")
	for _, item := range rawControls {
		if control, ok := item.(map[string]any); ok {
			name, _ := control["controlName"].(string)
			podSecurity = append(podSecurity, name)
		}
	}
	matchMode, _ := summarizeKyvernoFilter(nestedField(obj.Object, "spec", "match"))
	excludeMode, exclude := summarizeKyvernoFilter(nestedField(obj.Object, "spec", "exclude"))
	_, hasConditions := nestedMapNoCopyOK(obj.Object, "spec", "conditions")
	return &KyvernoPolicyExceptionDetail{
		KyvernoPolicyExceptionInfo: extractKyvernoPolicyException(obj),
		Targets:                    targets,
		MatchMode:                  matchMode,
		ExcludeMode:                excludeMode,
		Exclude:                    exclude,
		Background:                 nestedBoolOrTrue(obj.Object, "spec", "background"),
		Conditions:                 hasConditions,
		PodSecurity:                podSecurity,
	}, nil
}

func extractKyvernoPolicyException(obj *unstructured.Unstructured) KyvernoPolicyExceptionInfo {
	policies := []string{}
	seen := map[string]bool{}
	rawTargets, _, _ := nestedSliceNoCopy(obj.Object, "spec", "exceptions")
	for _, item := range rawTargets {
		if target, ok := item.(map[string]any); ok {
			if policy, _ := target["policyName"].(string); policy != "" && !seen[policy] {
				seen[policy] = true
				policies = append(policies, policy)
			}
		}
	}
	_, match := summarizeKyvernoFilter(nestedField(obj.Object, "spec", "match"))
	return KyvernoPolicyExceptionInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Policies:  policies,
		Match:     match,
		CreatedAt: crCreatedAt(obj),
	}
}

// ---------------------------------------------------------------------------
// Unstructured helpers
// ---------------------------------------------------------------------------

// nestedBoolOrTrue reads a bool field that Kyverno treats as true when unset
// (spec.admission, spec.background, evaluation.*.enabled).
func nestedBoolOrTrue(obj map[string]any, fields ...string) bool {
	v, found, err := unstructured.NestedBool(obj, fields...)
	if err != nil || !found {
		return true
	}
	return v
}

// nestedStrings reads a string list field of a map, skipping non-strings, and
// never returns nil.
func nestedStrings(m map[string]any, field string) []string {
	raw, _ := m[field].([]any)
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		if s, ok := item.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func nestedField(obj map[string]any, fields ...string) any {
	v, _, _ := unstructured.NestedFieldNoCopy(obj, fields...)
	return v
}

func nestedMapNoCopyOK(obj map[string]any, fields ...string) (map[string]any, bool) {
	m, found, _ := nestedMapNoCopy(obj, fields...)
	return m, found
}

func sortedKeys(set map[string]bool) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
