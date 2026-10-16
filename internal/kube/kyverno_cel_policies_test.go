package kube

import (
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func kyvernoCELFixture(t *testing.T, resource string) *unstructured.Unstructured {
	t.Helper()
	data, err := os.ReadFile("testdata/integrations/policies.kyverno.io/" + resource + ".yaml")
	if err != nil {
		t.Fatal(err)
	}
	return mustUnstructured(t, string(data))
}

func TestKyvernoMutatingPolicy(t *testing.T) {
	d := extractKyvernoMutatingPolicyDetail(kyvernoCELFixture(t, "mutatingpolicies"))
	if d.Mutations != 2 || !reflect.DeepEqual(d.PatchTypes, []string{"ApplyConfiguration", "JSONPatch"}) {
		t.Fatalf("mutations = %d %v", d.Mutations, d.PatchTypes)
	}
	if !d.Admission || !d.MutateExisting || d.Ready != "True" || d.ReinvocationPolicy != "IfNeeded" {
		t.Fatalf("flags = %+v", d.KyvernoMutatingPolicyInfo)
	}
	if !strings.Contains(d.MutationList[1].Expression, "JSONPatch{op") || !reflect.DeepEqual(d.TargetResources, []string{"deployments.apps (CREATE, UPDATE)"}) {
		t.Fatalf("detail = %+v", d)
	}
	if d.TargetExpression != "" {
		t.Fatalf("target expression = %q", d.TargetExpression)
	}
	// Targets picked by an expression alone have no resource rules to show.
	byExpression := extractKyvernoMutatingPolicyDetail(mustUnstructured(t, `apiVersion: policies.kyverno.io/v1
kind: MutatingPolicy
metadata: {name: x}
spec:
  evaluation: {mutateExisting: {enabled: true}}
  targetMatchConstraints:
    expression: resource.List("apps/v1", "deployments", object.metadata.namespace).items`))
	if byExpression.TargetExpression != `resource.List("apps/v1", "deployments", object.metadata.namespace).items` ||
		byExpression.TargetResources == nil || len(byExpression.TargetResources) != 0 {
		t.Fatalf("expression targets = %q %v", byExpression.TargetExpression, byExpression.TargetResources)
	}
}

func TestKyvernoValidationActionsDefaultToDeny(t *testing.T) {
	for _, kind := range []string{"ValidatingPolicy", "NamespacedValidatingPolicy", "ImageValidatingPolicy", "NamespacedImageValidatingPolicy"} {
		obj := mustUnstructured(t, "apiVersion: policies.kyverno.io/v1\nkind: "+kind+"\nmetadata: {name: x, namespace: shop}\nspec: {}")
		var got []string
		if strings.Contains(kind, "Image") {
			got = extractKyvernoImageValidatingPolicy(obj).Actions
		} else {
			got = extractKyvernoValidatingPolicy(obj).Actions
		}
		if !reflect.DeepEqual(got, []string{"Deny"}) {
			t.Fatalf("%s without validationActions = %v, want [Deny]", kind, got)
		}
	}
	if got := extractKyvernoImageValidatingPolicy(kyvernoCELFixture(t, "namespacedimagevalidatingpolicies")).Actions; !reflect.DeepEqual(got, []string{"Audit"}) {
		t.Fatalf("explicit actions = %v", got)
	}
}

func TestKyvernoGeneratingPolicy(t *testing.T) {
	d := extractKyvernoGeneratingPolicyDetail(kyvernoCELFixture(t, "generatingpolicies"))
	if d.Generations != 1 || !d.Synchronize || !d.GenerateExisting || d.OrphanOnDelete {
		t.Fatalf("flags = %+v", d.KyvernoGeneratingPolicyInfo)
	}
	if d.GenerationList[0].Expression != "generator.Apply(variables.nsName, variables.netpol)" || len(d.Variables) != 2 {
		t.Fatalf("detail = %+v", d)
	}
	ns := extractKyvernoGeneratingPolicyDetail(kyvernoCELFixture(t, "namespacedgeneratingpolicies"))
	if ns.GenerationList[0].Interpolate != "ObjectTemplate" || !strings.Contains(ns.GenerationList[0].Template, "kind: ConfigMap") {
		t.Fatalf("template generation = %+v", ns.GenerationList)
	}
}

func TestKyvernoDeletingPolicySchedule(t *testing.T) {
	now := time.Date(2026, 10, 16, 7, 30, 0, 0, time.UTC)
	d := extractKyvernoDeletingPolicyDetail(kyvernoCELFixture(t, "deletingpolicies"), now)
	if d.Schedule != "0 */6 * * *" || d.NextExecution != "2026-10-16T12:00:00Z" || d.LastExecution != "2026-10-16T06:00:00Z" {
		t.Fatalf("schedule = %+v", d.KyvernoDeletingPolicyInfo)
	}
	if d.Propagation != "Background" || len(d.DeleteConditions) != 1 || d.DeleteConditions[0].Name != "finished-a-day-ago" {
		t.Fatalf("detail = %+v", d)
	}
	// The status conditions stay apart from the CEL deletion conditions.
	if len(d.Conditions) != 1 || d.Conditions[0].Type != "RBACPermissionsGranted" {
		t.Fatalf("status conditions = %+v", d.Conditions)
	}
	bad := mustUnstructured(t, "apiVersion: policies.kyverno.io/v1\nkind: DeletingPolicy\nmetadata: {name: x}\nspec: {schedule: never}")
	if next := kyvernoDeletingPolicyAt(bad, now).NextExecution; next != "" {
		t.Fatalf("unparseable schedule next = %q", next)
	}
}

func TestKyvernoDeletingPolicyScheduleMatchesController(t *testing.T) {
	at := func(schedule string, now time.Time) string {
		obj := mustUnstructured(t, "apiVersion: policies.kyverno.io/v1\nkind: DeletingPolicy\nmetadata: {name: x}\nspec: {schedule: '"+schedule+"'}")
		return kyvernoDeletingPolicyAt(obj, now).NextExecution
	}
	// 10:30 in Istanbul is 07:30 on the controller's UTC clock.
	istanbul := time.Date(2026, 10, 16, 10, 30, 0, 0, time.FixedZone("TRT", 3*3600))
	for _, tc := range []struct{ schedule, want string }{
		{"0 */6 * * *", "2026-10-16T12:00:00Z"},
		{"0 0 * * *", "2026-10-17T00:00:00Z"},
		// Schedules Kyverno's parser accepts beyond the standard five fields:
		// Sunday as 7 and the last day of the month.
		{"0 0 * * 7", "2026-10-18T00:00:00Z"},
		{"0 0 L * *", "2026-10-31T00:00:00Z"},
	} {
		if got := at(tc.schedule, istanbul); got != tc.want {
			t.Errorf("next run of %q = %q, want %q", tc.schedule, got, tc.want)
		}
	}
}

func TestKyvernoImageValidatingPolicy(t *testing.T) {
	d := extractKyvernoImageValidatingPolicyDetail(kyvernoCELFixture(t, "imagevalidatingpolicies"))
	if !reflect.DeepEqual(d.Images, []string{"registry.example.com/shop/*"}) ||
		!reflect.DeepEqual(d.Attestors, []string{"release-key (cosign)", "github-actions (cosign)"}) {
		t.Fatalf("info = %+v", d.KyvernoImageValidatingPolicyInfo)
	}
	want := []KyvernoAttestor{
		{Name: "release-key", Type: "cosign", Details: []string{"inline public key", "Rekor https://rekor.sigstore.dev"}},
		{Name: "github-actions", Type: "cosign", Details: []string{"keyless https://github.com/example/shop/.* from https://token.actions.githubusercontent.com"}},
	}
	if !reflect.DeepEqual(d.AttestorList, want) {
		t.Fatalf("attestors = %+v", d.AttestorList)
	}
	if !d.MutateDigest || !d.VerifyDigest || !d.Required || !reflect.DeepEqual(d.CredentialProviders, []string{"amazon"}) {
		t.Fatalf("configuration = %+v", d)
	}
	if !reflect.DeepEqual(d.Attestations, []KyvernoAttestation{{Name: "sbom", Kind: "in-toto", Type: "https://spdx.dev/Document"}}) {
		t.Fatalf("attestations = %+v", d.Attestations)
	}
	// Key and certificate material stays in the cluster object.
	for _, resource := range []string{"imagevalidatingpolicies", "namespacedimagevalidatingpolicies"} {
		data, _ := json.Marshal(extractKyvernoImageValidatingPolicyDetail(kyvernoCELFixture(t, resource)))
		if strings.Contains(string(data), "BEGIN") {
			t.Fatalf("%s detail copies key material: %s", resource, data)
		}
	}
	ns := extractKyvernoImageValidatingPolicyDetail(kyvernoCELFixture(t, "namespacedimagevalidatingpolicies"))
	if ns.MutateDigest || ns.Ready != "False" || ns.AttestorList[0].Details[0] != "certificates inline" {
		t.Fatalf("namespaced = %+v", ns)
	}
}
