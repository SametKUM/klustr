package kube

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
	"sigs.k8s.io/yaml"
)

var crdGVR = schema.GroupVersionResource{
	Group:    "apiextensions.k8s.io",
	Version:  "v1",
	Resource: "customresourcedefinitions",
}

const (
	crdsChangeKind = "_crds"
	crChangePrefix = "cr:"
)

// CRDInfo describes a CustomResourceDefinition surfaced to the frontend so it can
// render a sidebar entry and start watching CR instances.
type CRDInfo struct {
	Kind       string   `json:"kind"`
	Group      string   `json:"group"`
	Version    string   `json:"version"`
	Resource   string   `json:"resource"`
	Singular   string   `json:"singular"`
	ShortNames []string `json:"shortNames"`
	Scope      string   `json:"scope"`
	CreatedAt  string   `json:"createdAt"`
}

// Namespaced reports whether instances of this CRD live in a namespace.
func (c CRDInfo) Namespaced() bool { return c.Scope == "Namespaced" }

// GVR is the canonical GroupVersionResource for this CRD's storage version.
func (c CRDInfo) GVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{Group: c.Group, Version: c.Version, Resource: c.Resource}
}

// CustomResourceInfo is the row shape for the generic CR list view.
type CustomResourceInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	CreatedAt string `json:"createdAt"`
}

func crChangeKind(gvr schema.GroupVersionResource) string {
	return crChangePrefix + gvr.Group + "/" + gvr.Resource
}

// crdWatcher owns CRD discovery and the on-demand dynamic informers for CR
// instances. It is created once per context and torn down when that context
// stops being watched.
type crdWatcher struct {
	dyn     dynamic.Interface
	factory dynamicinformer.DynamicSharedInformerFactory
	stopCh  <-chan struct{}
	onTouch func(kind string)

	mu       sync.Mutex
	informer cache.SharedIndexInformer
	started  bool

	crMu       sync.Mutex
	crFactory  dynamicinformer.DynamicSharedInformerFactory
	crWatches  map[schema.GroupVersionResource]bool
	crSynced   map[schema.GroupVersionResource]chan struct{}
}

func newCRDWatcher(dyn dynamic.Interface, stopCh <-chan struct{}, onTouch func(kind string)) *crdWatcher {
	return &crdWatcher{
		dyn:       dyn,
		factory:   dynamicinformer.NewDynamicSharedInformerFactory(dyn, 0),
		stopCh:    stopCh,
		onTouch:   onTouch,
		crFactory: dynamicinformer.NewDynamicSharedInformerFactory(dyn, 0),
		crWatches: make(map[schema.GroupVersionResource]bool),
		crSynced:  make(map[schema.GroupVersionResource]chan struct{}),
	}
}

func (w *crdWatcher) start() error {
	informer := w.factory.ForResource(crdGVR).Informer()
	if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.onTouch(crdsChangeKind) },
		UpdateFunc: func(any, any) { w.onTouch(crdsChangeKind) },
		DeleteFunc: func(any) { w.onTouch(crdsChangeKind) },
	}); err != nil {
		return err
	}
	w.mu.Lock()
	w.informer = informer
	w.started = true
	w.mu.Unlock()

	w.factory.Start(w.stopCh)
	go func() {
		w.factory.WaitForCacheSync(w.stopCh)
		w.onTouch(crdsChangeKind)
	}()
	return nil
}

// CRDs returns the current set of CRDs known to this context's cache.
func (w *crdWatcher) CRDs() []CRDInfo {
	w.mu.Lock()
	inf := w.informer
	w.mu.Unlock()
	if inf == nil {
		return []CRDInfo{}
	}
	objs := inf.GetStore().List()
	out := make([]CRDInfo, 0, len(objs))
	for _, raw := range objs {
		obj, ok := raw.(*unstructured.Unstructured)
		if !ok {
			continue
		}
		info, ok := crdInfoFromUnstructured(obj)
		if !ok {
			continue
		}
		out = append(out, info)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Group != out[j].Group {
			return out[i].Group < out[j].Group
		}
		return out[i].Kind < out[j].Kind
	})
	return out
}

func crdInfoFromUnstructured(obj *unstructured.Unstructured) (CRDInfo, bool) {
	group, _, _ := unstructured.NestedString(obj.Object, "spec", "group")
	scope, _, _ := unstructured.NestedString(obj.Object, "spec", "scope")
	kind, _, _ := unstructured.NestedString(obj.Object, "spec", "names", "kind")
	plural, _, _ := unstructured.NestedString(obj.Object, "spec", "names", "plural")
	singular, _, _ := unstructured.NestedString(obj.Object, "spec", "names", "singular")
	shortNamesRaw, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "names", "shortNames")
	if kind == "" || plural == "" || group == "" {
		return CRDInfo{}, false
	}

	versions, _, _ := unstructured.NestedSlice(obj.Object, "spec", "versions")
	storageVersion := ""
	for _, v := range versions {
		m, ok := v.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		served, _ := m["served"].(bool)
		storage, _ := m["storage"].(bool)
		if storage && served {
			storageVersion = name
			break
		}
	}
	if storageVersion == "" {
		// fall back to the first served version
		for _, v := range versions {
			m, ok := v.(map[string]any)
			if !ok {
				continue
			}
			name, _ := m["name"].(string)
			served, _ := m["served"].(bool)
			if served && name != "" {
				storageVersion = name
				break
			}
		}
	}
	if storageVersion == "" {
		return CRDInfo{}, false
	}

	if scope == "" {
		scope = "Namespaced"
	}
	created := obj.GetCreationTimestamp().UTC().Format(time.RFC3339)
	return CRDInfo{
		Kind:       kind,
		Group:      group,
		Version:    storageVersion,
		Resource:   plural,
		Singular:   singular,
		ShortNames: append([]string{}, shortNamesRaw...),
		Scope:      scope,
		CreatedAt:  created,
	}, true
}

