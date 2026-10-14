package kube

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/dynamicinformer"
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

// startFakeCRWatch stands in for EnsureCRWatch on the fake context: it marks
// gvr's informer as started, as the frontend does at the discovered CRD
// version, and seeds its cache with objs without touching the API.
func startFakeCRWatch(t *testing.T, m *ClientManager, gvr schema.GroupVersionResource, objs ...*unstructured.Unstructured) {
	t.Helper()
	w := m.watchers["ctx"].crd
	if w.crFactory == nil {
		w.crFactory = dynamicinformer.NewDynamicSharedInformerFactory(w.dyn, 0)
	}
	if w.crWatches == nil {
		w.crWatches = map[schema.GroupVersionResource]bool{}
	}
	w.crWatches[gvr] = true
	indexer := w.crFactory.ForResource(gvr).Informer().GetIndexer()
	for _, obj := range objs {
		if err := indexer.Add(obj); err != nil {
			t.Fatal(err)
		}
	}
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
