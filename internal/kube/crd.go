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
	// crdCache memoizes the decoded + sorted CRD list (nil = stale). Every
	// LookupCRDBy* and CRDs() call would otherwise reflectively decode and sort
	// the entire CRD store; the CRD informer's handlers invalidate it on change.
	crdCache []CRDInfo
	// crCellCache memoizes the compiled printer-column JSONPath evaluators per
	// GVR (guarded by mu, invalidated with crdCache on any CRD change). The
	// evaluators depend only on the CRD's columns, so recompiling them on every
	// CR list refresh — the per-change-event hot path — is pure waste.
	crCellCache map[schema.GroupVersionResource][]compiledPrinterColumn

	// crCellMu serializes use of a cached evaluator slice: jsonpath.JSONPath
	// mutates internal range-tracking state during Execute, so a shared
	// (cached) evaluator must never be run from two goroutines at once.
	crCellMu sync.Mutex

	crMu      sync.Mutex
	crFactory dynamicinformer.DynamicSharedInformerFactory
	crWatches map[schema.GroupVersionResource]bool
	crSynced  map[schema.GroupVersionResource]chan struct{}

	// canWatch gates EnsureCRWatch on list access to the CR instances. A user
	// can often list CRDs but not a CRD's instances; starting an informer
	// anyway leaves client-go retrying the forbidden LIST for the life of the
	// connection (a shared-factory informer can't be stopped individually).
	canWatch func(gvr schema.GroupVersionResource) bool
}

func newCRDWatcher(dyn dynamic.Interface, stopCh <-chan struct{}, onTouch func(kind string), canWatch func(gvr schema.GroupVersionResource) bool) *crdWatcher {
	return &crdWatcher{
		dyn:       dyn,
		factory:   dynamicinformer.NewDynamicSharedInformerFactory(dyn, 0),
		stopCh:    stopCh,
		onTouch:   onTouch,
		crFactory: dynamicinformer.NewDynamicSharedInformerFactory(dyn, 0),
		crWatches: make(map[schema.GroupVersionResource]bool),
		crSynced:  make(map[schema.GroupVersionResource]chan struct{}),
		canWatch:  canWatch,
	}
}

func (w *crdWatcher) start() error {
	informer := w.factory.ForResource(crdGVR).Informer()
	// Strip managedFields before objects enter the cache, matching the typed
	// factories — nothing reads it and CRD/CR objects carry large managedFields.
	if err := informer.SetTransform(stripManagedFields); err != nil {
		return err
	}
	if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.invalidateCRDCache(); w.onTouch(crdsChangeKind) },
		UpdateFunc: func(any, any) { w.invalidateCRDCache(); w.onTouch(crdsChangeKind) },
		DeleteFunc: func(any) { w.invalidateCRDCache(); w.onTouch(crdsChangeKind) },
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

// CRDs returns the current set of CRDs known to this context's cache. The
// decoded + sorted result is memoized; the informer handlers invalidate it.
func (w *crdWatcher) CRDs() []CRDInfo {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.crdCache != nil {
		return w.crdCache
	}
	inf := w.informer
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
	w.crdCache = out
	return out
}

// invalidateCRDCache drops the memoized CRD list and the compiled printer-column
// evaluators so the next CRDs() / ListCustomResources rebuilds them.
func (w *crdWatcher) invalidateCRDCache() {
	w.mu.Lock()
	w.crdCache = nil
	w.crCellCache = nil
	w.mu.Unlock()
}

