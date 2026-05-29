package kube

import (
	"slices"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestCRChangeKindRoundTrip(t *testing.T) {
	gvr := schema.GroupVersionResource{
		Group:    "argoproj.io",
		Version:  "v1alpha1",
		Resource: "applications",
	}
	k := crChangeKind(gvr)
	if k != "cr:argoproj.io/applications" {
		t.Fatalf("encode: got %q", k)
	}

	out, ok := SplitCRChangeKind(k)
	if !ok {
		t.Fatal("expected split to succeed")
	}
	if out.Group != gvr.Group || out.Resource != gvr.Resource {
		t.Fatalf("got %+v, want %+v", out, gvr)
	}
}

func TestSplitCRChangeKindRejectsNonCR(t *testing.T) {
	if _, ok := SplitCRChangeKind("Pod"); ok {
		t.Error("non-prefixed kind should not split")
	}
	if _, ok := SplitCRChangeKind("cr:no-slash"); ok {
		t.Error("missing slash should not split")
	}
}

func TestSplitCRChangeKindHandlesCoreGroup(t *testing.T) {
	// Core group is empty string; encoder writes "cr:/resource"
	gvr := schema.GroupVersionResource{Group: "", Resource: "things"}
	k := crChangeKind(gvr)
	out, ok := SplitCRChangeKind(k)
	if !ok || out.Group != "" || out.Resource != "things" {
		t.Fatalf("got %q → %+v ok=%v", k, out, ok)
	}
}

func TestCRDInfoFromUnstructured(t *testing.T) {
	t.Run("picks storage version with served=true", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{
				"group": "example.com",
				"scope": "Namespaced",
				"names": map[string]any{
					"kind":       "Widget",
					"plural":     "widgets",
					"singular":   "widget",
					"shortNames": []any{"wd"},
				},
				"versions": []any{
					map[string]any{"name": "v1alpha1", "served": true, "storage": false},
					map[string]any{"name": "v1", "served": true, "storage": true},
				},
			},
		}}
		info, ok := crdInfoFromUnstructured(obj)
		if !ok {
			t.Fatal("expected ok=true")
		}
		if info.Version != "v1" {
			t.Errorf("storage version: got %q, want v1", info.Version)
		}
		if info.Kind != "Widget" || info.Resource != "widgets" || info.Singular != "widget" {
			t.Errorf("names wrong: %+v", info)
		}
		if !slices.Equal(info.ShortNames, []string{"wd"}) {
			t.Errorf("short names: got %v", info.ShortNames)
		}
		if info.Scope != "Namespaced" {
			t.Errorf("scope: got %q", info.Scope)
		}
	})

	t.Run("falls back to first served when no storage", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{
				"group": "example.com",
				"names": map[string]any{"kind": "Widget", "plural": "widgets"},
				"versions": []any{
					map[string]any{"name": "v1beta1", "served": false, "storage": false},
					map[string]any{"name": "v1alpha1", "served": true, "storage": false},
				},
			},
		}}
		info, ok := crdInfoFromUnstructured(obj)
		if !ok || info.Version != "v1alpha1" {
			t.Fatalf("got %+v ok=%v", info, ok)
		}
	})

	t.Run("defaults missing scope to Namespaced", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{
				"group": "example.com",
				"names": map[string]any{"kind": "Widget", "plural": "widgets"},
				"versions": []any{
					map[string]any{"name": "v1", "served": true, "storage": true},
				},
			},
		}}
		info, ok := crdInfoFromUnstructured(obj)
		if !ok {
			t.Fatal("expected ok")
		}
		if info.Scope != "Namespaced" {
			t.Errorf("scope: got %q, want Namespaced", info.Scope)
		}
	})

	t.Run("rejects missing required fields", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{
				"names": map[string]any{"kind": "Widget", "plural": "widgets"},
				"versions": []any{
					map[string]any{"name": "v1", "served": true, "storage": true},
				},
			},
		}}
		if _, ok := crdInfoFromUnstructured(obj); ok {
			t.Error("missing group should produce ok=false")
		}
	})

	t.Run("rejects when no served version exists", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{
				"group": "example.com",
				"names": map[string]any{"kind": "Widget", "plural": "widgets"},
				"versions": []any{
					map[string]any{"name": "v1", "served": false, "storage": false},
				},
			},
		}}
		if _, ok := crdInfoFromUnstructured(obj); ok {
			t.Error("no served version should produce ok=false")
		}
	})
}

func TestParsePrinterColumns(t *testing.T) {
	t.Run("returns empty slice for nil version entry", func(t *testing.T) {
		got := parsePrinterColumns(nil)
		if got == nil || len(got) != 0 {
			t.Fatalf("got %v, want empty slice", got)
		}
	})

	t.Run("extracts columns and drops Age", func(t *testing.T) {
		entry := map[string]any{
			"additionalPrinterColumns": []any{
				map[string]any{"name": "Sync", "type": "string", "jsonPath": ".status.sync.status"},
				map[string]any{"name": "Age", "type": "date", "jsonPath": ".metadata.creationTimestamp"},
				map[string]any{"name": "AGE", "type": "date", "jsonPath": ".meta"}, // also dropped, case-insensitive
				map[string]any{"name": "Health", "type": "string", "jsonPath": ".status.health.status"},
			},
		}
		got := parsePrinterColumns(entry)
		if len(got) != 2 {
			t.Fatalf("got %d cols, want 2", len(got))
		}
		if got[0].Name != "Sync" || got[1].Name != "Health" {
			t.Errorf("got %+v", got)
		}
	})

	t.Run("skips entries with empty name or path", func(t *testing.T) {
		entry := map[string]any{
			"additionalPrinterColumns": []any{
				map[string]any{"name": "", "jsonPath": ".x"},
				map[string]any{"name": "X", "jsonPath": ""},
				map[string]any{"name": "Ok", "jsonPath": ".x"},
			},
		}
		got := parsePrinterColumns(entry)
		if len(got) != 1 || got[0].Name != "Ok" {
			t.Errorf("got %+v", got)
		}
	})

	t.Run("returns empty slice when only Age column present", func(t *testing.T) {
		entry := map[string]any{
			"additionalPrinterColumns": []any{
				map[string]any{"name": "Age", "type": "date", "jsonPath": ".meta"},
			},
		}
		got := parsePrinterColumns(entry)
		if got == nil || len(got) != 0 {
			t.Errorf("got %v, want empty slice", got)
		}
	})
}

func TestEvaluateCells(t *testing.T) {
	cols := []PrinterColumn{
		{Name: "Sync", JSONPath: ".status.sync.status"},
		{Name: "Missing", JSONPath: ".status.nope"},
	}
	evaluators := compileJSONPaths(cols)
	if len(evaluators) != 2 {
		t.Fatalf("expected 2 compiled, got %d", len(evaluators))
	}
	obj := &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{
			"sync": map[string]any{"status": "Synced"},
		},
	}}
	got := evaluateCells(evaluators, obj)
	if got["Sync"] != "Synced" {
		t.Errorf("Sync: got %q", got["Sync"])
	}
	if got["Missing"] != "" {
		t.Errorf("Missing should be empty, got %q", got["Missing"])
	}
}

func TestCompileJSONPathsHandlesBadExpressions(t *testing.T) {
	cols := []PrinterColumn{
		{Name: "Bad", JSONPath: "{this is broken"},
		{Name: "Ok", JSONPath: ".metadata.name"},
	}
	got := compileJSONPaths(cols)
	if len(got) != 1 || got[0].name != "Ok" {
		t.Errorf("bad jsonPath should be dropped, got %+v", got)
	}
}
