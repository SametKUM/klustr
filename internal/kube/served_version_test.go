package kube

import (
	"context"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestArgoSyncPatchesTheServedVersion(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "argoproj.io", Version: "v1beta1", Resource: "applications"}
	app := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "argoproj.io/v1beta1",
		"kind":       "Application",
		"metadata":   map[string]any{"name": "web", "namespace": "argocd"},
	}}
	m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "Application", namespaced: true}}, app)
	if err := m.SyncArgoApplication(context.Background(), "ctx", "argocd", "web", ArgoSyncOptions{}); err != nil {
		t.Fatal(err)
	}
	got, err := dyn.Resource(gvr).Namespace("argocd").Get(context.Background(), "web", metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if _, found, _ := unstructured.NestedMap(got.Object, "operation", "sync"); !found {
		t.Fatal("sync did not patch the served version")
	}
}

func TestScaledObjectLookupUsesTheStartedVersion(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "keda.sh", Version: "v1beta1", Resource: "scaledobjects"}
	so := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "keda.sh/v1beta1",
		"kind":       "ScaledObject",
		"metadata":   map[string]any{"name": "worker", "namespace": "apps"},
	}}
	m, _ := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "ScaledObject", namespaced: true}})
	startFakeCRWatch(t, m, gvr, so)
	if _, ok := m.watchers["ctx"].scaledObjectByName("apps", "worker"); !ok {
		t.Fatal("ScaledObject cached at the started version was not found")
	}
}
