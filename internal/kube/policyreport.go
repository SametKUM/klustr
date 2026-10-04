package kube

import (
	"context"
	"fmt"
	"sort"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// PolicyReports (wgpolicyk8s.io, v1alpha2) are the Kubernetes Policy WG's
// shared report format. Kyverno's reports-controller writes one report per
// resource, named after the resource's UID with scope set to it; other tools
// (Kubewarden, Falco's adapter) write the same kinds, sometimes listing the
// resources per result instead of a scope.
const (
	policyReportGroup            = "wgpolicyk8s.io"
	policyReportsResource        = "policyreports"
	clusterPolicyReportsResource = "clusterpolicyreports"
)

// PolicyReportInfo is the row shape for both report lists: the resource the
// report is about (Scope*, empty for a report without a scope) and its tally.
type PolicyReportInfo struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	ScopeAPIVersion string `json:"scopeApiVersion"`
	ScopeKind       string `json:"scopeKind"`
	ScopeNamespace  string `json:"scopeNamespace"`
	ScopeName       string `json:"scopeName"`
	Pass            int    `json:"pass"`
	Fail            int    `json:"fail"`
	Warn            int    `json:"warn"`
	Error           int    `json:"error"`
	Skip            int    `json:"skip"`
	Source          string `json:"source"`
	CreatedAt       string `json:"createdAt"`
}

// PolicyReportResource identifies a resource a result applies to.
type PolicyReportResource struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Namespace  string `json:"namespace"`
	Name       string `json:"name"`
}

// PolicyReportResult is one policy/rule outcome. Resources is set only on
// reports without a scope; a scoped report's results are about its scope.
type PolicyReportResult struct {
	Policy    string                 `json:"policy"`
	Rule      string                 `json:"rule"`
	Result    string                 `json:"result"`
	Message   string                 `json:"message"`
	Severity  string                 `json:"severity"`
	Category  string                 `json:"category"`
	Source    string                 `json:"source"`
	Timestamp string                 `json:"timestamp"`
	Resources []PolicyReportResource `json:"resources"`
}

type PolicyReportDetail struct {
	PolicyReportInfo
	Results []PolicyReportResult `json:"results"`
}

func (m *ClientManager) ListPolicyReports(contextName, namespace string) []PolicyReportInfo {
	return m.listPolicyReports(contextName, policyReportsResource, namespace)
}

func (m *ClientManager) ListClusterPolicyReports(contextName string) []PolicyReportInfo {
	return m.listPolicyReports(contextName, clusterPolicyReportsResource, "")
}

