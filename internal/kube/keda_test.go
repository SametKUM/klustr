package kube

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

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
