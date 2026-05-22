package kube

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestExtractArgoApplication(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name":      "demo-app",
			"namespace": "argocd",
		},
		"spec": map[string]any{
			"project": "default",
			"source": map[string]any{
				"repoURL":        "https://github.com/example/repo",
				"path":           "manifests/prod",
				"targetRevision": "main",
			},
			"syncPolicy": map[string]any{
				"automated": map[string]any{
					"selfHeal": true,
					"prune":    false,
				},
			},
		},
		"status": map[string]any{
			"sync":   map[string]any{"status": "Synced", "revision": "abc123"},
			"health": map[string]any{"status": "Healthy"},
		},
	}}

	got := extractArgoApplication(obj)
	if got.Name != "demo-app" || got.Namespace != "argocd" {
		t.Errorf("identity wrong: %+v", got)
	}
	if got.Sync != "Synced" || got.Health != "Healthy" || got.Revision != "abc123" {
		t.Errorf("status fields wrong: %+v", got)
	}
	if got.Project != "default" || got.RepoURL != "https://github.com/example/repo" ||
		got.Path != "manifests/prod" || got.TargetRevision != "main" {
		t.Errorf("source fields wrong: %+v", got)
	}
	if !got.AutoSync || !got.SelfHeal || got.Prune {
		t.Errorf("auto policy flags wrong: %+v", got)
	}
}

func TestExtractArgoApplicationDefaults(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "bare", "namespace": "argocd"},
		"spec":     map[string]any{},
	}}
	got := extractArgoApplication(obj)
	if got.Sync != "" || got.Health != "" || got.Project != "" {
		t.Errorf("missing fields should default to empty: %+v", got)
	}
	if got.AutoSync || got.SelfHeal || got.Prune {
		t.Errorf("missing automated block should leave flags false: %+v", got)
	}
}

func TestExtractArgoApplicationAutomatedWithoutFlags(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "auto", "namespace": "argocd"},
		"spec": map[string]any{
			"syncPolicy": map[string]any{"automated": map[string]any{}},
		},
	}}
	got := extractArgoApplication(obj)
	if !got.AutoSync {
		t.Error("automated{} block should still flip AutoSync true")
	}
	if got.SelfHeal || got.Prune {
		t.Errorf("flags should remain false: %+v", got)
	}
}

func TestExtractArgoResources(t *testing.T) {
	t.Run("no status.resources returns empty slice", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{"status": map[string]any{}}}
		out := extractArgoResources(obj)
		if out == nil {
			t.Fatal("should return empty slice, not nil")
		}
		if len(out) != 0 {
			t.Errorf("got %d, want 0", len(out))
		}
	})

	t.Run("happy path", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"status": map[string]any{
				"resources": []any{
					map[string]any{
						"group":     "apps",
						"version":   "v1",
						"kind":      "Deployment",
						"namespace": "prod",
						"name":      "api",
						"status":    "Synced",
						"health": map[string]any{
							"status":  "Healthy",
							"message": "Ready",
						},
					},
				},
			},
		}}
		out := extractArgoResources(obj)
		if len(out) != 1 {
			t.Fatalf("got %d", len(out))
		}
		r := out[0]
		if r.Kind != "Deployment" || r.Name != "api" || r.Namespace != "prod" {
			t.Errorf("identity wrong: %+v", r)
		}
		if r.Sync != "Synced" || r.Health != "Healthy" || r.Message != "Ready" {
			t.Errorf("status fields wrong: %+v", r)
		}
	})

	t.Run("skips entries missing kind or name", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"status": map[string]any{
				"resources": []any{
					map[string]any{"kind": "Deployment"},
					map[string]any{"name": "lonely"},
					map[string]any{"kind": "Service", "name": "svc"},
				},
			},
		}}
		out := extractArgoResources(obj)
		if len(out) != 1 || out[0].Kind != "Service" {
			t.Errorf("got %+v", out)
		}
	})
}
