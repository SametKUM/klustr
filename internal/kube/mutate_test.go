package kube

import (
	"encoding/json"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestBuildResizePatch(t *testing.T) {
	if _, err := buildResizePatch("", "100m", "", "", ""); err == nil {
		t.Fatal("empty container name should error")
	}
	if _, err := buildResizePatch("app", "", "", "", ""); err == nil {
		t.Fatal("no quantities should error")
	}
	if _, err := buildResizePatch("app", "not-a-qty", "", "", ""); err == nil {
		t.Fatal("invalid quantity should error")
	}

	data, err := buildResizePatch("app", "250m", "500m", "128Mi", "256Mi")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var got struct {
		Spec struct {
			Containers []struct {
				Name      string `json:"name"`
				Resources struct {
					Requests map[string]string `json:"requests"`
					Limits   map[string]string `json:"limits"`
				} `json:"resources"`
			} `json:"containers"`
		} `json:"spec"`
	}
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("patch is not valid JSON: %v", err)
	}
	c := got.Spec.Containers[0]
	if c.Name != "app" {
		t.Fatalf("container name = %q, want app", c.Name)
	}
	if c.Resources.Requests["cpu"] != "250m" || c.Resources.Requests["memory"] != "128Mi" {
		t.Fatalf("requests = %v", c.Resources.Requests)
	}
	if c.Resources.Limits["cpu"] != "500m" || c.Resources.Limits["memory"] != "256Mi" {
		t.Fatalf("limits = %v", c.Resources.Limits)
	}

	// A partial resize must omit the untouched side entirely.
	data, err = buildResizePatch("app", "", "", "512Mi", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var partial map[string]any
	if err := json.Unmarshal(data, &partial); err != nil {
		t.Fatalf("patch is not valid JSON: %v", err)
	}
	res := partial["spec"].(map[string]any)["containers"].([]any)[0].(map[string]any)["resources"].(map[string]any)
	if _, hasLimits := res["limits"]; hasLimits {
		t.Fatalf("limits should be omitted, got %v", res["limits"])
	}
	if res["requests"].(map[string]any)["memory"] != "512Mi" {
		t.Fatalf("expected memory request 512Mi, got %v", res["requests"])
	}
}

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