// LookupCRDByKind returns the CRDInfo whose Kind matches. When multiple CRDs
// share a Kind (rare — different groups), the first sorted match is returned.
func (w *crdWatcher) LookupCRDByKind(kind string) (CRDInfo, bool) {
	for _, c := range w.CRDs() {
		if c.Kind == kind {
			return c, true
		}
	}
	return CRDInfo{}, false
}

// LookupCRDByGVK matches a CRD by its apiVersion+kind, as parsed from YAML.
func (w *crdWatcher) LookupCRDByGVK(gvk schema.GroupVersionKind) (CRDInfo, bool) {
	for _, c := range w.CRDs() {
		if c.Group == gvk.Group && c.Kind == gvk.Kind {
			return c, true
		}
	}
	return CRDInfo{}, false
}

// EnsureCRWatch starts a dynamic informer for the given GVR if not already
// running, and waits up to ~5s for the cache to sync so the caller can List
// immediately after.
func (w *crdWatcher) EnsureCRWatch(gvr schema.GroupVersionResource) error {
	w.crMu.Lock()
	if w.crWatches[gvr] {
		ch := w.crSynced[gvr]
		w.crMu.Unlock()
		<-ch
		return nil
	}

	informer := w.crFactory.ForResource(gvr).Informer()
	if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.onTouch(crChangeKind(gvr)) },
		UpdateFunc: func(any, any) { w.onTouch(crChangeKind(gvr)) },
		DeleteFunc: func(any) { w.onTouch(crChangeKind(gvr)) },
	}); err != nil {
		w.crMu.Unlock()
		return err
	}
	synced := make(chan struct{})
	w.crWatches[gvr] = true
	w.crSynced[gvr] = synced
	w.crMu.Unlock()

	w.crFactory.Start(w.stopCh)
	go func() {
		if cache.WaitForCacheSync(w.stopCh, informer.HasSynced) {
			w.onTouch(crChangeKind(gvr))
		}
		close(synced)
	}()
	// Wait until synced (or stopCh fires).
	select {
	case <-synced:
	case <-w.stopCh:
		return fmt.Errorf("context watch stopped")
	}
	return nil
}

// ListCustomResources reads the cached CR list for the given GVR. If the
// informer for this GVR has not been started yet, it returns an empty slice —
// callers should call EnsureCRWatch first.
func (w *crdWatcher) ListCustomResources(gvr schema.GroupVersionResource, namespace string) []CustomResourceInfo {
	w.crMu.Lock()
	started := w.crWatches[gvr]
	w.crMu.Unlock()
	if !started {
		return []CustomResourceInfo{}
	}
	lister := w.crFactory.ForResource(gvr).Lister()
	var objs []runtime.Object
	var err error
	if namespace == "" {
		objs, err = lister.List(labels.Everything())
	} else {
		objs, err = lister.ByNamespace(namespace).List(labels.Everything())
	}
	if err != nil {
		return []CustomResourceInfo{}
	}
	out := make([]CustomResourceInfo, 0, len(objs))
	for _, raw := range objs {
		obj, ok := raw.(*unstructured.Unstructured)
		if !ok {
			continue
		}
		out = append(out, CustomResourceInfo{
			Name:      obj.GetName(),
			Namespace: obj.GetNamespace(),
			CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// GetCustomResource fetches a single CR through the dynamic client so the YAML
// tab always sees the latest server state, even before the informer has synced.
func (w *crdWatcher) GetCustomResource(ctx context.Context, gvr schema.GroupVersionResource, namespace, name string) (*unstructured.Unstructured, error) {
	var ri dynamic.ResourceInterface
	if namespace == "" {
		ri = w.dyn.Resource(gvr)
	} else {
		ri = w.dyn.Resource(gvr).Namespace(namespace)
	}
	return ri.Get(ctx, name, metav1.GetOptions{})
}

// MarshalCustomResourceYAML strips the noisy server-managed metadata fields
// the same way the built-in YAML path does and returns the YAML rendering.
func MarshalCustomResourceYAML(obj *unstructured.Unstructured) (string, error) {
	sanitizeForYAML(obj)
	data, err := yaml.Marshal(obj.Object)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// SplitCRChangeKind parses a change kind string (e.g. "cr:argoproj.io/applications")
// back into a GVR. Returns false when the kind is not a CR change.
func SplitCRChangeKind(kind string) (schema.GroupVersionResource, bool) {
	if !strings.HasPrefix(kind, crChangePrefix) {
		return schema.GroupVersionResource{}, false
	}
	rest := strings.TrimPrefix(kind, crChangePrefix)
	slash := strings.LastIndex(rest, "/")
	if slash < 0 {
		return schema.GroupVersionResource{}, false
	}
	return schema.GroupVersionResource{Group: rest[:slash], Resource: rest[slash+1:]}, true
}
