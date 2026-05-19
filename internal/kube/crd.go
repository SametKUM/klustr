package kube

import (
	"bytes"
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
	"k8s.io/client-go/util/jsonpath"
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
	Kind           string          `json:"kind"`
	Group          string          `json:"group"`
	Version        string          `json:"version"`
	Resource       string          `json:"resource"`
	Singular       string          `json:"singular"`
	ShortNames     []string        `json:"shortNames"`
	Scope          string          `json:"scope"`
	CreatedAt      string          `json:"createdAt"`
	PrinterColumns []PrinterColumn `json:"printerColumns"`
}

// PrinterColumn mirrors the relevant fields of CRD additionalPrinterColumns so
// the UI can render arbitrary type-specific columns (e.g. Argo's Sync/Health,
// cert-manager's Ready/Secret/Issuer) without baking per-CRD knowledge into
// Klustr.
type PrinterColumn struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	JSONPath string `json:"jsonPath"`
}

// Namespaced reports whether instances of this CRD live in a namespace.
func (c CRDInfo) Namespaced() bool { return c.Scope == "Namespaced" }

// GVR is the canonical GroupVersionResource for this CRD's storage version.
func (c CRDInfo) GVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{Group: c.Group, Version: c.Version, Resource: c.Resource}
}

// CustomResourceInfo is the row shape for the generic CR list view.
// Cells carries the rendered string for each PrinterColumn the CRD declares,
// keyed by column name. Empty when the CRD has no additionalPrinterColumns.
type CustomResourceInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	CreatedAt string            `json:"createdAt"`
	Cells     map[string]string `json:"cells"`
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
	var storageVersionEntry map[string]any
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
			storageVersionEntry = m
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
				storageVersionEntry = m
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
		Kind:           kind,
		Group:          group,
		Version:        storageVersion,
		Resource:       plural,
		Singular:       singular,
		ShortNames:     append([]string{}, shortNamesRaw...),
		Scope:          scope,
		CreatedAt:      created,
		PrinterColumns: parsePrinterColumns(storageVersionEntry),
	}, true
}

// parsePrinterColumns extracts additionalPrinterColumns from a CRD version
// entry, skipping the "Age" column since the generic list view always renders
// age from .metadata.creationTimestamp regardless.
func parsePrinterColumns(versionEntry map[string]any) []PrinterColumn {
	if versionEntry == nil {
		return nil
	}
	raw, ok := versionEntry["additionalPrinterColumns"].([]any)
	if !ok || len(raw) == 0 {
		return nil
	}
	out := make([]PrinterColumn, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		typ, _ := m["type"].(string)
		path, _ := m["jsonPath"].(string)
		if name == "" || path == "" {
			continue
		}
		if strings.EqualFold(name, "Age") {
			continue
		}
		out = append(out, PrinterColumn{Name: name, Type: typ, JSONPath: path})
	}
	if len(out) == 0 {
		return nil
	}
	return out
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

// LookupCRDByGVR finds a CRD by its group/resource pair (version is taken from
// the stored CRD info, which always reports the served storage version).
func (w *crdWatcher) LookupCRDByGVR(gvr schema.GroupVersionResource) (CRDInfo, bool) {
	for _, c := range w.CRDs() {
		if c.Group == gvr.Group && c.Resource == gvr.Resource {
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
//
// When the CRD declares additionalPrinterColumns, each row's Cells map is
// populated by evaluating those JSONPath expressions against the CR so the
// frontend can render type-specific columns (Sync / Health / Ready / …)
// without needing per-CRD knowledge in Klustr.
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
	var printerColumns []PrinterColumn
	if info, found := w.LookupCRDByGVR(gvr); found {
		printerColumns = info.PrinterColumns
	}
	evaluators := compileJSONPaths(printerColumns)
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
			Cells:     evaluateCells(evaluators, obj),
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

type compiledPrinterColumn struct {
	name string
	jp   *jsonpath.JSONPath
}

func compileJSONPaths(columns []PrinterColumn) []compiledPrinterColumn {
	if len(columns) == 0 {
		return nil
	}
	out := make([]compiledPrinterColumn, 0, len(columns))
	for _, c := range columns {
		jp := jsonpath.New(c.Name).AllowMissingKeys(true)
		// CRD jsonPath is unwrapped (e.g. ".status.sync.status"); the JSONPath
		// parser expects template-style braces, so wrap before parsing.
		if err := jp.Parse("{" + c.JSONPath + "}"); err != nil {
			continue
		}
		out = append(out, compiledPrinterColumn{name: c.Name, jp: jp})
	}
	return out
}

func evaluateCells(evaluators []compiledPrinterColumn, obj *unstructured.Unstructured) map[string]string {
	if len(evaluators) == 0 {
		return nil
	}
	out := make(map[string]string, len(evaluators))
	for _, e := range evaluators {
		var buf bytes.Buffer
		if err := e.jp.Execute(&buf, obj.Object); err != nil {
			out[e.name] = ""
			continue
		}
		out[e.name] = strings.TrimSpace(buf.String())
	}
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
