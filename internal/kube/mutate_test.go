package kube

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestResourceForKind(t *testing.T) {
	cases := []struct {
		kind    string
		wantGrp string
		wantRes string
		wantOK  bool
	}{
		{"Pod", "", "pods", true},
		{"Deployment", "apps", "deployments", true},
		{"HorizontalPodAutoscaler", "autoscaling", "horizontalpodautoscalers", true},
		{"Lease", "coordination.k8s.io", "leases", true},
		{"ServiceAccount", "", "serviceaccounts", true},
		{"Role", "rbac.authorization.k8s.io", "roles", true},
		{"RoleBinding", "rbac.authorization.k8s.io", "rolebindings", true},
		{"ClusterRole", "rbac.authorization.k8s.io", "clusterroles", true},
		{"ClusterRoleBinding", "rbac.authorization.k8s.io", "clusterrolebindings", true},
		{"APIService", "apiregistration.k8s.io", "apiservices", true},
		{"Gateway", "gateway.networking.k8s.io", "gateways", true},
		{"HTTPRoute", "gateway.networking.k8s.io", "httproutes", true},
		{"GRPCRoute", "gateway.networking.k8s.io", "grpcroutes", true},
		{"GatewayClass", "gateway.networking.k8s.io", "gatewayclasses", true},
		{"ReferenceGrant", "gateway.networking.k8s.io", "referencegrants", true},
		{"MutatingWebhookConfiguration", "admissionregistration.k8s.io", "mutatingwebhookconfigurations", true},
		{"ValidatingWebhookConfiguration", "admissionregistration.k8s.io", "validatingwebhookconfigurations", true},
		{"NotAKind", "", "", false},
		{"", "", "", false},
	}

	for _, tc := range cases {
		t.Run(tc.kind, func(t *testing.T) {
			gvr, err := resourceForKind(tc.kind)
			if tc.wantOK {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if gvr.Resource != tc.wantRes {
					t.Fatalf("got resource %q, want %q", gvr.Resource, tc.wantRes)
				}
				if gvr.Group != tc.wantGrp {
					t.Fatalf("got group %q, want %q", gvr.Group, tc.wantGrp)
				}
			} else if err == nil {
				t.Fatalf("expected error for kind %q, got nil", tc.kind)
			}
		})
	}
}

func TestSanitizeForYAMLStripsServerOnlyFields(t *testing.T) {
	obj := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "v1",
			"kind":       "Pod",
			"metadata": map[string]any{
				"name":              "demo",
				"namespace":         "default",
				"managedFields":     []any{map[string]any{"manager": "x"}},
				"creationTimestamp": "2026-01-01T00:00:00Z",
				"generation":        int64(1),
				"resourceVersion":   "42",
				"uid":               "abcdef",
				"selfLink":          "/api/v1/namespaces/default/pods/demo",
				"ownerReferences":   []any{map[string]any{"name": "rs"}},
			},
			"spec":   map[string]any{"containers": []any{}},
			"status": map[string]any{"phase": "Running"},
		},
	}

	sanitizeForYAML(obj)

	meta, _ := obj.Object["metadata"].(map[string]any)
	for _, k := range []string{
		"managedFields",
		"creationTimestamp",
		"generation",
		"resourceVersion",
		"uid",
		"selfLink",
		"ownerReferences",
	} {
		if _, ok := meta[k]; ok {
			t.Errorf("metadata.%s should be stripped", k)
		}
	}
	if _, ok := obj.Object["status"]; ok {
		t.Errorf("status should be stripped")
	}

	if meta["name"] != "demo" {
		t.Errorf("metadata.name should be preserved")
	}
	if _, ok := obj.Object["spec"]; !ok {
		t.Errorf("spec should be preserved")
	}
}
