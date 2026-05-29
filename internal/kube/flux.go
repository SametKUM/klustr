package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// Flux CD CR GVRs as of Flux v2.8.x. Kustomization and GitRepository have
// settled on v1; HelmRelease moved to v2 in Flux 2.3 (v2beta2 is still
// served on older installs but every release Klustr targets exposes v2).
var (
	fluxKustomizationGVR  = schema.GroupVersionResource{Group: "kustomize.toolkit.fluxcd.io", Version: "v1", Resource: "kustomizations"}
	fluxHelmReleaseGVR    = schema.GroupVersionResource{Group: "helm.toolkit.fluxcd.io", Version: "v2", Resource: "helmreleases"}
	fluxGitRepositoryGVR  = schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1", Resource: "gitrepositories"}
	fluxHelmRepositoryGVR = schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1", Resource: "helmrepositories"}
	fluxOCIRepositoryGVR  = schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1", Resource: "ocirepositories"}
	fluxBucketGVR         = schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1", Resource: "buckets"}
	// Notification toolkit hasn't graduated Provider and Alert to v1 yet —
	// Receiver did. The storage version on the cluster is what we serve, so
	// pin each to the right one rather than guessing a single shared version.
	fluxProviderGVR = schema.GroupVersionResource{Group: "notification.toolkit.fluxcd.io", Version: "v1beta3", Resource: "providers"}
	fluxAlertGVR    = schema.GroupVersionResource{Group: "notification.toolkit.fluxcd.io", Version: "v1beta3", Resource: "alerts"}
	fluxReceiverGVR = schema.GroupVersionResource{Group: "notification.toolkit.fluxcd.io", Version: "v1", Resource: "receivers"}
)

// fluxKindGVR maps the Klustr-side Flux kind identifiers (used by the
// frontend / Wails layer) to their canonical GVR. The "Flux" prefix keeps
// the kind names from colliding with the helm v3 HelmRelease detail tab in
// ResourceDetailPanel and disambiguates dispatch in the UI without a
// special-case for every site.
var fluxKindGVR = map[string]schema.GroupVersionResource{
	"FluxKustomization":  fluxKustomizationGVR,
	"FluxHelmRelease":    fluxHelmReleaseGVR,
	"FluxGitRepository":  fluxGitRepositoryGVR,
	"FluxHelmRepository": fluxHelmRepositoryGVR,
	"FluxOCIRepository":  fluxOCIRepositoryGVR,
	"FluxBucket":         fluxBucketGVR,
	"FluxProvider":       fluxProviderGVR,
	"FluxAlert":          fluxAlertGVR,
	"FluxReceiver":       fluxReceiverGVR,
}

// fluxReconcileAnnotation is the trigger Flux controllers watch for to
// kick off a manual reconcile (same payload `flux reconcile` writes).
// The value must be a RFC3339Nano timestamp that's strictly greater than
// status.lastHandledReconcileAt or the controller treats it as already
// handled and ignores the change.
const fluxReconcileAnnotation = "reconcile.fluxcd.io/requestedAt"

// FluxCondition is the projection of one entry in .status.conditions that
// every Flux CR exposes (k8s metav1.Condition shape). Reading the Ready
// condition gives the user-facing health summary; the other conditions
// (Stalled, Reconciling) provide context the detail panel surfaces.
type FluxCondition struct {
	Type               string `json:"type"`
	Status             string `json:"status"`
	Reason             string `json:"reason"`
	Message            string `json:"message"`
	LastTransitionTime string `json:"lastTransitionTime"`
}

// ---------------------------------------------------------------------------
// Kustomization
// ---------------------------------------------------------------------------

// FluxKustomizationInfo is the row shape rendered in the Kustomizations list.
// Ready collapses .status.conditions[Ready] into a single label and Status
// carries the matching message so the list cell can show both at a glance.
type FluxKustomizationInfo struct {
	Name                string `json:"name"`
	Namespace           string `json:"namespace"`
	Ready               string `json:"ready"`
	Status              string `json:"status"`
	Suspended           bool   `json:"suspended"`
	Path                string `json:"path"`
	SourceRef           string `json:"sourceRef"`
	Revision            string `json:"revision"`
	LastAppliedRevision string `json:"lastAppliedRevision"`
	Interval            string `json:"interval"`
	CreatedAt           string `json:"createdAt"`
}

// FluxKustomizationDetail extends the row shape with the spec fields the
// detail panel renders alongside the conditions table.
type FluxKustomizationDetail struct {
	FluxKustomizationInfo
	Conditions         []FluxCondition `json:"conditions"`
	Prune              bool            `json:"prune"`
	Force              bool            `json:"force"`
	Wait               bool            `json:"wait"`
	TargetNamespace    string          `json:"targetNamespace"`
	ServiceAccountName string          `json:"serviceAccountName"`
	Timeout            string          `json:"timeout"`
	RetryInterval      string          `json:"retryInterval"`
	DependsOn          []string        `json:"dependsOn"`
}