func (m *ClientManager) listPolicyReports(contextName, resource, namespace string) []PolicyReportInfo {
	gvr, ok := m.servedGVR(contextName, policyReportGroup, resource)
	if !ok {
		return []PolicyReportInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]PolicyReportInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractPolicyReport(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetPolicyReport(ctx context.Context, contextName, namespace, name string) (*PolicyReportDetail, error) {
	return m.getPolicyReport(ctx, contextName, policyReportsResource, namespace, name)
}

func (m *ClientManager) GetClusterPolicyReport(ctx context.Context, contextName, name string) (*PolicyReportDetail, error) {
	return m.getPolicyReport(ctx, contextName, clusterPolicyReportsResource, "", name)
}

func (m *ClientManager) getPolicyReport(ctx context.Context, contextName, resource, namespace, name string) (*PolicyReportDetail, error) {
	gvr, ok := m.servedGVR(contextName, policyReportGroup, resource)
	if !ok {
		return nil, fmt.Errorf("%s.%s is not served by this cluster", resource, policyReportGroup)
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractPolicyReportDetail(obj), nil
}

// PolicyReportForResource returns the report Kyverno keeps for one resource,
// or nil when there is none. Kyverno names that report after the resource's
// UID (a PolicyReport in the resource's namespace, a ClusterPolicyReport for
// a cluster-scoped resource), so a single GET finds it without watching every
// report in the cluster. A report the user may not read counts as none.
func (m *ClientManager) PolicyReportForResource(ctx context.Context, contextName, kind, namespace, name string) (*PolicyReportDetail, error) {
	reportResource := policyReportsResource
	if namespace == "" {
		reportResource = clusterPolicyReportsResource
	}
	reportGVR, ok := m.servedGVR(contextName, policyReportGroup, reportResource)
	if !ok {
		return nil, nil
	}
	gvr, err := m.resolveKind(contextName, kind)
	if err != nil {
		return nil, err
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	target, err := resourceFor(dyn, gvr, namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	report, err := resourceFor(dyn, reportGVR, namespace).Get(ctx, string(target.GetUID()), metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) || apierrors.IsForbidden(err) {
			return nil, nil
		}
		return nil, err
	}
	if scopeUID, _, _ := unstructured.NestedString(report.Object, "scope", "uid"); scopeUID != "" && scopeUID != string(target.GetUID()) {
		return nil, nil
	}
	return extractPolicyReportDetail(report), nil
}

// PolicyViolation is a non-passing result of one policy, joined with the
// resource it is about.
type PolicyViolation struct {
	PolicyReportResource
	Rule      string `json:"rule"`
	Result    string `json:"result"`
	Message   string `json:"message"`
	Severity  string `json:"severity"`
	Timestamp string `json:"timestamp"`
}

// PolicyViolationsFor collects the fail, error and warn results of one policy
// across the cached PolicyReports and ClusterPolicyReports. policyKey is how
// reports name the policy: "<name>" for a cluster-wide policy and
// "<namespace>/<name>" for a namespaced one. The caller starts both report
// watches first (the frontend does, when the Violations tab opens).
func (m *ClientManager) PolicyViolationsFor(contextName, policyKey string) []PolicyViolation {
	out := []PolicyViolation{}
	for _, resource := range []string{policyReportsResource, clusterPolicyReportsResource} {
		gvr, ok := m.servedGVR(contextName, policyReportGroup, resource)
		if !ok {
			continue
		}
		for _, obj := range listCachedCRs(m, contextName, gvr, "") {
			out = append(out, policyViolationsIn(obj, policyKey)...)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if ra, rb := policyResultRank(a.Result), policyResultRank(b.Result); ra != rb {
			return ra < rb
		}
		if a.Namespace != b.Namespace {
			return a.Namespace < b.Namespace
		}
		if a.Kind != b.Kind {
			return a.Kind < b.Kind
		}
		if a.Name != b.Name {
			return a.Name < b.Name
		}
		return a.Rule < b.Rule
	})
	return out
}

func policyViolationsIn(report *unstructured.Unstructured, policyKey string) []PolicyViolation {
	scope := policyReportScope(report)
	var out []PolicyViolation
	results, _, _ := nestedSliceNoCopy(report.Object, "results")
	for _, item := range results {
		r, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if policy, _ := r["policy"].(string); policy != policyKey {
			continue
		}
		result := extractPolicyReportResult(r)
		if result.Result != "fail" && result.Result != "error" && result.Result != "warn" {
			continue
		}
		targets := result.Resources
		if scope.Kind != "" {
			targets = []PolicyReportResource{scope}
		}
		for _, target := range targets {
			out = append(out, PolicyViolation{
				PolicyReportResource: target,
				Rule:                 result.Rule,
				Result:               result.Result,
				Message:              result.Message,
				Severity:             result.Severity,
				Timestamp:            result.Timestamp,
			})
		}
	}
	return out
}

func extractPolicyReport(obj *unstructured.Unstructured) PolicyReportInfo {
	scope := policyReportScope(obj)
	info := PolicyReportInfo{
		Name:            obj.GetName(),
		Namespace:       obj.GetNamespace(),
		ScopeAPIVersion: scope.APIVersion,
		ScopeKind:       scope.Kind,
		ScopeNamespace:  scope.Namespace,
		ScopeName:       scope.Name,
		CreatedAt:       crCreatedAt(obj),
	}
	results, _, _ := nestedSliceNoCopy(obj.Object, "results")
	if len(results) > 0 {
		if first, ok := results[0].(map[string]any); ok {
			info.Source, _ = first["source"].(string)
		}
	}
	if summary, found, _ := nestedMapNoCopy(obj.Object, "summary"); found {
		info.Pass = int(toInt64(summary["pass"]))
		info.Fail = int(toInt64(summary["fail"]))
		info.Warn = int(toInt64(summary["warn"]))
		info.Error = int(toInt64(summary["error"]))
		info.Skip = int(toInt64(summary["skip"]))
		return info
	}
	// The summary is optional in the schema; tally the results instead.
	for _, item := range results {
		r, _ := item.(map[string]any)
		switch result, _ := r["result"].(string); result {
		case "pass":
			info.Pass++
		case "fail":
			info.Fail++
		case "warn":
			info.Warn++
		case "error":
			info.Error++
		case "skip":
			info.Skip++
		}
	}
	return info
}

// extractPolicyReportDetail lists the results worst first (fail, error, warn,
// skip, pass), then by policy and rule.
func extractPolicyReportDetail(obj *unstructured.Unstructured) *PolicyReportDetail {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "results")
	results := make([]PolicyReportResult, 0, len(raw))
	for _, item := range raw {
		if r, ok := item.(map[string]any); ok {
			results = append(results, extractPolicyReportResult(r))
		}
	}
	sort.SliceStable(results, func(i, j int) bool {
		a, b := results[i], results[j]
		if ra, rb := policyResultRank(a.Result), policyResultRank(b.Result); ra != rb {
			return ra < rb
		}
		if a.Policy != b.Policy {
			return a.Policy < b.Policy
		}
		return a.Rule < b.Rule
	})
	return &PolicyReportDetail{PolicyReportInfo: extractPolicyReport(obj), Results: results}
}

func extractPolicyReportResult(r map[string]any) PolicyReportResult {
	policy, _ := r["policy"].(string)
	rule, _ := r["rule"].(string)
	result, _ := r["result"].(string)
	message, _ := r["message"].(string)
	severity, _ := r["severity"].(string)
	category, _ := r["category"].(string)
	source, _ := r["source"].(string)
	resources := []PolicyReportResource{}
	rawResources, _ := r["resources"].([]any)
	for _, item := range rawResources {
		if ref, ok := item.(map[string]any); ok {
			resources = append(resources, objectRefFromMap(ref))
		}
	}
	return PolicyReportResult{
		Policy:    policy,
		Rule:      rule,
		Result:    result,
		Message:   message,
		Severity:  severity,
		Category:  category,
		Source:    source,
		Timestamp: policyResultTimestamp(r["timestamp"]),
		Resources: resources,
	}
}

func policyReportScope(obj *unstructured.Unstructured) PolicyReportResource {
	scope, found, _ := nestedMapNoCopy(obj.Object, "scope")
	if !found {
		return PolicyReportResource{}
	}
	return objectRefFromMap(scope)
}

func objectRefFromMap(ref map[string]any) PolicyReportResource {
	apiVersion, _ := ref["apiVersion"].(string)
	kind, _ := ref["kind"].(string)
	namespace, _ := ref["namespace"].(string)
	name, _ := ref["name"].(string)
	return PolicyReportResource{APIVersion: apiVersion, Kind: kind, Namespace: namespace, Name: name}
}

// policyResultTimestamp converts a result's protobuf-style timestamp
// ({seconds, nanos}) to RFC3339; "" when absent.
func policyResultTimestamp(raw any) string {
	ts, ok := raw.(map[string]any)
	if !ok {
		return ""
	}
	seconds := toInt64(ts["seconds"])
	if seconds == 0 {
		return ""
	}
	return time.Unix(seconds, 0).UTC().Format(time.RFC3339)
}

func policyResultRank(result string) int {
	switch result {
	case "fail":
		return 0
	case "error":
		return 1
	case "warn":
		return 2
	case "skip":
		return 3
	default:
		return 4
	}
}