// compiledColumns returns the cached printer-column evaluators for a GVR,
// compiling and memoizing them on first use. The compile (LookupCRDByGVR takes
// mu internally) runs outside the lock, so a concurrent miss may compile twice
// — harmless and idempotent, the last store wins. Callers must hold crCellMu
// while running the returned evaluators (see the field comment).
func (w *crdWatcher) compiledColumns(gvr schema.GroupVersionResource) []compiledPrinterColumn {
	w.mu.Lock()
	if w.crCellCache != nil {
		if cols, ok := w.crCellCache[gvr]; ok {
			w.mu.Unlock()
			return cols
		}
	}
	w.mu.Unlock()

	var printerColumns []PrinterColumn
	if info, found := w.LookupCRDByGVR(gvr); found {
		printerColumns = info.PrinterColumns
	}
	compiled := compileJSONPaths(printerColumns)

	w.mu.Lock()
	if w.crCellCache == nil {
		w.crCellCache = make(map[schema.GroupVersionResource][]compiledPrinterColumn)
	}
	w.crCellCache[gvr] = compiled
	w.mu.Unlock()
	return compiled
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
	out := []PrinterColumn{}
	if versionEntry == nil {
		return out
	}
	raw, ok := versionEntry["additionalPrinterColumns"].([]any)
	if !ok || len(raw) == 0 {
		return out
	}
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

// HasCRD reports whether a CRD for the given group/resource is present via a
// cheap indexer key lookup. CRDs are named "<plural>.<group>" and cluster-
// scoped, so the store key is exactly that. Use this instead of
// LookupCRDByGVR in poll/warm-up loops, which would otherwise re-decode and
// sort the entire CRD set on every tick just to check for one CRD.
func (w *crdWatcher) HasCRD(gvr schema.GroupVersionResource) bool {
	if w.factory == nil {
		return false
	}
	_, exists, err := w.factory.ForResource(crdGVR).Informer().GetStore().GetByKey(gvr.Resource + "." + gvr.Group)
	return err == nil && exists
}

const crSyncTimeout = 5 * time.Second

// EnsureCRWatch starts a dynamic informer for the given GVR if not already
// running, and waits up to ~5s for the cache to sync so the caller can List
// immediately after. The timeout matters: a CR informer can be unable to
// ever sync (no CR-list RBAC even though CRD-list succeeded, a broken
// conversion webhook) and without it the call would hang until disconnect.
func (w *crdWatcher) EnsureCRWatch(gvr schema.GroupVersionResource) error {
	timeout := time.NewTimer(crSyncTimeout)
	defer timeout.Stop()

	w.crMu.Lock()
	synced, started := w.crSynced[gvr]
	w.crMu.Unlock()

	if !started {
		// Probe before starting: an informer denied list/watch on the CR
		// instances would retry the forbidden LIST until disconnect. Probing
		// outside the lock keeps the SSAR round-trip off the fast path;
		// nothing is registered on denial, so a later RBAC grant works on
		// the next navigation.
		if w.canWatch != nil && !w.canWatch(gvr) {
			return fmt.Errorf("no permission to list %s", gvr.Resource)
		}

		w.crMu.Lock()
		if ch, ok := w.crSynced[gvr]; ok {
			synced = ch
			w.crMu.Unlock()
		} else {
			informer := w.crFactory.ForResource(gvr).Informer()
			if err := informer.SetTransform(stripManagedFields); err != nil {
				w.crMu.Unlock()
				return err
			}
			if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
				AddFunc:    func(any) { w.onTouch(crChangeKind(gvr)) },
				UpdateFunc: func(any, any) { w.onTouch(crChangeKind(gvr)) },
				DeleteFunc: func(any) { w.onTouch(crChangeKind(gvr)) },
			}); err != nil {
				w.crMu.Unlock()
				return err
			}
			synced = make(chan struct{})
			w.crWatches[gvr] = true
			w.crSynced[gvr] = synced
			w.crMu.Unlock()

			w.crFactory.Start(w.stopCh)
			ch := synced
			go func() {
				// WaitForCacheSync fails only when stopCh closes; leaving ch
				// open then keeps waiters from mistaking teardown for a sync.
				if cache.WaitForCacheSync(w.stopCh, informer.HasSynced) {
					w.onTouch(crChangeKind(gvr))
					close(ch)
				}
			}()
		}
	}

	select {
	case <-synced:
		return nil
	case <-timeout.C:
		return fmt.Errorf("timed out waiting for %s cache sync", gvr.Resource)
	case <-w.stopCh:
		return fmt.Errorf("context watch stopped")
	}
}