func (m *ClientManager) ListFluxKustomizations(contextName, namespace string) []FluxKustomizationInfo {
	objs := listCachedCRs(m, contextName, fluxKustomizationGVR, namespace)
	out := make([]FluxKustomizationInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractFluxKustomization(obj))
	}
	sortFluxRows(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetFluxKustomization(ctx context.Context, contextName, namespace, name string) (*FluxKustomizationDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(fluxKustomizationGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	info := extractFluxKustomization(obj)
	dependsOn, _, _ := unstructured.NestedSlice(obj.Object, "spec", "dependsOn")
	targetNS, _, _ := unstructured.NestedString(obj.Object, "spec", "targetNamespace")
	serviceAccount, _, _ := unstructured.NestedString(obj.Object, "spec", "serviceAccountName")
	prune, _, _ := unstructured.NestedBool(obj.Object, "spec", "prune")
	force, _, _ := unstructured.NestedBool(obj.Object, "spec", "force")
	wait, _, _ := unstructured.NestedBool(obj.Object, "spec", "wait")
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeout")
	retry, _, _ := unstructured.NestedString(obj.Object, "spec", "retryInterval")
	return &FluxKustomizationDetail{
		FluxKustomizationInfo: info,
		Conditions:            extractFluxConditions(obj),
		Prune:                 prune,
		Force:                 force,
		Wait:                  wait,
		TargetNamespace:       targetNS,
		ServiceAccountName:    serviceAccount,
		Timeout:               timeout,
		RetryInterval:         retry,
		DependsOn:             extractDependsOnRefs(dependsOn),
	}, nil
}

func extractFluxKustomization(obj *unstructured.Unstructured) FluxKustomizationInfo {
	conds := extractFluxConditions(obj)
	readyStatus, readyMsg := readySummary(conds)
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	path, _, _ := unstructured.NestedString(obj.Object, "spec", "path")
	interval, _, _ := unstructured.NestedString(obj.Object, "spec", "interval")
	revision, _, _ := unstructured.NestedString(obj.Object, "status", "lastAttemptedRevision")
	appliedRev, _, _ := unstructured.NestedString(obj.Object, "status", "lastAppliedRevision")
	sourceRef, _, _ := unstructured.NestedMap(obj.Object, "spec", "sourceRef")
	return FluxKustomizationInfo{
		Name:                obj.GetName(),
		Namespace:           obj.GetNamespace(),
		Ready:               readyStatus,
		Status:              readyMsg,
		Suspended:           suspended,
		Path:                path,
		SourceRef:           formatSourceRef(sourceRef, obj.GetNamespace()),
		Revision:            revision,
		LastAppliedRevision: appliedRev,
		Interval:            interval,
		CreatedAt:           obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// HelmRelease
// ---------------------------------------------------------------------------

// FluxHelmReleaseInfo is the row shape rendered in the Flux HelmReleases
// list. Chart / Version come from .spec.chart.spec for the legacy embedded
// chartTemplate, or .spec.chartRef for the new (Flux 2.3+) OCI/Helm ref.
type FluxHelmReleaseInfo struct {
	Name                string `json:"name"`
	Namespace           string `json:"namespace"`
	Ready               string `json:"ready"`
	Status              string `json:"status"`
	Suspended           bool   `json:"suspended"`
	Chart               string `json:"chart"`
	Version             string `json:"version"`
	SourceRef           string `json:"sourceRef"`
	LastAppliedRevision string `json:"lastAppliedRevision"`
	Interval            string `json:"interval"`
	CreatedAt           string `json:"createdAt"`
}

type FluxHelmReleaseDetail struct {
	FluxHelmReleaseInfo
	Conditions       []FluxCondition `json:"conditions"`
	ReleaseName      string          `json:"releaseName"`
	TargetNamespace  string          `json:"targetNamespace"`
	StorageNamespace string          `json:"storageNamespace"`
	ServiceAccount   string          `json:"serviceAccount"`
	Timeout          string          `json:"timeout"`
	DependsOn        []string        `json:"dependsOn"`
}

func (m *ClientManager) ListFluxHelmReleases(contextName, namespace string) []FluxHelmReleaseInfo {
	objs := listCachedCRs(m, contextName, fluxHelmReleaseGVR, namespace)
	out := make([]FluxHelmReleaseInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractFluxHelmRelease(obj))
	}
	sortFluxRows(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetFluxHelmRelease(ctx context.Context, contextName, namespace, name string) (*FluxHelmReleaseDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(fluxHelmReleaseGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	info := extractFluxHelmRelease(obj)
	releaseName, _, _ := unstructured.NestedString(obj.Object, "spec", "releaseName")
	targetNS, _, _ := unstructured.NestedString(obj.Object, "spec", "targetNamespace")
	storageNS, _, _ := unstructured.NestedString(obj.Object, "spec", "storageNamespace")
	serviceAccount, _, _ := unstructured.NestedString(obj.Object, "spec", "serviceAccountName")
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeout")
	dependsOn, _, _ := unstructured.NestedSlice(obj.Object, "spec", "dependsOn")
	return &FluxHelmReleaseDetail{
		FluxHelmReleaseInfo: info,
		Conditions:          extractFluxConditions(obj),
		ReleaseName:         releaseName,
		TargetNamespace:     targetNS,
		StorageNamespace:    storageNS,
		ServiceAccount:      serviceAccount,
		Timeout:             timeout,
		DependsOn:           extractDependsOnRefs(dependsOn),
	}, nil
}

func extractFluxHelmRelease(obj *unstructured.Unstructured) FluxHelmReleaseInfo {
	conds := extractFluxConditions(obj)
	readyStatus, readyMsg := readySummary(conds)
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	interval, _, _ := unstructured.NestedString(obj.Object, "spec", "interval")
	appliedRev, _, _ := unstructured.NestedString(obj.Object, "status", "lastAppliedRevision")
	if appliedRev == "" {
		// Older Flux installs surface this under history[0].
		if hist, found, _ := unstructured.NestedSlice(obj.Object, "status", "history"); found && len(hist) > 0 {
			if h0, ok := hist[0].(map[string]any); ok {
				if r, _ := h0["chartVersion"].(string); r != "" {
					appliedRev = r
				}
			}
		}
	}

	// Chart name + version live in two shapes depending on Flux version:
	//   .spec.chart.spec.chart / .version  (legacy in-place chartTemplate)
	//   .spec.chartRef.name + .spec.chartRef.kind (OCIRepository / HelmChart)
	chart, version, sourceRef := extractHelmReleaseChart(obj)

	return FluxHelmReleaseInfo{
		Name:                obj.GetName(),
		Namespace:           obj.GetNamespace(),
		Ready:               readyStatus,
		Status:              readyMsg,
		Suspended:           suspended,
		Chart:               chart,
		Version:             version,
		SourceRef:           sourceRef,
		LastAppliedRevision: appliedRev,
		Interval:            interval,
		CreatedAt:           obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// extractHelmReleaseChart unpacks the chart name, version, and human source
// reference from a HelmRelease, supporting both the embedded chartTemplate
// and the chartRef (Flux 2.3+) shapes. Empty strings when neither block is
// populated — the caller renders "—" placeholders in that case.
func extractHelmReleaseChart(obj *unstructured.Unstructured) (chart, version, sourceRef string) {
	if chartTemplate, found, _ := unstructured.NestedMap(obj.Object, "spec", "chart", "spec"); found && chartTemplate != nil {
		chart, _ = chartTemplate["chart"].(string)
		version, _ = chartTemplate["version"].(string)
		if sr, ok := chartTemplate["sourceRef"].(map[string]any); ok {
			sourceRef = formatSourceRef(sr, obj.GetNamespace())
		}
		return
	}
	if chartRef, found, _ := unstructured.NestedMap(obj.Object, "spec", "chartRef"); found && chartRef != nil {
		chart, _ = chartRef["name"].(string)
		sourceRef = formatSourceRef(chartRef, obj.GetNamespace())
	}
	return
}

// ---------------------------------------------------------------------------
// GitRepository
// ---------------------------------------------------------------------------

type FluxGitRepositoryInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	Status    string `json:"status"`
	Suspended bool   `json:"suspended"`
	URL       string `json:"url"`
	Ref       string `json:"ref"`
	Revision  string `json:"revision"`
	Interval  string `json:"interval"`
	CreatedAt string `json:"createdAt"`
}

type FluxGitRepositoryDetail struct {
	FluxGitRepositoryInfo
	Conditions     []FluxCondition `json:"conditions"`
	SecretRef      string          `json:"secretRef"`
	Timeout        string          `json:"timeout"`
	IgnorePatterns string          `json:"ignorePatterns"`
	Verification   string          `json:"verification"`
}

func (m *ClientManager) ListFluxGitRepositories(contextName, namespace string) []FluxGitRepositoryInfo {
	objs := listCachedCRs(m, contextName, fluxGitRepositoryGVR, namespace)
	out := make([]FluxGitRepositoryInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractFluxGitRepository(obj))
	}
	sortFluxRows(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetFluxGitRepository(ctx context.Context, contextName, namespace, name string) (*FluxGitRepositoryDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(fluxGitRepositoryGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	info := extractFluxGitRepository(obj)
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeout")
	ignore, _, _ := unstructured.NestedString(obj.Object, "spec", "ignore")
	verifyMode, _, _ := unstructured.NestedString(obj.Object, "spec", "verify", "mode")
	secretRef := ""
	if sr, _, _ := unstructured.NestedMap(obj.Object, "spec", "secretRef"); sr != nil {
		secretRef, _ = sr["name"].(string)
	}
	return &FluxGitRepositoryDetail{
		FluxGitRepositoryInfo: info,
		Conditions:            extractFluxConditions(obj),
		SecretRef:             secretRef,
		Timeout:               timeout,
		IgnorePatterns:        ignore,
		Verification:          verifyMode,
	}, nil
}

func extractFluxGitRepository(obj *unstructured.Unstructured) FluxGitRepositoryInfo {
	conds := extractFluxConditions(obj)
	readyStatus, readyMsg := readySummary(conds)
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	url, _, _ := unstructured.NestedString(obj.Object, "spec", "url")
	interval, _, _ := unstructured.NestedString(obj.Object, "spec", "interval")
	revision, _, _ := unstructured.NestedString(obj.Object, "status", "artifact", "revision")
	return FluxGitRepositoryInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Ready:     readyStatus,
		Status:    readyMsg,
		Suspended: suspended,
		URL:       url,
		Ref:       extractGitRef(obj),
		Revision:  revision,
		Interval:  interval,
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// extractGitRef collapses .spec.ref into a single human-readable label.
// Flux accepts branch/tag/semver/commit as alternative one-of fields; the
// CRD doesn't forbid setting more than one, so pick the most specific.
func extractGitRef(obj *unstructured.Unstructured) string {
	ref, _, _ := unstructured.NestedMap(obj.Object, "spec", "ref")
	if ref == nil {
		return ""
	}
	if v, _ := ref["commit"].(string); v != "" {
		return "commit: " + v
	}
	if v, _ := ref["semver"].(string); v != "" {
		return "semver: " + v
	}
	if v, _ := ref["tag"].(string); v != "" {
		return "tag: " + v
	}
	if v, _ := ref["branch"].(string); v != "" {
		return "branch: " + v
	}
	if v, _ := ref["name"].(string); v != "" {
		return "name: " + v
	}
	return ""
}

// ---------------------------------------------------------------------------
// HelmRepository
// ---------------------------------------------------------------------------

// FluxHelmRepositoryInfo is the row shape for the HelmRepositories view.
// Type collapses .spec.type (default | oci) into a single column the user
// can scan; for OCI repos the same .spec.url is still rendered as-is so
// the registry host is visible.
type FluxHelmRepositoryInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	Status    string `json:"status"`
	Suspended bool   `json:"suspended"`
	Type      string `json:"type"`
	Provider  string `json:"provider"`
	URL       string `json:"url"`
	Revision  string `json:"revision"`
	Interval  string `json:"interval"`
	CreatedAt string `json:"createdAt"`
}

type FluxHelmRepositoryDetail struct {
	FluxHelmRepositoryInfo
	Conditions []FluxCondition `json:"conditions"`
	SecretRef  string          `json:"secretRef"`
	Timeout    string          `json:"timeout"`
	PassCreds  bool            `json:"passCredentials"`
}

func (m *ClientManager) ListFluxHelmRepositories(contextName, namespace string) []FluxHelmRepositoryInfo {
	objs := listCachedCRs(m, contextName, fluxHelmRepositoryGVR, namespace)
	out := make([]FluxHelmRepositoryInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractFluxHelmRepository(obj))
	}
	sortFluxRows(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetFluxHelmRepository(ctx context.Context, contextName, namespace, name string) (*FluxHelmRepositoryDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(fluxHelmRepositoryGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	info := extractFluxHelmRepository(obj)
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeout")
	passCreds, _, _ := unstructured.NestedBool(obj.Object, "spec", "passCredentials")
	secretRef := ""
	if sr, _, _ := unstructured.NestedMap(obj.Object, "spec", "secretRef"); sr != nil {
		secretRef, _ = sr["name"].(string)
	}
	return &FluxHelmRepositoryDetail{
		FluxHelmRepositoryInfo: info,
		Conditions:             extractFluxConditions(obj),
		SecretRef:              secretRef,
		Timeout:                timeout,
		PassCreds:              passCreds,
	}, nil
}

func extractFluxHelmRepository(obj *unstructured.Unstructured) FluxHelmRepositoryInfo {
	conds := extractFluxConditions(obj)
	readyStatus, readyMsg := readySummary(conds)
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	url, _, _ := unstructured.NestedString(obj.Object, "spec", "url")
	repoType, _, _ := unstructured.NestedString(obj.Object, "spec", "type")
	provider, _, _ := unstructured.NestedString(obj.Object, "spec", "provider")
	interval, _, _ := unstructured.NestedString(obj.Object, "spec", "interval")
	// OCI HelmRepositories never produce an artifact (the chart pull happens
	// on HelmRelease side), so this field is only meaningful for the
	// default-type Helm index path.
	revision, _, _ := unstructured.NestedString(obj.Object, "status", "artifact", "revision")
	if repoType == "" {
		repoType = "default"
	}
	return FluxHelmRepositoryInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Ready:     readyStatus,
		Status:    readyMsg,
		Suspended: suspended,
		Type:      repoType,
		Provider:  provider,
		URL:       url,
		Revision:  revision,
		Interval:  interval,
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// OCIRepository
// ---------------------------------------------------------------------------

// FluxOCIRepositoryInfo is the row shape for the OCIRepositories view.
// Unlike HelmRepository, an OCIRepository always produces an artifact —
// surface the resolved digest/tag/semver in Revision so the user can tell
// whether source-controller already pulled the new push.
type FluxOCIRepositoryInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	Status    string `json:"status"`
	Suspended bool   `json:"suspended"`
	URL       string `json:"url"`
	Ref       string `json:"ref"`
	Provider  string `json:"provider"`
	Revision  string `json:"revision"`
	Interval  string `json:"interval"`
	CreatedAt string `json:"createdAt"`
}

type FluxOCIRepositoryDetail struct {
	FluxOCIRepositoryInfo
	Conditions  []FluxCondition `json:"conditions"`
	SecretRef   string          `json:"secretRef"`
	ServiceAcct string          `json:"serviceAccountName"`
	CertSecret  string          `json:"certSecretRef"`
	Timeout     string          `json:"timeout"`
	Verify      string          `json:"verify"`
	Insecure    bool            `json:"insecure"`
}

func (m *ClientManager) ListFluxOCIRepositories(contextName, namespace string) []FluxOCIRepositoryInfo {
	objs := listCachedCRs(m, contextName, fluxOCIRepositoryGVR, namespace)
	out := make([]FluxOCIRepositoryInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractFluxOCIRepository(obj))
	}
	sortFluxRows(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetFluxOCIRepository(ctx context.Context, contextName, namespace, name string) (*FluxOCIRepositoryDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(fluxOCIRepositoryGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	info := extractFluxOCIRepository(obj)
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeout")
	insecure, _, _ := unstructured.NestedBool(obj.Object, "spec", "insecure")
	sa, _, _ := unstructured.NestedString(obj.Object, "spec", "serviceAccountName")
	secretRef := ""
	if sr, _, _ := unstructured.NestedMap(obj.Object, "spec", "secretRef"); sr != nil {
		secretRef, _ = sr["name"].(string)
	}
	certSecret := ""
	if cs, _, _ := unstructured.NestedMap(obj.Object, "spec", "certSecretRef"); cs != nil {
		certSecret, _ = cs["name"].(string)
	}
	verifyMode, _, _ := unstructured.NestedString(obj.Object, "spec", "verify", "provider")
	return &FluxOCIRepositoryDetail{
		FluxOCIRepositoryInfo: info,
		Conditions:            extractFluxConditions(obj),
		SecretRef:             secretRef,
		ServiceAcct:           sa,
		CertSecret:            certSecret,
		Timeout:               timeout,
		Verify:                verifyMode,
		Insecure:              insecure,
	}, nil
}

func extractFluxOCIRepository(obj *unstructured.Unstructured) FluxOCIRepositoryInfo {
	conds := extractFluxConditions(obj)
	readyStatus, readyMsg := readySummary(conds)
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	url, _, _ := unstructured.NestedString(obj.Object, "spec", "url")
	provider, _, _ := unstructured.NestedString(obj.Object, "spec", "provider")
	interval, _, _ := unstructured.NestedString(obj.Object, "spec", "interval")
	revision, _, _ := unstructured.NestedString(obj.Object, "status", "artifact", "revision")
	return FluxOCIRepositoryInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Ready:     readyStatus,
		Status:    readyMsg,
		Suspended: suspended,
		URL:       url,
		Ref:       extractOCIRef(obj),
		Provider:  provider,
		Revision:  revision,
		Interval:  interval,
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// extractOCIRef collapses .spec.ref into a single human label. Like
// GitRepository's ref block, OCI accepts digest/semver/tag as alternative
// one-of fields — pick the most specific the CR actually carries.
func extractOCIRef(obj *unstructured.Unstructured) string {
	ref, _, _ := unstructured.NestedMap(obj.Object, "spec", "ref")
	if ref == nil {
		return ""
	}
	if v, _ := ref["digest"].(string); v != "" {
		return "digest: " + v
	}
	if v, _ := ref["semver"].(string); v != "" {
		return "semver: " + v
	}
	if v, _ := ref["tag"].(string); v != "" {
		return "tag: " + v
	}
	return ""
}

// ---------------------------------------------------------------------------
// Bucket
// ---------------------------------------------------------------------------

// FluxBucketInfo is the row shape for the Buckets view. Buckets connect
// Flux to S3-API-compatible object storage (AWS S3, GCS via interop,
// MinIO, …) — Provider tells the operator which auth path was configured.
type FluxBucketInfo struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	Ready      string `json:"ready"`
	Status     string `json:"status"`
	Suspended  bool   `json:"suspended"`
	Provider   string `json:"provider"`
	BucketName string `json:"bucketName"`
	Endpoint   string `json:"endpoint"`
	Region     string `json:"region"`
	Revision   string `json:"revision"`
	Interval   string `json:"interval"`
	CreatedAt  string `json:"createdAt"`
}

type FluxBucketDetail struct {
	FluxBucketInfo
	Conditions []FluxCondition `json:"conditions"`
	SecretRef  string          `json:"secretRef"`
	Timeout    string          `json:"timeout"`
	Insecure   bool            `json:"insecure"`
	Prefix     string          `json:"prefix"`
}

func (m *ClientManager) ListFluxBuckets(contextName, namespace string) []FluxBucketInfo {
	objs := listCachedCRs(m, contextName, fluxBucketGVR, namespace)
	out := make([]FluxBucketInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractFluxBucket(obj))
	}
	sortFluxRows(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetFluxBucket(ctx context.Context, contextName, namespace, name string) (*FluxBucketDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(fluxBucketGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	info := extractFluxBucket(obj)
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeout")
	insecure, _, _ := unstructured.NestedBool(obj.Object, "spec", "insecure")
	prefix, _, _ := unstructured.NestedString(obj.Object, "spec", "prefix")
	secretRef := ""
	if sr, _, _ := unstructured.NestedMap(obj.Object, "spec", "secretRef"); sr != nil {
		secretRef, _ = sr["name"].(string)
	}
	return &FluxBucketDetail{
		FluxBucketInfo: info,
		Conditions:     extractFluxConditions(obj),
		SecretRef:      secretRef,
		Timeout:        timeout,
		Insecure:       insecure,
		Prefix:         prefix,
	}, nil
}

func extractFluxBucket(obj *unstructured.Unstructured) FluxBucketInfo {
	conds := extractFluxConditions(obj)
	readyStatus, readyMsg := readySummary(conds)
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	provider, _, _ := unstructured.NestedString(obj.Object, "spec", "provider")
	bucket, _, _ := unstructured.NestedString(obj.Object, "spec", "bucketName")
	endpoint, _, _ := unstructured.NestedString(obj.Object, "spec", "endpoint")
	region, _, _ := unstructured.NestedString(obj.Object, "spec", "region")
	interval, _, _ := unstructured.NestedString(obj.Object, "spec", "interval")
	revision, _, _ := unstructured.NestedString(obj.Object, "status", "artifact", "revision")
	if provider == "" {
		provider = "generic"
	}
	return FluxBucketInfo{
		Name:       obj.GetName(),
		Namespace:  obj.GetNamespace(),
		Ready:      readyStatus,
		Status:     readyMsg,
		Suspended:  suspended,
		Provider:   provider,
		BucketName: bucket,
		Endpoint:   endpoint,
		Region:     region,
		Revision:   revision,
		Interval:   interval,
		CreatedAt:  obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// Provider (notification.toolkit)
// ---------------------------------------------------------------------------

// FluxProviderInfo is the row shape for the Providers view. Address is
// elided when it comes from a Secret — leaks of webhook URLs (Slack
// incoming hook = bearer auth) are a bad surprise to discover from a
// screenshot.
type FluxProviderInfo struct {
	Name              string `json:"name"`
	Namespace         string `json:"namespace"`
	Ready             string `json:"ready"`
	Status            string `json:"status"`
	Suspended         bool   `json:"suspended"`
	Type              string `json:"type"`
	Channel           string `json:"channel"`
	Username          string `json:"username"`
	Address           string `json:"address"`
	AddressFromSecret bool   `json:"addressFromSecret"`
	CreatedAt         string `json:"createdAt"`
}

type FluxProviderDetail struct {
	FluxProviderInfo
	Conditions []FluxCondition `json:"conditions"`
	SecretRef  string          `json:"secretRef"`
	CertSecret string          `json:"certSecretRef"`
	Proxy      string          `json:"proxy"`
	Timeout    string          `json:"timeout"`
}

func (m *ClientManager) ListFluxProviders(contextName, namespace string) []FluxProviderInfo {
	objs := listCachedCRs(m, contextName, fluxProviderGVR, namespace)
	out := make([]FluxProviderInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractFluxProvider(obj))
	}
	sortFluxRows(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetFluxProvider(ctx context.Context, contextName, namespace, name string) (*FluxProviderDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(fluxProviderGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	info := extractFluxProvider(obj)
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeout")
	proxy, _, _ := unstructured.NestedString(obj.Object, "spec", "proxy")
	secretRef := ""
	if sr, _, _ := unstructured.NestedMap(obj.Object, "spec", "secretRef"); sr != nil {
		secretRef, _ = sr["name"].(string)
	}
	certSecret := ""
	if cs, _, _ := unstructured.NestedMap(obj.Object, "spec", "certSecretRef"); cs != nil {
		certSecret, _ = cs["name"].(string)
	}
	return &FluxProviderDetail{
		FluxProviderInfo: info,
		Conditions:       extractFluxConditions(obj),
		SecretRef:        secretRef,
		CertSecret:       certSecret,
		Proxy:            proxy,
		Timeout:          timeout,
	}, nil
}

func extractFluxProvider(obj *unstructured.Unstructured) FluxProviderInfo {
	conds := extractFluxConditions(obj)
	readyStatus, readyMsg := readySummary(conds)
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	provType, _, _ := unstructured.NestedString(obj.Object, "spec", "type")
	channel, _, _ := unstructured.NestedString(obj.Object, "spec", "channel")
	username, _, _ := unstructured.NestedString(obj.Object, "spec", "username")
	address, _, _ := unstructured.NestedString(obj.Object, "spec", "address")
	// When address comes from a Secret the spec.address is empty; surface
	// that explicitly so the UI can render "(from Secret)" instead of an
	// awkward dash.
	fromSecret := false
	if address == "" {
		if sr, _, _ := unstructured.NestedMap(obj.Object, "spec", "secretRef"); sr != nil {
			fromSecret = true
		}
	}
	return FluxProviderInfo{
		Name:              obj.GetName(),
		Namespace:         obj.GetNamespace(),
		Ready:             readyStatus,
		Status:            readyMsg,
		Suspended:         suspended,
		Type:              provType,
		Channel:           channel,
		Username:          username,
		Address:           address,
		AddressFromSecret: fromSecret,
		CreatedAt:         obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// Alert (notification.toolkit)
// ---------------------------------------------------------------------------

// FluxAlertInfo is the row shape for the Alerts view. EventSources is
// flattened into a Sources string so the table cell stays scannable; the
// detail dialog still renders the full list.
type FluxAlertInfo struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	Ready       string `json:"ready"`
	Status      string `json:"status"`
	Suspended   bool   `json:"suspended"`
	Provider    string `json:"provider"`
	Severity    string `json:"severity"`
	Summary     string `json:"summary"`
	Sources     string `json:"sources"`
	SourceCount int    `json:"sourceCount"`
	CreatedAt   string `json:"createdAt"`
}

// FluxAlertSource is one row of .spec.eventSources, kept verbose enough
// for the detail dialog to render a clickable cross-reference to the
// referenced Flux resource.
type FluxAlertSource struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

type FluxAlertDetail struct {
	FluxAlertInfo
	Conditions    []FluxCondition   `json:"conditions"`
	EventSources  []FluxAlertSource `json:"eventSources"`
	InclusionList []string          `json:"inclusionList"`
	ExclusionList []string          `json:"exclusionList"`
	EventMetadata map[string]string `json:"eventMetadata"`
}

func (m *ClientManager) ListFluxAlerts(contextName, namespace string) []FluxAlertInfo {
	objs := listCachedCRs(m, contextName, fluxAlertGVR, namespace)
	out := make([]FluxAlertInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractFluxAlert(obj))
	}
	sortFluxRows(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetFluxAlert(ctx context.Context, contextName, namespace, name string) (*FluxAlertDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(fluxAlertGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	info := extractFluxAlert(obj)
	inclusion, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "inclusionList")
	exclusion, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "exclusionList")
	metadata, _, _ := unstructured.NestedStringMap(obj.Object, "spec", "eventMetadata")
	if metadata == nil {
		metadata = map[string]string{}
	}
	return &FluxAlertDetail{
		FluxAlertInfo: info,
		Conditions:    extractFluxConditions(obj),
		EventSources:  extractFluxAlertSources(obj, obj.GetNamespace()),
		InclusionList: append([]string{}, inclusion...),
		ExclusionList: append([]string{}, exclusion...),
		EventMetadata: metadata,
	}, nil
}

func extractFluxAlert(obj *unstructured.Unstructured) FluxAlertInfo {
	conds := extractFluxConditions(obj)
	readyStatus, readyMsg := readySummary(conds)
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	provider := ""
	if pr, _, _ := unstructured.NestedMap(obj.Object, "spec", "providerRef"); pr != nil {
		provider, _ = pr["name"].(string)
	}
	severity, _, _ := unstructured.NestedString(obj.Object, "spec", "eventSeverity")
	summary, _, _ := unstructured.NestedString(obj.Object, "spec", "summary")
	sources := extractFluxAlertSources(obj, obj.GetNamespace())
	return FluxAlertInfo{
		Name:        obj.GetName(),
		Namespace:   obj.GetNamespace(),
		Ready:       readyStatus,
		Status:      readyMsg,
		Suspended:   suspended,
		Provider:    provider,
		Severity:    severity,
		Summary:     summary,
		Sources:     summariseAlertSources(sources),
		SourceCount: len(sources),
		CreatedAt:   obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

func extractFluxAlertSources(obj *unstructured.Unstructured, parentNS string) []FluxAlertSource {
	raw, found, _ := unstructured.NestedSlice(obj.Object, "spec", "eventSources")
	if !found {
		return []FluxAlertSource{}
	}
	out := make([]FluxAlertSource, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		kind, _ := m["kind"].(string)
		name, _ := m["name"].(string)
		ns, _ := m["namespace"].(string)
		if ns == "" {
			ns = parentNS
		}
		if kind == "" {
			continue
		}
		out = append(out, FluxAlertSource{Kind: kind, Name: name, Namespace: ns})
	}
	return out
}

// summariseAlertSources collapses up to two sources into "Kind/name" form
// for the list cell. More than two get a "+N more" suffix so the column
// stays a fixed width.
func summariseAlertSources(sources []FluxAlertSource) string {
	if len(sources) == 0 {
		return ""
	}
	out := ""
	for i, s := range sources {
		if i >= 2 {
			break
		}
		if out != "" {
			out += ", "
		}
		label := s.Kind
		if s.Name != "" && s.Name != "*" {
			label += "/" + s.Name
		} else {
			label += "/*"
		}
		out += label
	}
	if len(sources) > 2 {
		out += fmt.Sprintf(" +%d more", len(sources)-2)
	}
	return out
}

// ---------------------------------------------------------------------------
// Receiver (notification.toolkit)
// ---------------------------------------------------------------------------

// FluxReceiverInfo is the row shape for the Receivers view. WebhookPath
// is the cluster-internal URL fragment notification-controller publishes
// once the receiver is reconciled — the user combines it with their
// ingress hostname to form the public webhook URL.
type FluxReceiverInfo struct {
	Name          string `json:"name"`
	Namespace     string `json:"namespace"`
	Ready         string `json:"ready"`
	Status        string `json:"status"`
	Suspended     bool   `json:"suspended"`
	Type          string `json:"type"`
	WebhookPath   string `json:"webhookPath"`
	ResourceCount int    `json:"resourceCount"`
	SecretRef     string `json:"secretRef"`
	CreatedAt     string `json:"createdAt"`
}

type FluxReceiverDetail struct {
	FluxReceiverInfo
	Conditions []FluxCondition   `json:"conditions"`
	Events     []string          `json:"events"`
	Resources  []FluxAlertSource `json:"resources"`
	Interval   string            `json:"interval"`
}

func (m *ClientManager) ListFluxReceivers(contextName, namespace string) []FluxReceiverInfo {
	objs := listCachedCRs(m, contextName, fluxReceiverGVR, namespace)
	out := make([]FluxReceiverInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractFluxReceiver(obj))
	}
	sortFluxRows(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetFluxReceiver(ctx context.Context, contextName, namespace, name string) (*FluxReceiverDetail, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(fluxReceiverGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	info := extractFluxReceiver(obj)
	events, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "events")
	interval, _, _ := unstructured.NestedString(obj.Object, "spec", "interval")
	return &FluxReceiverDetail{
		FluxReceiverInfo: info,
		Conditions:       extractFluxConditions(obj),
		Events:           append([]string{}, events...),
		Resources:        extractFluxReceiverResources(obj, obj.GetNamespace()),
		Interval:         interval,
	}, nil
}

func extractFluxReceiver(obj *unstructured.Unstructured) FluxReceiverInfo {
	conds := extractFluxConditions(obj)
	readyStatus, readyMsg := readySummary(conds)
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	recvType, _, _ := unstructured.NestedString(obj.Object, "spec", "type")
	// .status.webhookPath shows up only after the receiver becomes Ready
	// — that's by design: the path is derived from the receiver's token.
	webhookPath, _, _ := unstructured.NestedString(obj.Object, "status", "webhookPath")
	secretRef := ""
	if sr, _, _ := unstructured.NestedMap(obj.Object, "spec", "secretRef"); sr != nil {
		secretRef, _ = sr["name"].(string)
	}
	resources := extractFluxReceiverResources(obj, obj.GetNamespace())
	return FluxReceiverInfo{
		Name:          obj.GetName(),
		Namespace:     obj.GetNamespace(),
		Ready:         readyStatus,
		Status:        readyMsg,
		Suspended:     suspended,
		Type:          recvType,
		WebhookPath:   webhookPath,
		ResourceCount: len(resources),
		SecretRef:     secretRef,
		CreatedAt:     obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// extractFluxReceiverResources reuses FluxAlertSource — the shape is
// identical (kind+name+namespace), and rendering them through the same
// component avoids two near-identical UI pieces.
func extractFluxReceiverResources(obj *unstructured.Unstructured, parentNS string) []FluxAlertSource {
	raw, found, _ := unstructured.NestedSlice(obj.Object, "spec", "resources")
	if !found {
		return []FluxAlertSource{}
	}
	out := make([]FluxAlertSource, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		kind, _ := m["kind"].(string)
		name, _ := m["name"].(string)
		ns, _ := m["namespace"].(string)
		if ns == "" {
			ns = parentNS
		}
		if kind == "" {
			continue
		}
		out = append(out, FluxAlertSource{Kind: kind, Name: name, Namespace: ns})
	}
	return out
}

// ---------------------------------------------------------------------------
// Mutations: Reconcile, Suspend/Resume
// ---------------------------------------------------------------------------

// ReconcileFluxResource flips the reconcile.fluxcd.io/requestedAt annotation
// to a fresh RFC3339Nano timestamp. The Flux controller for this kind picks
// it up on its next sync poll (interval ≤ a few seconds typically) and
// reconciles immediately, the same path `flux reconcile <kind> <name>` uses.
func (m *ClientManager) ReconcileFluxResource(ctx context.Context, contextName, kind, namespace, name string) error {
	gvr, ok := fluxKindGVR[kind]
	if !ok {
		return fmt.Errorf("unsupported flux kind: %q", kind)
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}
	patch := map[string]any{
		"metadata": map[string]any{
			"annotations": map[string]any{
				fluxReconcileAnnotation: time.Now().UTC().Format(time.RFC3339Nano),
			},
		},
	}
	body, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	_, err = dyn.Resource(gvr).Namespace(namespace).Patch(
		ctx, name, types.MergePatchType, body, metav1.PatchOptions{},
	)
	if err != nil {
		return fmt.Errorf("reconcile %s %s/%s: %w", kind, namespace, name, err)
	}
	return nil
}

// SetFluxResourceSuspended toggles .spec.suspend. While suspended, the
// controller leaves the resource alone — useful for taking a managed
// workload offline temporarily without deleting the Flux object.
func (m *ClientManager) SetFluxResourceSuspended(ctx context.Context, contextName, kind, namespace, name string, suspended bool) error {
	gvr, ok := fluxKindGVR[kind]
	if !ok {
		return fmt.Errorf("unsupported flux kind: %q", kind)
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}
	patch := map[string]any{
		"spec": map[string]any{
			"suspend": suspended,
		},
	}
	body, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	_, err = dyn.Resource(gvr).Namespace(namespace).Patch(
		ctx, name, types.MergePatchType, body, metav1.PatchOptions{},
	)
	if err != nil {
		return fmt.Errorf("suspend %s %s/%s: %w", kind, namespace, name, err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// sortFluxRows sorts any of the FluxXxxInfo slices by (namespace, name).
// Defined as a generic helper instead of a per-type sort so the list
// methods stay short and consistent.
func sortFluxRows[T any](rows []T, key func(int) (string, string)) {
	sort.Slice(rows, func(i, j int) bool {
		ni, nameI := key(i)
		nj, nameJ := key(j)
		if ni != nj {
			return ni < nj
		}
		return nameI < nameJ
	})
}

// extractFluxConditions reads .status.conditions[] in the metav1.Condition
// shape every Flux CR uses. Returns an empty slice (not nil) so the JSON
// encoder never emits `null` for a missing status block.
func extractFluxConditions(obj *unstructured.Unstructured) []FluxCondition {
	raw, found, _ := unstructured.NestedSlice(obj.Object, "status", "conditions")
	if !found {
		return []FluxCondition{}
	}
	out := make([]FluxCondition, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		t, _ := m["type"].(string)
		s, _ := m["status"].(string)
		if t == "" || s == "" {
			continue
		}
		reason, _ := m["reason"].(string)
		message, _ := m["message"].(string)
		ts, _ := m["lastTransitionTime"].(string)
		out = append(out, FluxCondition{Type: t, Status: s, Reason: reason, Message: message, LastTransitionTime: ts})
	}
	return out
}

// readySummary returns the (status, message) pair of the Ready condition,
// which Flux conventionally uses as the user-facing health signal. Empty
// strings when there's no Ready condition yet (resource still being
// reconciled the first time).
func readySummary(conds []FluxCondition) (status, message string) {
	for _, c := range conds {
		if c.Type == "Ready" {
			msg := c.Message
			if msg == "" {
				msg = c.Reason
			}
			return c.Status, msg
		}
	}
	return "", ""
}

// formatSourceRef collapses a Flux sourceRef block (kind+name, optionally
// namespace) into the "Kind/namespace/name" or "Kind/name" form Klustr
// renders inline. parentNS is the namespace of the owning CR — Flux treats
// sourceRef.namespace as a same-namespace default when omitted.
func formatSourceRef(ref map[string]any, parentNS string) string {
	if ref == nil {
		return ""
	}
	kind, _ := ref["kind"].(string)
	name, _ := ref["name"].(string)
	ns, _ := ref["namespace"].(string)
	if name == "" {
		return ""
	}
	if ns == "" || ns == parentNS {
		if kind == "" {
			return name
		}
		return kind + "/" + name
	}
	if kind == "" {
		return ns + "/" + name
	}
	return kind + "/" + ns + "/" + name
}

// extractDependsOnRefs flattens .spec.dependsOn[] entries (which are
// objects with name + optional namespace) into "namespace/name" strings.
// Returns empty slice (not nil) for JSON friendliness.
func extractDependsOnRefs(raw []any) []string {
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		if name == "" {
			continue
		}
		ns, _ := m["namespace"].(string)
		if ns == "" {
			out = append(out, name)
		} else {
			out = append(out, ns+"/"+name)
		}
	}
	return out
}
