package kube

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

// argoAppProjectGVR is the canonical GVR for AppProject. Argo CD ships
// `default` automatically when argocd is installed.
var argoAppProjectGVR = schema.GroupVersionResource{
	Group:    "argoproj.io",
	Version:  "v1alpha1",
	Resource: "appprojects",
}

// argoApplicationSetGVR — present when ApplicationSet controller is
// installed (default in the argo-cd Helm chart).
var argoApplicationSetGVR = schema.GroupVersionResource{
	Group:    "argoproj.io",
	Version:  "v1alpha1",
	Resource: "applicationsets",
}

// --- AppProject ----------------------------------------------------------

// ArgoAppProjectInfo is the row shape the AppProjects list renders.
type ArgoAppProjectInfo struct {
	Name             string `json:"name"`
	Namespace        string `json:"namespace"`
	Description      string `json:"description"`
	SourceRepoCount  int    `json:"sourceRepoCount"`
	DestinationCount int    `json:"destinationCount"`
	RoleCount        int    `json:"roleCount"`
	SyncWindowCount  int    `json:"syncWindowCount"`
	CreatedAt        string `json:"createdAt"`
}

// ArgoAppProjectDestination is one entry in spec.destinations.
type ArgoAppProjectDestination struct {
	Server    string `json:"server"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

// ArgoAppProjectGroupKind is one entry in *resourceWhitelist / *Blacklist.
type ArgoAppProjectGroupKind struct {
	Group string `json:"group"`
	Kind  string `json:"kind"`
}

// ArgoAppProjectRole is one entry in spec.roles.
type ArgoAppProjectRole struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Policies    []string `json:"policies"`
	Groups      []string `json:"groups"`
}

// ArgoAppProjectSyncWindow is one entry in spec.syncWindows.
type ArgoAppProjectSyncWindow struct {
	Kind         string   `json:"kind"` // allow | deny
	Schedule     string   `json:"schedule"`
	Duration     string   `json:"duration"`
	Applications []string `json:"applications"`
	Namespaces   []string `json:"namespaces"`
	Clusters     []string `json:"clusters"`
	ManualSync   bool     `json:"manualSync"`
	TimeZone     string   `json:"timeZone"`
}

// ArgoAppProjectDetail is the typed detail shape for an AppProject.
type ArgoAppProjectDetail struct {
	Name                       string                      `json:"name"`
	Namespace                  string                      `json:"namespace"`
	Description                string                      `json:"description"`
	SourceRepos                []string                    `json:"sourceRepos"`
	SourceNamespaces           []string                    `json:"sourceNamespaces"`
	Destinations               []ArgoAppProjectDestination `json:"destinations"`
	ClusterResourceWhitelist   []ArgoAppProjectGroupKind   `json:"clusterResourceWhitelist"`
	NamespaceResourceWhitelist []ArgoAppProjectGroupKind   `json:"namespaceResourceWhitelist"`
	ClusterResourceBlacklist   []ArgoAppProjectGroupKind   `json:"clusterResourceBlacklist"`
	NamespaceResourceBlacklist []ArgoAppProjectGroupKind   `json:"namespaceResourceBlacklist"`
	Roles                      []ArgoAppProjectRole        `json:"roles"`
	SyncWindows                []ArgoAppProjectSyncWindow  `json:"syncWindows"`
	CreatedAt                  string                      `json:"createdAt"`
}

// ListArgoAppProjects projects every AppProject CR from the cached dynamic
// informer. The frontend ensures the watch is started on view mount.
func (m *ClientManager) ListArgoAppProjects(contextName, namespace string) []ArgoAppProjectInfo {
	objs := listCachedCRs(m, contextName, argoAppProjectGVR, namespace)
	out := make([]ArgoAppProjectInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractArgoAppProjectInfo(obj))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// GetArgoAppProject reads one AppProject for the detail panel.
func (m *ClientManager) GetArgoAppProject(ctx context.Context, contextName, namespace, name string) (*ArgoAppProjectDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(argoAppProjectGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	d := extractArgoAppProjectDetail(obj)
	return &d, nil
}

func extractArgoAppProjectInfo(obj *unstructured.Unstructured) ArgoAppProjectInfo {
	description, _, _ := unstructured.NestedString(obj.Object, "spec", "description")
	sourceRepos, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "sourceRepos")
	destinations, _, _ := unstructured.NestedSlice(obj.Object, "spec", "destinations")
	roles, _, _ := unstructured.NestedSlice(obj.Object, "spec", "roles")
	syncWindows, _, _ := unstructured.NestedSlice(obj.Object, "spec", "syncWindows")
	return ArgoAppProjectInfo{
		Name:             obj.GetName(),
		Namespace:        obj.GetNamespace(),
		Description:      description,
		SourceRepoCount:  len(sourceRepos),
		DestinationCount: len(destinations),
		RoleCount:        len(roles),
		SyncWindowCount:  len(syncWindows),
		CreatedAt:        obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

func extractArgoAppProjectDetail(obj *unstructured.Unstructured) ArgoAppProjectDetail {
	d := ArgoAppProjectDetail{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
	d.Description, _, _ = unstructured.NestedString(obj.Object, "spec", "description")
	d.SourceRepos = nonNilStrings(unstructured.NestedStringSlice(obj.Object, "spec", "sourceRepos"))
	d.SourceNamespaces = nonNilStrings(unstructured.NestedStringSlice(obj.Object, "spec", "sourceNamespaces"))
	d.Destinations = readArgoProjectDestinations(obj, "spec", "destinations")
	d.ClusterResourceWhitelist = readArgoProjectGroupKinds(obj, "spec", "clusterResourceWhitelist")
	d.NamespaceResourceWhitelist = readArgoProjectGroupKinds(obj, "spec", "namespaceResourceWhitelist")
	d.ClusterResourceBlacklist = readArgoProjectGroupKinds(obj, "spec", "clusterResourceBlacklist")
	d.NamespaceResourceBlacklist = readArgoProjectGroupKinds(obj, "spec", "namespaceResourceBlacklist")
	d.Roles = readArgoProjectRoles(obj)
	d.SyncWindows = readArgoProjectSyncWindows(obj)
	return d
}

func readArgoProjectDestinations(obj *unstructured.Unstructured, path ...string) []ArgoAppProjectDestination {
	raw, _, _ := unstructured.NestedSlice(obj.Object, path...)
	out := make([]ArgoAppProjectDestination, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		dest := ArgoAppProjectDestination{}
		dest.Server, _ = m["server"].(string)
		dest.Namespace, _ = m["namespace"].(string)
		dest.Name, _ = m["name"].(string)
		out = append(out, dest)
	}
	return out
}

func readArgoProjectGroupKinds(obj *unstructured.Unstructured, path ...string) []ArgoAppProjectGroupKind {
	raw, _, _ := unstructured.NestedSlice(obj.Object, path...)
	out := make([]ArgoAppProjectGroupKind, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		gk := ArgoAppProjectGroupKind{}
		gk.Group, _ = m["group"].(string)
		gk.Kind, _ = m["kind"].(string)
		out = append(out, gk)
	}
	return out
}

func readArgoProjectRoles(obj *unstructured.Unstructured) []ArgoAppProjectRole {
	raw, _, _ := unstructured.NestedSlice(obj.Object, "spec", "roles")
	out := make([]ArgoAppProjectRole, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		r := ArgoAppProjectRole{}
		r.Name, _ = m["name"].(string)
		r.Description, _ = m["description"].(string)
		r.Policies = readStringSliceField(m, "policies")
		r.Groups = readStringSliceField(m, "groups")
		out = append(out, r)
	}
	return out
}

func readArgoProjectSyncWindows(obj *unstructured.Unstructured) []ArgoAppProjectSyncWindow {
	raw, _, _ := unstructured.NestedSlice(obj.Object, "spec", "syncWindows")
	out := make([]ArgoAppProjectSyncWindow, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		w := ArgoAppProjectSyncWindow{}
		w.Kind, _ = m["kind"].(string)
		w.Schedule, _ = m["schedule"].(string)
		w.Duration, _ = m["duration"].(string)
		w.Applications = readStringSliceField(m, "applications")
		w.Namespaces = readStringSliceField(m, "namespaces")
		w.Clusters = readStringSliceField(m, "clusters")
		if v, ok := m["manualSync"].(bool); ok {
			w.ManualSync = v
		}
		w.TimeZone, _ = m["timeZone"].(string)
		out = append(out, w)
	}
	return out
}

// --- ApplicationSet ------------------------------------------------------

// ArgoApplicationSetInfo is the row shape the ApplicationSets list renders.
type ArgoApplicationSetInfo struct {
	Name           string   `json:"name"`
	Namespace      string   `json:"namespace"`
	GeneratorTypes []string `json:"generatorTypes"`
	AppCount       int      `json:"appCount"`
	HealthyCount   int      `json:"healthyCount"`
	SyncedCount    int      `json:"syncedCount"`
	CreatedAt      string   `json:"createdAt"`
}

// ArgoApplicationSetGenerator is one element in spec.generators projected
// into a typed shape: Type is the discriminator (list, git, clusters,
// matrix, merge, scmProvider, pullRequest, plugin) and Summary is a short
// human-readable description so the UI doesn't need to format each variant.
type ArgoApplicationSetGenerator struct {
	Type    string `json:"type"`
	Summary string `json:"summary"`
}

// ArgoApplicationSetGeneratedApp is a row from .status.applicationStatus[]
// — what Argo's ApplicationSet controller reports for each Application it
// generated from this set.
type ArgoApplicationSetGeneratedApp struct {
	Application        string `json:"application"`
	Status             string `json:"status"`
	Step               string `json:"step"`
	Message            string `json:"message"`
	LastTransitionTime string `json:"lastTransitionTime"`
	TargetRevisions    string `json:"targetRevisions"`
}

// ArgoApplicationSetDetail is the typed detail shape for an ApplicationSet.
type ArgoApplicationSetDetail struct {
	Name             string                           `json:"name"`
	Namespace        string                           `json:"namespace"`
	Generators       []ArgoApplicationSetGenerator    `json:"generators"`
	TemplateName     string                           `json:"templateName"`     // .spec.template.metadata.name (templated)
	TemplateProject  string                           `json:"templateProject"`  // .spec.template.spec.project
	TemplateRepoURL  string                           `json:"templateRepoURL"`  // .spec.template.spec.source.repoURL
	TemplatePath     string                           `json:"templatePath"`     // .spec.template.spec.source.path
	TemplateRevision string                           `json:"templateRevision"` // .spec.template.spec.source.targetRevision
	TemplateDestNS   string                           `json:"templateDestNs"`   // .spec.template.spec.destination.namespace
	GeneratedApps    []ArgoApplicationSetGeneratedApp `json:"generatedApps"`
	Conditions       []ConditionDetail                `json:"conditions"`
	CreatedAt        string                           `json:"createdAt"`
}

// ListArgoApplicationSets projects every ApplicationSet CR.
func (m *ClientManager) ListArgoApplicationSets(contextName, namespace string) []ArgoApplicationSetInfo {
	objs := listCachedCRs(m, contextName, argoApplicationSetGVR, namespace)
	out := make([]ArgoApplicationSetInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractArgoApplicationSetInfo(obj))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// GetArgoApplicationSet reads one ApplicationSet for the detail panel.
//
// Falls back to listing Applications owned by this ApplicationSet (via
// ownerReferences) when status.applicationStatus[] is empty — which is the
// default unless the user explicitly opted into progressive sync. Without
// that fallback the Generated Applications table would always be empty.
func (m *ClientManager) GetArgoApplicationSet(ctx context.Context, contextName, namespace, name string) (*ArgoApplicationSetDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(argoApplicationSetGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	d := extractArgoApplicationSetDetail(obj)
	if len(d.GeneratedApps) == 0 {
		d.GeneratedApps = findArgoApplicationsOwnedBy(ctx, dyn, namespace, name)
	}
	return &d, nil
}

// findArgoApplicationsOwnedBy lists every Application in `namespace` whose
// ownerReferences contains an ApplicationSet pointing at `appSetName`, and
// projects each into the same row shape progressive-sync reports.
func findArgoApplicationsOwnedBy(
	ctx context.Context,
	dyn dynamic.Interface,
	namespace, appSetName string,
) []ArgoApplicationSetGeneratedApp {
	list, err := dyn.Resource(argoApplicationGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return []ArgoApplicationSetGeneratedApp{}
	}
	out := make([]ArgoApplicationSetGeneratedApp, 0, len(list.Items))
	for _, app := range list.Items {
		if !isOwnedByApplicationSet(&app, appSetName) {
			continue
		}
		syncStatus, _, _ := unstructured.NestedString(app.Object, "status", "sync", "status")
		health, _, _ := unstructured.NestedString(app.Object, "status", "health", "status")
		msg, _, _ := unstructured.NestedString(app.Object, "status", "operationState", "message")
		out = append(out, ArgoApplicationSetGeneratedApp{
			Application: app.GetName(),
			Status:      health,
			Step:        syncStatus,
			Message:     msg,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Application < out[j].Application })
	return out
}

func isOwnedByApplicationSet(app *unstructured.Unstructured, appSetName string) bool {
	for _, ref := range app.GetOwnerReferences() {
		if ref.Kind == "ApplicationSet" && ref.Name == appSetName {
			return true
		}
	}
	return false
}

func extractArgoApplicationSetInfo(obj *unstructured.Unstructured) ArgoApplicationSetInfo {
	gens := readArgoApplicationSetGeneratorTypes(obj)
	apps := readArgoApplicationSetGeneratedApps(obj)
	healthy, synced := 0, 0
	for _, a := range apps {
		if a.Status == "Healthy" {
			healthy++
		}
		if a.Status == "Synced" {
			synced++
		}
	}
	return ArgoApplicationSetInfo{
		Name:           obj.GetName(),
		Namespace:      obj.GetNamespace(),
		GeneratorTypes: gens,
		AppCount:       len(apps),
		HealthyCount:   healthy,
		SyncedCount:    synced,
		CreatedAt:      obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

func extractArgoApplicationSetDetail(obj *unstructured.Unstructured) ArgoApplicationSetDetail {
	d := ArgoApplicationSetDetail{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
	d.Generators = readArgoApplicationSetGenerators(obj)
	d.TemplateName, _, _ = unstructured.NestedString(obj.Object, "spec", "template", "metadata", "name")
	d.TemplateProject, _, _ = unstructured.NestedString(obj.Object, "spec", "template", "spec", "project")
	d.TemplateRepoURL, _, _ = unstructured.NestedString(obj.Object, "spec", "template", "spec", "source", "repoURL")
	d.TemplatePath, _, _ = unstructured.NestedString(obj.Object, "spec", "template", "spec", "source", "path")
	d.TemplateRevision, _, _ = unstructured.NestedString(obj.Object, "spec", "template", "spec", "source", "targetRevision")
	d.TemplateDestNS, _, _ = unstructured.NestedString(obj.Object, "spec", "template", "spec", "destination", "namespace")
	d.GeneratedApps = readArgoApplicationSetGeneratedApps(obj)
	d.Conditions = readArgoApplicationSetConditions(obj)
	return d
}

// readArgoApplicationSetGeneratorTypes returns just the type discriminators
// (list, git, clusters, …) in spec order — used for the list-view chips
// without paying for full summaries.
func readArgoApplicationSetGeneratorTypes(obj *unstructured.Unstructured) []string {
	raw, _, _ := unstructured.NestedSlice(obj.Object, "spec", "generators")
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if t := argoApplicationSetGeneratorType(m); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func readArgoApplicationSetGenerators(obj *unstructured.Unstructured) []ArgoApplicationSetGenerator {
	raw, _, _ := unstructured.NestedSlice(obj.Object, "spec", "generators")
	out := make([]ArgoApplicationSetGenerator, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		t := argoApplicationSetGeneratorType(m)
		if t == "" {
			continue
		}
		out = append(out, ArgoApplicationSetGenerator{
			Type:    t,
			Summary: summarizeArgoApplicationSetGenerator(t, m[t]),
		})
	}
	return out
}

// argoApplicationSetGeneratorType walks the known discriminator keys and
// returns whichever is present. Multiple keys per generator entry shouldn't
// happen but we'd just take the first found.
func argoApplicationSetGeneratorType(m map[string]any) string {
	for _, k := range []string{"list", "clusters", "git", "matrix", "merge", "scmProvider", "pullRequest", "plugin", "clusterDecisionResource"} {
		if _, ok := m[k]; ok {
			return k
		}
	}
	return ""
}

// summarizeArgoApplicationSetGenerator returns a one-liner the UI can render
// next to the type chip — "git: stefanprodan/podinfo @ main, dirs=…" etc.
func summarizeArgoApplicationSetGenerator(t string, body any) string {
	m, ok := body.(map[string]any)
	if !ok {
		return ""
	}
	switch t {
	case "list":
		elems, _ := m["elements"].([]any)
		return fmt.Sprintf("%d elements", len(elems))
	case "git":
		repoURL, _ := m["repoURL"].(string)
		revision, _ := m["revision"].(string)
		var picker string
		if dirs, ok := m["directories"].([]any); ok && len(dirs) > 0 {
			picker = fmt.Sprintf(", dirs=%d", len(dirs))
		} else if files, ok := m["files"].([]any); ok && len(files) > 0 {
			picker = fmt.Sprintf(", files=%d", len(files))
		}
		return fmt.Sprintf("%s @ %s%s", repoURL, revision, picker)
	case "clusters":
		if sel, ok := m["selector"].(map[string]any); ok && len(sel) > 0 {
			ml, _ := sel["matchLabels"].(map[string]any)
			parts := make([]string, 0, len(ml))
			for k, v := range ml {
				parts = append(parts, fmt.Sprintf("%s=%v", k, v))
			}
			sort.Strings(parts)
			return strings.Join(parts, ",")
		}
		return "all clusters"
	case "matrix", "merge":
		gens, _ := m["generators"].([]any)
		return fmt.Sprintf("%d sub-generators", len(gens))
	case "scmProvider", "pullRequest":
		for _, vendor := range []string{"github", "gitlab", "gitea", "bitbucket", "bitbucketServer", "azureDevOps"} {
			if _, ok := m[vendor]; ok {
				return vendor
			}
		}
	case "plugin":
		cm, _ := m["configMapRef"].(map[string]any)
		ref, _ := cm["name"].(string)
		return fmt.Sprintf("plugin %s", ref)
	}
	return ""
}

func readArgoApplicationSetGeneratedApps(obj *unstructured.Unstructured) []ArgoApplicationSetGeneratedApp {
	raw, _, _ := unstructured.NestedSlice(obj.Object, "status", "applicationStatus")
	out := make([]ArgoApplicationSetGeneratedApp, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		entry := ArgoApplicationSetGeneratedApp{}
		entry.Application, _ = m["application"].(string)
		entry.Status, _ = m["status"].(string)
		entry.Step, _ = m["step"].(string)
		entry.Message, _ = m["message"].(string)
		entry.LastTransitionTime, _ = m["lastTransitionTime"].(string)
		if revs, ok := m["targetRevisions"].([]any); ok {
			parts := make([]string, 0, len(revs))
			for _, r := range revs {
				if s, ok := r.(string); ok {
					parts = append(parts, s)
				}
			}
			entry.TargetRevisions = strings.Join(parts, ", ")
		}
		out = append(out, entry)
	}
	return out
}

func readArgoApplicationSetConditions(obj *unstructured.Unstructured) []ConditionDetail {
	raw, _, _ := unstructured.NestedSlice(obj.Object, "status", "conditions")
	out := make([]ConditionDetail, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		c := ConditionDetail{}
		c.Type, _ = m["type"].(string)
		c.Status, _ = m["status"].(string)
		c.Reason, _ = m["reason"].(string)
		c.Message, _ = m["message"].(string)
		out = append(out, c)
	}
	return out
}

func nonNilStrings(s []string, _ bool, _ error) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func readStringSliceField(m map[string]any, key string) []string {
	v, ok := m[key].([]any)
	if !ok {
		return []string{}
	}
	out := make([]string, 0, len(v))
	for _, x := range v {
		if s, ok := x.(string); ok {
			out = append(out, s)
		}
	}
	return out
}
