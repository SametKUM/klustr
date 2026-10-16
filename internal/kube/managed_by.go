package kube

import (
	"context"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/metadata"
)

// Labels and annotations Helm, Argo CD and Flux stamp on every object they
// apply. They are the only ownership record: none of these tools sets an
// ownerReference on what it deploys.
const (
	helmReleaseNameAnnotation      = "meta.helm.sh/release-name"
	helmReleaseNamespaceAnnotation = "meta.helm.sh/release-namespace"

	// argoTrackingIDAnnotation is Argo CD's annotation tracking, the default
	// since 3.0: "<app>:<group>/<kind>:<namespace>/<name>", where <app> is
	// "<namespace>_<name>" for an Application outside Argo CD's own namespace.
	argoTrackingIDAnnotation = "argocd.argoproj.io/tracking-id"
	// argoInstanceLabel is label tracking, the default before 3.0. Helm charts
	// set the same label to the release name, so it only counts when the
	// Application lists the object among its resources.
	argoInstanceLabel = "app.kubernetes.io/instance"

	fluxKustomizationNameLabel      = "kustomize.toolkit.fluxcd.io/name"
	fluxKustomizationNamespaceLabel = "kustomize.toolkit.fluxcd.io/namespace"
	fluxHelmReleaseNameLabel        = "helm.toolkit.fluxcd.io/name"
	fluxHelmReleaseNamespaceLabel   = "helm.toolkit.fluxcd.io/namespace"
	// The reconcile annotation set to "disabled" and the ssa annotation set to
	// "IfNotPresent" or "Ignore" make kustomize-controller leave an object's
	// live state alone.
	fluxKustomizeReconcileAnnotation = "kustomize.toolkit.fluxcd.io/reconcile"
	fluxKustomizeSSAAnnotation       = "kustomize.toolkit.fluxcd.io/ssa"
)

// argoLookupTimeout bounds each Application lookup in another context, so a
// slow or unreachable cluster cannot hold the detail header.
const argoLookupTimeout = 5 * time.Second

