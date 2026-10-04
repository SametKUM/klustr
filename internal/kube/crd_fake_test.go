package kube

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/tools/cache"
	"sigs.k8s.io/yaml"
)

// fakeCRD describes a CRD the fake context serves at its storage version.
type fakeCRD struct {
	gvr        schema.GroupVersionResource
	kind       string
	namespaced bool
}

// fakeCRDManager wires a ClientManager whose context "ctx" discovers crds and
// talks to a fake dynamic client holding objs. Lists of the CRD kinds work;
// GETs of built-in objects work through the object tracker.
func fakeCRDManager(t *testing.T, crds []fakeCRD, objs ...runtime.Object) (*ClientManager, *dynamicfake.FakeDynamicClient) {
	t.Helper()
	crdInformer := cache.NewSharedIndexInformer(&cache.ListWatch{}, &unstructured.Unstructured{}, 0, cache.Indexers{})
	listKinds := map[schema.GroupVersionResource]string{}
	for _, c := range crds {
		scope := "Cluster"
		if c.namespaced {
			scope = "Namespaced"
		}
		crd := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "apiextensions.k8s.io/v1",
			"kind":       "CustomResourceDefinition",
			"metadata":   map[string]any{"name": c.gvr.Resource + "." + c.gvr.Group},
			"spec": map[string]any{
				"group": c.gvr.Group,
				"scope": scope,
				"names": map[string]any{"kind": c.kind, "plural": c.gvr.Resource},
				"versions": []any{
					map[string]any{"name": c.gvr.Version, "served": true, "storage": true},
				},
			},
		}}
		if err := crdInformer.GetStore().Add(crd); err != nil {
			t.Fatal(err)
		}
		listKinds[c.gvr] = c.kind + "List"
	}
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), listKinds, objs...)
	m := &ClientManager{watchers: map[string]*contextWatcher{
		"ctx": {dyn: dyn, crd: &crdWatcher{dyn: dyn, informer: crdInformer}},
	}}
	return m, dyn
}

// mustUnstructured parses a YAML manifest into an unstructured object.
func mustUnstructured(t *testing.T, manifest string) *unstructured.Unstructured {
	t.Helper()
	obj := map[string]any{}
	if err := yaml.Unmarshal([]byte(manifest), &obj); err != nil {
		t.Fatal(err)
	}
	return &unstructured.Unstructured{Object: obj}
}
