package kube

import (
	"context"
	"reflect"
	"testing"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var (
	testPolicyReportGVR        = schema.GroupVersionResource{Group: policyReportGroup, Version: "v1alpha2", Resource: policyReportsResource}
	testClusterPolicyReportGVR = schema.GroupVersionResource{Group: policyReportGroup, Version: "v1alpha2", Resource: clusterPolicyReportsResource}
)

// A report in the shape Kyverno's reports-controller writes: named after the
// resource UID, scoped to it.
const storefrontReport = `
apiVersion: wgpolicyk8s.io/v1alpha2
kind: PolicyReport
metadata:
  name: f9291ae4-6193-4e6b-9612-058fcfe18e49
  namespace: demo-storefront
  creationTimestamp: "2026-10-04T10:47:20Z"
scope:
  apiVersion: apps/v1
  kind: Deployment
  name: storefront-web
  namespace: demo-storefront
  uid: f9291ae4-6193-4e6b-9612-058fcfe18e49
summary: {pass: 1, fail: 2, warn: 1, error: 0, skip: 1}
results:
  - {policy: disallow-host-path, rule: autogen-disallow-host-path-volumes, result: skip, source: kyverno}
  - {policy: disallow-privileged-containers, rule: autogen-disallow-privileged-containers, result: pass, source: kyverno}
  - policy: restrict-seccomp
    rule: autogen-validate-seccomp-profile
    result: warn
    source: kyverno
  - policy: disallow-latest-tag
    rule: autogen-validate-image-tag
    result: fail
    message: "validation error: images cannot use ':latest'."
    severity: medium
    category: Pod Security
    source: kyverno
    timestamp: {seconds: 1791106051, nanos: 0}
  - {policy: demo-storefront/require-team-label, rule: check-team-label, result: fail, source: kyverno}
`

func TestExtractPolicyReport(t *testing.T) {
	info := extractPolicyReport(mustUnstructured(t, storefrontReport))
	want := PolicyReportInfo{
		Name:            "f9291ae4-6193-4e6b-9612-058fcfe18e49",
		Namespace:       "demo-storefront",
		ScopeAPIVersion: "apps/v1",
		ScopeKind:       "Deployment",
		ScopeNamespace:  "demo-storefront",
		ScopeName:       "storefront-web",
		Pass:            1,
		Fail:            2,
		Warn:            1,
		Skip:            1,
		Source:          "kyverno",
		CreatedAt:       "2026-10-04T10:47:20Z",
	}
	if info != want {
		t.Fatalf("info =\n%+v\nwant\n%+v", info, want)
	}

	// Without a summary block the tally comes from the results.
	noSummary := mustUnstructured(t, storefrontReport)
	delete(noSummary.Object, "summary")
	if got := extractPolicyReport(noSummary); got.Fail != 2 || got.Pass != 1 || got.Warn != 1 || got.Skip != 1 {
		t.Fatalf("tallied = %+v", got)
	}
}

func TestExtractPolicyReportDetailOrdersWorstFirst(t *testing.T) {
	detail := extractPolicyReportDetail(mustUnstructured(t, storefrontReport))
	got := make([]string, 0, len(detail.Results))
	for _, r := range detail.Results {
		got = append(got, r.Result+" "+r.Policy)
	}
	want := []string{
		"fail demo-storefront/require-team-label",
		"fail disallow-latest-tag",
		"warn restrict-seccomp",
		"skip disallow-host-path",
		"pass disallow-privileged-containers",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("results =\n%v\nwant\n%v", got, want)
	}
	if ts := detail.Results[1].Timestamp; ts != "2026-10-04T09:27:31Z" {
		t.Fatalf("timestamp = %q, want the {seconds, nanos} value as RFC3339", ts)
	}
	if ts := detail.Results[0].Timestamp; ts != "" {
		t.Fatalf("a result without a timestamp has none, got %q", ts)
	}
	if detail.Results[0].Resources == nil {
		t.Fatal("resources must encode as [], not null")
	}
}

func TestPolicyViolationsIn(t *testing.T) {
	scoped := mustUnstructured(t, storefrontReport)
	got := policyViolationsIn(scoped, "disallow-latest-tag")
	if len(got) != 1 || got[0].Kind != "Deployment" || got[0].Name != "storefront-web" || got[0].Result != "fail" {
		t.Fatalf("scoped violations = %+v", got)
	}
	if got := policyViolationsIn(scoped, "disallow-privileged-containers"); len(got) != 0 {
		t.Fatalf("a passing result is not a violation, got %+v", got)
	}
	if got := policyViolationsIn(scoped, "require-team-label"); len(got) != 0 {
		t.Fatal("a namespaced policy is keyed <namespace>/<name>; the bare name must not match")
	}

	// Reports without a scope list the resources on each result.
	unscoped := mustUnstructured(t, `
apiVersion: wgpolicyk8s.io/v1alpha2
kind: PolicyReport
metadata: {name: polr-ns-shop, namespace: shop}
results:
  - policy: disallow-latest-tag
    result: warn
    resources:
      - {apiVersion: v1, kind: Pod, namespace: shop, name: a}
      - {apiVersion: v1, kind: Pod, namespace: shop, name: b}
`)
	if got := policyViolationsIn(unscoped, "disallow-latest-tag"); len(got) != 2 || got[1].Name != "b" {
		t.Fatalf("unscoped violations = %+v", got)
	}
}

func TestPolicyReportForResource(t *testing.T) {
	deployment := mustUnstructured(t, `
apiVersion: apps/v1
kind: Deployment
metadata: {name: storefront-web, namespace: demo-storefront, uid: f9291ae4-6193-4e6b-9612-058fcfe18e49}
`)
	other := mustUnstructured(t, `
apiVersion: apps/v1
kind: Deployment
metadata: {name: storefront-api, namespace: demo-storefront, uid: 0b7c1a3e-0000-4000-8000-000000000000}
`)
	namespace := mustUnstructured(t, `
apiVersion: v1
kind: Namespace
metadata: {name: demo-storefront, uid: d1119de4-be8a-409e-bd09-8dc3da5ce89c}
`)
	nsReport := mustUnstructured(t, `
apiVersion: wgpolicyk8s.io/v1alpha2
kind: ClusterPolicyReport
metadata: {name: d1119de4-be8a-409e-bd09-8dc3da5ce89c}
scope: {apiVersion: v1, kind: Namespace, name: demo-storefront, uid: d1119de4-be8a-409e-bd09-8dc3da5ce89c}
results:
  - {policy: require-namespace-owner, rule: check-owner-label, result: fail}
`)
	crds := []fakeCRD{
		{gvr: testPolicyReportGVR, kind: "PolicyReport", namespaced: true},
		{gvr: testClusterPolicyReportGVR, kind: "ClusterPolicyReport"},
	}
	m, _ := fakeCRDManager(t, crds, []runtime.Object{deployment, other, namespace, mustUnstructured(t, storefrontReport), nsReport}...)
	ctx := context.Background()

	report, err := m.PolicyReportForResource(ctx, "ctx", "Deployment", "demo-storefront", "storefront-web")
	if err != nil || report == nil || report.Fail != 2 {
		t.Fatalf("report = %+v, err = %v", report, err)
	}
	report, err = m.PolicyReportForResource(ctx, "ctx", "Deployment", "demo-storefront", "storefront-api")
	if err != nil || report != nil {
		t.Fatalf("a resource without a report gets none, got %+v / %v", report, err)
	}
	report, err = m.PolicyReportForResource(ctx, "ctx", "Namespace", "", "demo-storefront")
	if err != nil || report == nil || report.ScopeKind != "Namespace" {
		t.Fatalf("cluster-scoped report = %+v, err = %v", report, err)
	}
	report, err = m.PolicyReportForResource(ctx, "ctx", "Deployment", "demo-storefront", "gone")
	if err != nil || report != nil {
		t.Fatalf("a missing resource has no report, got %+v / %v", report, err)
	}

	// Without the report CRDs there is nothing to look up and no error.
	bare, _ := fakeCRDManager(t, nil, deployment)
	if report, err := bare.PolicyReportForResource(ctx, "ctx", "Deployment", "demo-storefront", "storefront-web"); err != nil || report != nil {
		t.Fatalf("no CRDs: %+v / %v", report, err)
	}
}

func TestPolicyReportForResourceRejectsMismatchedScope(t *testing.T) {
	deployment := mustUnstructured(t, `
apiVersion: apps/v1
kind: Deployment
metadata: {name: storefront-web, namespace: demo-storefront, uid: f9291ae4-6193-4e6b-9612-058fcfe18e49}
`)
	report := mustUnstructured(t, storefrontReport)
	report.Object["scope"].(map[string]any)["uid"] = "someone-else"
	m, _ := fakeCRDManager(t, []fakeCRD{{gvr: testPolicyReportGVR, kind: "PolicyReport", namespaced: true}}, deployment, report)
	got, err := m.PolicyReportForResource(context.Background(), "ctx", "Deployment", "demo-storefront", "storefront-web")
	if err != nil || got != nil {
		t.Fatalf("a report scoped to another object must not be shown, got %+v / %v", got, err)
	}
}