// ResourceManager is a tool that owns a resource: the Helm release, Argo CD
// Application or Flux object it was deployed through.
type ResourceManager struct {
	// Tool is "helm", "argocd" or "flux".
	Tool string `json:"tool"`
	// Kind is the owner's kind: HelmRelease (a Helm release, or Flux's
	// HelmRelease CR), Application or Kustomization.
	Kind string `json:"kind"`
	// Group and Resource address the owner CR; both are "" for a Helm release.
	Group    string `json:"group"`
	Resource string `json:"resource"`
	// Context is where the owner lives. An Argo CD Application often runs in
	// a different cluster than the resources it deploys.
	Context   string `json:"context"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	// Resolved reports that the owner can be opened: the Application was
	// found, or the Flux CRD is served. An unresolved owner is shown by name.
	Resolved  bool `json:"resolved"`
	Suspended bool `json:"suspended"`
	// RevertsDrift reports that the owner will undo a live edit to the fields
	// it manages, and RevertReason says why ("self-heal is on").
	RevertsDrift bool   `json:"revertsDrift"`
	RevertReason string `json:"revertReason"`
	// IgnoredFields are JSON pointers the owner leaves alone on this
	// resource, such as /spec/replicas under an HPA.
	IgnoredFields []string `json:"ignoredFields"`
}

// managedTarget is the resource whose owners are looked up, identified the
// way Argo CD's tracking-id and status.resources spell it.
type managedTarget struct {
	group, kind, namespace, name string
	labels, annotations          map[string]string
}

// GetResourceManagers returns the tools that own a resource, read from its
// metadata. kind is a built-in kind, a Flux alias ("FluxKustomization") or a
// "cr:<group>/<resource>" change kind. A resource nothing manages returns an
// empty slice.
func (m *ClientManager) GetResourceManagers(ctx context.Context, contextName, kind, namespace, name string) ([]ResourceManager, error) {
	gvr, err := m.resolveKind(contextName, kind)
	if err != nil {
		return nil, err
	}
	meta, err := m.objectMetadata(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	t := managedTarget{
		group:       gvr.Group,
		kind:        m.apiKind(contextName, kind, gvr),
		namespace:   meta.GetNamespace(),
		name:        meta.GetName(),
		labels:      meta.GetLabels(),
		annotations: meta.GetAnnotations(),
	}
	return m.resourceManagers(ctx, contextName, t), nil
}

func (m *ClientManager) resourceManagers(ctx context.Context, contextName string, t managedTarget) []ResourceManager {
	out := []ResourceManager{}
	if rm, ok := m.argoManager(ctx, contextName, t); ok {
		out = append(out, rm)
	}
	if name := t.labels[fluxKustomizationNameLabel]; name != "" {
		out = append(out, m.fluxKustomizationManager(ctx, contextName, t, t.labels[fluxKustomizationNamespaceLabel], name))
	}
	if name := t.labels[fluxHelmReleaseNameLabel]; name != "" {
		out = append(out, m.fluxHelmReleaseManager(ctx, contextName, t, t.labels[fluxHelmReleaseNamespaceLabel], name))
	}
	if name := t.annotations[helmReleaseNameAnnotation]; name != "" {
		ns := t.annotations[helmReleaseNamespaceAnnotation]
		if ns == "" {
			ns = t.namespace
		}
		out = append(out, ResourceManager{
			Tool: "helm", Kind: "HelmRelease", Context: contextName, Namespace: ns, Name: name,
			Resolved: true, IgnoredFields: []string{},
		})
	}
	return out
}

// objectMetadata reads only the object's metadata, so a large ConfigMap or a
// Secret's data never crosses the wire for a header chip.
func (m *ClientManager) objectMetadata(ctx context.Context, contextName string, gvr schema.GroupVersionResource, namespace, name string) (metav1.Object, error) {
	if w, ok := m.watcher(contextName); ok && w.meta != nil {
		var ri metadata.ResourceInterface = w.meta.Resource(gvr)
		if namespace != "" {
			ri = w.meta.Resource(gvr).Namespace(namespace)
		}
		return ri.Get(ctx, name, metav1.GetOptions{})
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	return resourceFor(dyn, gvr, namespace).Get(ctx, name, metav1.GetOptions{})
}

// apiKind is the Kubernetes kind behind a Klustr kind identifier.
func (m *ClientManager) apiKind(contextName, kind string, gvr schema.GroupVersionResource) string {
	if _, ok := kindToGVR[kind]; ok {
		return kind
	}
	if w, ok := m.watcher(contextName); ok && w.crd != nil {
		if info, found := w.crd.LookupCRDByGVR(gvr.GroupResource().WithVersion("")); found {
			return info.Kind
		}
	}
	return strings.TrimPrefix(kind, "Flux")
}

// argoManager finds the Application that deployed t. The resource's own
// context is searched first, then every other watched context, because a
// central Argo CD commonly deploys to clusters that do not run it.
func (m *ClientManager) argoManager(ctx context.Context, contextName string, t managedTarget) (ResourceManager, bool) {
	appNS, appName, byAnnotation := argoTrackedApp(t)
	if appName == "" {
		return ResourceManager{}, false
	}
	ownServer := m.contextServer(contextName)
	var (
		best        *unstructured.Unstructured
		bestContext string
		bestScore   int
	)
	for i, c := range append([]string{contextName}, m.otherWatchedContexts(contextName)...) {
		lookupCtx, cancel := ctx, context.CancelFunc(func() {})
		if i > 0 {
			lookupCtx, cancel = context.WithTimeout(ctx, argoLookupTimeout)
		}
		for _, app := range m.argoApplicationsNamed(lookupCtx, c, appNS, appName) {
			score := argoOwnerScore(app, t, c == contextName, byAnnotation, c, contextName, ownServer)
			if score > bestScore {
				best, bestContext, bestScore = app, c, score
			}
		}
		cancel()
		if bestScore == argoScoreConfirmed {
			break
		}
	}
	if best == nil {
		if !byAnnotation {
			// Label tracking without a confirming Application is most likely
			// a Helm chart's instance label.
			return ResourceManager{}, false
		}
		return ResourceManager{
			Tool: "argocd", Kind: "Application", Group: argoApplicationGR.Group, Resource: argoApplicationGR.Resource,
			Namespace: appNS, Name: appName, IgnoredFields: []string{},
		}, true
	}
	rm := ResourceManager{
		Tool: "argocd", Kind: "Application", Group: argoApplicationGR.Group, Resource: argoApplicationGR.Resource,
		Context: bestContext, Namespace: best.GetNamespace(), Name: best.GetName(), Resolved: true,
		IgnoredFields: argoIgnoredFields(best, t),
	}
	if argoSelfHeals(best) {
		rm.RevertsDrift = true
		rm.RevertReason = "self-heal is on"
	}
	return rm, true
}

// argoTrackedApp reads the owning Application from the tracking-id annotation,
// or from the instance label when there is none. A tracking-id that names a
// different object was copied along with a manifest, and Argo CD itself does
// not treat the copy as managed.
func argoTrackedApp(t managedTarget) (namespace, name string, byAnnotation bool) {
	app := ""
	if id := t.annotations[argoTrackingIDAnnotation]; id != "" {
		parts := strings.Split(id, ":")
		if len(parts) != 3 {
			return "", "", false
		}
		groupKind, nsName := parts[1], parts[2]
		group, kind, _ := strings.Cut(groupKind, "/")
		objNS, objName, _ := strings.Cut(nsName, "/")
		if kind != t.kind || objName != t.name || !sameAPIGroup(group, t.group) || (t.namespace != "" && objNS != t.namespace) {
			return "", "", false
		}
		app, byAnnotation = parts[0], true
	} else {
		app = t.labels[argoInstanceLabel]
	}
	if ns, n, ok := strings.Cut(app, "_"); ok {
		return ns, n, byAnnotation
	}
	return "", app, byAnnotation
}

// sameAPIGroup compares API groups the way Argo CD writes them: Deployments
// from an old extensions/v1beta1 manifest are tracked under "apps".
func sameAPIGroup(a, b string) bool {
	norm := func(g string) string {
		if g == "extensions" {
			return "apps"
		}
		return g
	}
	return norm(a) == norm(b)
}

const (
	argoScoreNameOnly  = 1 // same-context Application named by the tracking-id, not reconciled yet
	argoScoreListed    = 2 // lists the resource; destination not comparable
	argoScoreConfirmed = 3 // lists the resource and targets this cluster
)

// argoOwnerScore ranks an Application as t's owner; 0 rejects it. Membership
// in status.resources is what confirms ownership: status names no cluster, so
// an Application listing the same namespace/name in another cluster is told
// apart by its destination.
func argoOwnerScore(app *unstructured.Unstructured, t managedTarget, sameContext, byAnnotation bool, appContext, targetContext, targetServer string) int {
	targets := argoTargetsContext(app, appContext, targetContext, targetServer)
	if targets == argoTargetOther {
		return 0
	}
	if argoAppLists(app, t) {
		if targets == argoTargetThis {
			return argoScoreConfirmed
		}
		return argoScoreListed
	}
	if sameContext && byAnnotation {
		return argoScoreNameOnly
	}
	return 0
}

type argoTarget int

const (
	argoTargetUnknown argoTarget = iota
	argoTargetThis
	argoTargetOther
)

// argoTargetsContext compares an Application's destination with the target
// context. A destination given by cluster name only cannot be mapped to a
// kubeconfig context and stays unknown.
func argoTargetsContext(app *unstructured.Unstructured, appContext, targetContext, targetServer string) argoTarget {
	server, _, _ := unstructured.NestedString(app.Object, "spec", "destination", "server")
	destName, _, _ := unstructured.NestedString(app.Object, "spec", "destination", "name")
	if server == "https://kubernetes.default.svc" || (server == "" && destName == "in-cluster") {
		if appContext == targetContext {
			return argoTargetThis
		}
		return argoTargetOther
	}
	if server == "" || targetServer == "" {
		return argoTargetUnknown
	}
	if normalizeServerURL(server) == normalizeServerURL(targetServer) {
		return argoTargetThis
	}
	return argoTargetOther
}

func normalizeServerURL(s string) string {
	return strings.TrimRight(strings.ToLower(strings.TrimSpace(s)), "/")
}

func argoAppLists(app *unstructured.Unstructured, t managedTarget) bool {
	for _, r := range extractArgoResources(app) {
		if r.Kind == t.kind && r.Name == t.name && r.Namespace == t.namespace && sameAPIGroup(r.Group, t.group) {
			return true
		}
	}
	return false
}

// argoSelfHeals reports whether the Application syncs automatically with
// self-heal, the only mode in which Argo CD reverts a live change on its own.
func argoSelfHeals(app *unstructured.Unstructured) bool {
	automated, found, _ := nestedMapNoCopy(app.Object, "spec", "syncPolicy", "automated")
	if !found || automated == nil {
		return false
	}
	// automated.enabled (Argo CD 3.x) turns automation off while keeping its
	// flags; absent means on.
	if enabled, ok := automated["enabled"].(bool); ok && !enabled {
		return false
	}
	selfHeal, _ := automated["selfHeal"].(bool)
	return selfHeal
}

// jqSimplePath matches the jqPathExpressions that are plain field paths, the
// only form with a JSON pointer equivalent.
var jqSimplePath = regexp.MustCompile(`^(\.[A-Za-z0-9_-]+)+$`)

// argoIgnoredFields collects the Application's ignoreDifferences pointers that
// apply to t. Group and kind accept globs, as Argo CD matches them.
func argoIgnoredFields(app *unstructured.Unstructured, t managedTarget) []string {
	out := []string{}
	raw, _, _ := nestedSliceNoCopy(app.Object, "spec", "ignoreDifferences")
	for _, item := range raw {
		rule, ok := item.(map[string]any)
		if !ok {
			continue
		}
		group, _ := rule["group"].(string)
		kind, _ := rule["kind"].(string)
		name, _ := rule["name"].(string)
		namespace, _ := rule["namespace"].(string)
		if !globMatch(kind, t.kind) || (!globMatch(group, t.group) && !sameAPIGroup(group, t.group)) ||
			(name != "" && name != t.name) || (namespace != "" && namespace != t.namespace) {
			continue
		}
		out = appendStrings(out, rule["jsonPointers"])
		if exprs, ok := rule["jqPathExpressions"].([]any); ok {
			for _, e := range exprs {
				if s, ok := e.(string); ok && jqSimplePath.MatchString(s) {
					out = append(out, strings.ReplaceAll(s, ".", "/"))
				}
			}
		}
	}
	return out
}

func globMatch(pattern, value string) bool {
	if pattern == value {
		return true
	}
	ok, err := path.Match(pattern, value)
	return err == nil && ok
}

func appendStrings(dst []string, raw any) []string {
	items, ok := raw.([]any)
	if !ok {
		return dst
	}
	for _, item := range items {
		if s, ok := item.(string); ok && s != "" {
			dst = append(dst, s)
		}
	}
	return dst
}

// argoApplicationsNamed returns the Applications in contextName called name,
// in namespace when the tracking-id gives one. The informer cache is used when
// the Argo CD views already started it; otherwise one live request, filtered
// by name on the server, avoids pulling every Application in the cluster.
func (m *ClientManager) argoApplicationsNamed(ctx context.Context, contextName, namespace, name string) []*unstructured.Unstructured {
	if _, ok := m.servedGVR(contextName, argoApplicationGR); !ok {
		return nil
	}
	if namespace != "" {
		obj, err := m.getServedCR(ctx, contextName, argoApplicationGR, namespace, name)
		if err != nil {
			return nil
		}
		return []*unstructured.Unstructured{obj}
	}
	named := func(objs []*unstructured.Unstructured) []*unstructured.Unstructured {
		out := []*unstructured.Unstructured{}
		for _, obj := range objs {
			if obj.GetName() == name {
				out = append(out, obj)
			}
		}
		return out
	}
	if cached := m.listServedCRs(contextName, argoApplicationGR, ""); cached != nil {
		return named(cached)
	}
	ri, err := m.servedReader(contextName, argoApplicationGR, "")
	if err != nil {
		return nil
	}
	list, err := ri.List(ctx, metav1.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.name", name).String()})
	if err != nil {
		return nil
	}
	objs := make([]*unstructured.Unstructured, 0, len(list.Items))
	for i := range list.Items {
		objs = append(objs, &list.Items[i])
	}
	return named(objs)
}

// otherWatchedContexts lists the contexts with a running watch besides
// contextName. Only these are searched: reaching a cluster the user has not
// opened could prompt for credentials.
func (m *ClientManager) otherWatchedContexts(contextName string) []string {
	m.mu.Lock()
	out := make([]string, 0, len(m.watchers))
	for name := range m.watchers {
		if name != contextName {
			out = append(out, name)
		}
	}
	m.mu.Unlock()
	sort.Strings(out)
	return out
}

// contextServer is the API server URL the kubeconfig gives contextName, or ""
// when it cannot be read.
func (m *ClientManager) contextServer(contextName string) string {
	if m.rules == nil {
		return ""
	}
	raw, err := m.rules.Load()
	if err != nil {
		return ""
	}
	c, ok := raw.Contexts[contextName]
	if !ok {
		return ""
	}
	if cl, ok := raw.Clusters[c.Cluster]; ok {
		return cl.Server
	}
	return ""
}

// fluxKustomizationManager describes the Kustomization that applied t.
// kustomize-controller reapplies everything it manages on each interval, so a
// live change is reverted unless the Kustomization is suspended or the object
// opts out through its annotations.
func (m *ClientManager) fluxKustomizationManager(ctx context.Context, contextName string, t managedTarget, namespace, name string) ResourceManager {
	rm := ResourceManager{
		Tool: "flux", Kind: "Kustomization", Group: fluxKustomizationGR.Group, Resource: fluxKustomizationGR.Resource,
		Context: contextName, Namespace: namespace, Name: name, IgnoredFields: []string{},
	}
	_, rm.Resolved = m.servedGVR(contextName, fluxKustomizationGR)
	if t.annotations[fluxKustomizeReconcileAnnotation] == "disabled" {
		return rm
	}
	if ssa := t.annotations[fluxKustomizeSSAAnnotation]; ssa == "IfNotPresent" || ssa == "Ignore" {
		return rm
	}
	rm.RevertsDrift = true
	rm.RevertReason = "it is reapplied on every reconcile"
	if !rm.Resolved {
		return rm
	}
	obj, err := m.getServedCR(ctx, contextName, fluxKustomizationGR, namespace, name)
	if err != nil {
		return rm
	}
	if suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend"); suspended {
		rm.Suspended = true
		rm.RevertsDrift = false
		rm.RevertReason = ""
		return rm
	}
	if interval, _, _ := unstructured.NestedString(obj.Object, "spec", "interval"); interval != "" {
		rm.RevertReason = "it is reapplied every " + interval
	}
	return rm
}

// fluxHelmReleaseManager describes the Flux HelmRelease that installed t.
// helm-controller corrects live changes only with drift detection enabled.
func (m *ClientManager) fluxHelmReleaseManager(ctx context.Context, contextName string, t managedTarget, namespace, name string) ResourceManager {
	rm := ResourceManager{
		Tool: "flux", Kind: "HelmRelease", Group: fluxHelmReleaseGR.Group, Resource: fluxHelmReleaseGR.Resource,
		Context: contextName, Namespace: namespace, Name: name, IgnoredFields: []string{},
	}
	_, rm.Resolved = m.servedGVR(contextName, fluxHelmReleaseGR)
	if !rm.Resolved {
		return rm
	}
	obj, err := m.getServedCR(ctx, contextName, fluxHelmReleaseGR, namespace, name)
	if err != nil {
		return rm
	}
	rm.Suspended, _, _ = unstructured.NestedBool(obj.Object, "spec", "suspend")
	mode, _, _ := unstructured.NestedString(obj.Object, "spec", "driftDetection", "mode")
	if mode == "enabled" && !rm.Suspended {
		rm.RevertsDrift = true
		rm.RevertReason = "drift detection is on"
	}
	rules, _, _ := nestedSliceNoCopy(obj.Object, "spec", "driftDetection", "ignore")
	for _, item := range rules {
		rule, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if target, ok := rule["target"].(map[string]any); ok && !fluxSelectorMatches(target, t) {
			continue
		}
		rm.IgnoredFields = appendStrings(rm.IgnoredFields, rule["paths"])
	}
	return rm
}

// fluxSelectorMatches evaluates a Flux kustomize.Selector against t. Empty
// fields match anything.
func fluxSelectorMatches(sel map[string]any, t managedTarget) bool {
	str := func(key string) string {
		s, _ := sel[key].(string)
		return s
	}
	if g := str("group"); g != "" && g != t.group {
		return false
	}
	if k := str("kind"); k != "" && k != t.kind {
		return false
	}
	if n := str("name"); n != "" && n != t.name {
		return false
	}
	if ns := str("namespace"); ns != "" && ns != t.namespace {
		return false
	}
	for key, set := range map[string]map[string]string{"labelSelector": t.labels, "annotationSelector": t.annotations} {
		raw := str(key)
		if raw == "" {
			continue
		}
		selector, err := labels.Parse(raw)
		if err != nil || !selector.Matches(labels.Set(set)) {
			return false
		}
	}
	return true
}