// listCachedCRs reads the cached objects for a CRD GVR from the dynamic
// informer, returning them as *unstructured.Unstructured. It returns nil when
// the context has no watcher, the CRD watcher is absent, or the GVR's informer
// has not been started yet (callers EnsureCRWatch first). A namespace of ""
// lists across all namespaces.
func listCachedCRs(m *ClientManager, contextName string, gvr schema.GroupVersionResource, namespace string) []*unstructured.Unstructured {
	w, ok := m.watcher(contextName)
	if !ok || w.crd == nil {
		return nil
	}
	w.crd.crMu.Lock()
	started := w.crd.crWatches[gvr]
	w.crd.crMu.Unlock()
	if !started {
		return nil
	}
	lister := w.crd.crFactory.ForResource(gvr).Lister()
	raw, err := listFromGenericLister(lister, namespace)
	if err != nil {
		return nil
	}
	out := make([]*unstructured.Unstructured, 0, len(raw))
	for _, r := range raw {
		if u, ok := r.(*unstructured.Unstructured); ok {
			out = append(out, u)
		}
	}
	return out
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
	objs, err := listFromGenericLister(lister, namespace)
	if err != nil {
		return []CustomResourceInfo{}
	}
	evaluators := w.compiledColumns(gvr)
	out := make([]CustomResourceInfo, 0, len(objs))
	w.crCellMu.Lock()
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
	w.crCellMu.Unlock()
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

// GetCachedCustomResource returns the cached CR for the given GVR + ns + name
// without ever touching the server. Used by enrichment paths (e.g. KEDA HPA
// targets) where blocking the caller on a network round-trip would be wrong.
// Returns (nil, false) when the informer hasn't been started for this GVR
// (caller should have called EnsureCRWatch first) or the object isn't cached.
func (w *crdWatcher) GetCachedCustomResource(gvr schema.GroupVersionResource, namespace, name string) (*unstructured.Unstructured, bool) {
	w.crMu.Lock()
	started := w.crWatches[gvr]
	w.crMu.Unlock()
	if !started {
		return nil, false
	}
	lister := w.crFactory.ForResource(gvr).Lister()
	var (
		raw runtime.Object
		err error
	)
	if namespace == "" {
		raw, err = lister.Get(name)
	} else {
		raw, err = lister.ByNamespace(namespace).Get(name)
	}
	if err != nil || raw == nil {
		return nil, false
	}
	obj, ok := raw.(*unstructured.Unstructured)
	if !ok {
		return nil, false
	}
	return obj, true
}

// AddCRHandler attaches an extra event handler to the dynamic informer for
// the given GVR. dynamicSharedInformerFactory caches one informer per GVR so
// calling this after EnsureCRWatch reuses the same informer; client-go
// backfills the new handler with the current cache contents.
func (w *crdWatcher) AddCRHandler(gvr schema.GroupVersionResource, handler cache.ResourceEventHandler) error {
	inf := w.crFactory.ForResource(gvr).Informer()
	_, err := inf.AddEventHandler(handler)
	return err
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

// getCROrLive returns the CR for the given GVR preferring the warm informer
// cache, falling back to a live GET only when this GVR's informer has not been
// started yet. Integration detail builders read only fields the list path
// already caches, so the cache hit avoids both a fresh dynamic-client build and
// an apiserver round-trip on every detail open. Unlike GetCustomResource (the
// YAML tab, which always wants live server state), the cache is fresh enough
// here — the watch keeps it within a debounce window of the server.
func (w *crdWatcher) getCROrLive(ctx context.Context, gvr schema.GroupVersionResource, namespace, name string) (*unstructured.Unstructured, error) {
	if obj, found := w.GetCachedCustomResource(gvr, namespace, name); found {
		return obj, nil
	}
	return w.GetCustomResource(ctx, gvr, namespace, name)
}

// crForDetail fetches a CR for a detail builder, cache-first via the context's
// crdWatcher, and only builds a fresh dynamic client + does a live GET when no
// watcher exists for the context (which a detail path normally never hits).
func (m *ClientManager) crForDetail(ctx context.Context, contextName string, gvr schema.GroupVersionResource, namespace, name string) (*unstructured.Unstructured, error) {
	if w, ok := m.watcher(contextName); ok && w.crd != nil {
		return w.crd.getCROrLive(ctx, gvr, namespace, name)
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	return resourceFor(dyn, gvr, namespace).Get(ctx, name, metav1.GetOptions{})
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
