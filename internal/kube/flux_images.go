package kube

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const fluxImageGroup = "image.toolkit.fluxcd.io"

var (
	fluxImageRepositoryGVR       = schema.GroupVersionResource{Group: fluxImageGroup, Version: "v1", Resource: "imagerepositories"}
	fluxImagePolicyGVR           = schema.GroupVersionResource{Group: fluxImageGroup, Version: "v1", Resource: "imagepolicies"}
	fluxImageUpdateAutomationGVR = schema.GroupVersionResource{Group: fluxImageGroup, Version: "v1", Resource: "imageupdateautomations"}
)

type FluxImageStatus struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	Status    string `json:"status"`
	Suspended bool   `json:"suspended"`
	Interval  string `json:"interval"`
	CreatedAt string `json:"createdAt"`
}

type FluxImageRepositoryInfo struct {
	FluxImageStatus
	Image        string `json:"image"`
	Provider     string `json:"provider"`
	TagCount     int64  `json:"tagCount"`
	LastScanTime string `json:"lastScanTime"`
}

type FluxImageRepositoryDetail struct {
	FluxImageRepositoryInfo
	Conditions     []FluxCondition `json:"conditions"`
	CanonicalImage string          `json:"canonicalImage"`
	LatestTags     []string        `json:"latestTags"`
	ExclusionList  []string        `json:"exclusionList"`
	SecretRef      string          `json:"secretRef"`
	CertSecretRef  string          `json:"certSecretRef"`
	Insecure       bool            `json:"insecure"`
	Timeout        string          `json:"timeout"`
}

type FluxImagePolicyInfo struct {
	FluxImageStatus
	RepositoryName      string `json:"repositoryName"`
	RepositoryNamespace string `json:"repositoryNamespace"`
	PolicyType          string `json:"policyType"`
	PolicyValue         string `json:"policyValue"`
	LatestImage         string `json:"latestImage"`
	LatestTag           string `json:"latestTag"`
	LatestDigest        string `json:"latestDigest"`
}

type FluxImagePolicyDetail struct {
	FluxImagePolicyInfo
	Conditions             []FluxCondition `json:"conditions"`
	PreviousImage          string          `json:"previousImage"`
	FilterPattern          string          `json:"filterPattern"`
	FilterExtract          string          `json:"filterExtract"`
	DigestReflectionPolicy string          `json:"digestReflectionPolicy"`
}

type FluxImageUpdateAutomationInfo struct {
	FluxImageStatus
	SourceName      string `json:"sourceName"`
	SourceKind      string `json:"sourceKind"`
	SourceNamespace string `json:"sourceNamespace"`
	UpdatePath      string `json:"updatePath"`
	PushBranch      string `json:"pushBranch"`
	LastRunTime     string `json:"lastRunTime"`
	LastPushCommit  string `json:"lastPushCommit"`
	LastPushTime    string `json:"lastPushTime"`
}

type FluxImageUpdateAutomationDetail struct {
	FluxImageUpdateAutomationInfo
	Conditions             []FluxCondition `json:"conditions"`
	CheckoutBranch         string          `json:"checkoutBranch"`
	UpdateStrategy         string          `json:"updateStrategy"`
	ObservedSourceRevision string          `json:"observedSourceRevision"`
}

func extractFluxImageStatus(obj *unstructured.Unstructured) FluxImageStatus {
	ready, status := readySummary(extractFluxConditions(obj))
	suspended, _, _ := unstructured.NestedBool(obj.Object, "spec", "suspend")
	interval, _, _ := unstructured.NestedString(obj.Object, "spec", "interval")
	return FluxImageStatus{Name: obj.GetName(), Namespace: obj.GetNamespace(),
		Ready: ready, Status: status, Suspended: suspended, Interval: interval, CreatedAt: crCreatedAt(obj)}
}

func (m *ClientManager) getFluxImageResource(ctx context.Context, contextName string, gvr schema.GroupVersionResource, namespace, name string) (*unstructured.Unstructured, error) {
	served, ok := m.servedGVR(contextName, gvr.Group, gvr.Resource)
	if !ok {
		return nil, fmt.Errorf("flux %s CRD not found", gvr.Resource)
	}
	return m.crForDetail(ctx, contextName, served, namespace, name)
}

func extractFluxImageRepository(obj *unstructured.Unstructured) FluxImageRepositoryInfo {
	image, _, _ := unstructured.NestedString(obj.Object, "spec", "image")
	provider, _, _ := unstructured.NestedString(obj.Object, "spec", "provider")
	if provider == "" {
		provider = "generic"
	}
	count, _, _ := unstructured.NestedFieldNoCopy(obj.Object, "status", "lastScanResult", "tagCount")
	scanTime, _, _ := unstructured.NestedString(obj.Object, "status", "lastScanResult", "scanTime")
	return FluxImageRepositoryInfo{FluxImageStatus: extractFluxImageStatus(obj), Image: image,
		Provider: provider, TagCount: toInt64(count), LastScanTime: scanTime}
}

func extractFluxImageRepositoryDetail(obj *unstructured.Unstructured) *FluxImageRepositoryDetail {
	canonical, _, _ := unstructured.NestedString(obj.Object, "status", "canonicalImageName")
	tags, _, _ := unstructured.NestedStringSlice(obj.Object, "status", "lastScanResult", "latestTags")
	exclusions, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "exclusionList")
	timeout, _, _ := unstructured.NestedString(obj.Object, "spec", "timeout")
	insecure, _, _ := unstructured.NestedBool(obj.Object, "spec", "insecure")
	return &FluxImageRepositoryDetail{FluxImageRepositoryInfo: extractFluxImageRepository(obj),
		Conditions: extractFluxConditions(obj), CanonicalImage: canonical, LatestTags: append([]string{}, tags...),
		ExclusionList: append([]string{}, exclusions...), SecretRef: nestedRefName(obj, "spec", "secretRef"),
		CertSecretRef: nestedRefName(obj, "spec", "certSecretRef"), Timeout: timeout, Insecure: insecure}
}

func extractFluxImagePolicy(obj *unstructured.Unstructured) FluxImagePolicyInfo {
	repository := nestedRefName(obj, "spec", "imageRepositoryRef")
	namespace, _, _ := unstructured.NestedString(obj.Object, "spec", "imageRepositoryRef", "namespace")
	if namespace == "" {
		namespace = obj.GetNamespace()
	}
	policyType, policyValue := "", ""
	for _, rule := range []struct{ kind, field string }{{"semver", "range"}, {"alphabetical", "order"}, {"numerical", "order"}} {
		if _, found, _ := unstructured.NestedMap(obj.Object, "spec", "policy", rule.kind); found {
			policyType = rule.kind
			policyValue, _, _ = unstructured.NestedString(obj.Object, "spec", "policy", rule.kind, rule.field)
			if policyValue == "" && rule.kind != "semver" {
				policyValue = "asc"
			}
			break
		}
	}
	image, _, _ := unstructured.NestedString(obj.Object, "status", "latestRef", "name")
	if image == "" {
		image, _, _ = unstructured.NestedString(obj.Object, "status", "latestRef", "image")
	}
	tag, _, _ := unstructured.NestedString(obj.Object, "status", "latestRef", "tag")
	digest, _, _ := unstructured.NestedString(obj.Object, "status", "latestRef", "digest")
	latest := formatFluxImageRef(image, tag, digest)
	// Older image-reflector releases report a single latestImage string.
	if latest == "" {
		latest, _, _ = unstructured.NestedString(obj.Object, "status", "latestImage")
	}
	return FluxImagePolicyInfo{FluxImageStatus: extractFluxImageStatus(obj),
		RepositoryName: repository, RepositoryNamespace: namespace, PolicyType: policyType, PolicyValue: policyValue,
		LatestImage: latest, LatestTag: tag, LatestDigest: digest}
}

func extractFluxImagePolicyDetail(obj *unstructured.Unstructured) *FluxImagePolicyDetail {
	image, _, _ := unstructured.NestedString(obj.Object, "status", "observedPreviousRef", "name")
	if image == "" {
		image, _, _ = unstructured.NestedString(obj.Object, "status", "observedPreviousRef", "image")
	}
	tag, _, _ := unstructured.NestedString(obj.Object, "status", "observedPreviousRef", "tag")
	digest, _, _ := unstructured.NestedString(obj.Object, "status", "observedPreviousRef", "digest")
	previous := formatFluxImageRef(image, tag, digest)
	if previous == "" {
		previous, _, _ = unstructured.NestedString(obj.Object, "status", "observedPreviousImage")
	}
	pattern, _, _ := unstructured.NestedString(obj.Object, "spec", "filterTags", "pattern")
	extract, _, _ := unstructured.NestedString(obj.Object, "spec", "filterTags", "extract")
	reflection, _, _ := unstructured.NestedString(obj.Object, "spec", "digestReflectionPolicy")
	if reflection == "" {
		reflection = "Never"
	}
	return &FluxImagePolicyDetail{FluxImagePolicyInfo: extractFluxImagePolicy(obj),
		Conditions: extractFluxConditions(obj), PreviousImage: previous,
		FilterPattern: pattern, FilterExtract: extract, DigestReflectionPolicy: reflection}
}

func formatFluxImageRef(image, tag, digest string) string {
	if image == "" {
		return ""
	}
	if tag != "" {
		image += ":" + tag
	}
	if digest != "" {
		image += "@" + digest
	}
	return image
}

func extractFluxImageUpdateAutomation(obj *unstructured.Unstructured) FluxImageUpdateAutomationInfo {
	sourceName := nestedRefName(obj, "spec", "sourceRef")
	sourceKind, _, _ := unstructured.NestedString(obj.Object, "spec", "sourceRef", "kind")
	if sourceKind == "" {
		sourceKind = "GitRepository"
	}
	sourceNamespace, _, _ := unstructured.NestedString(obj.Object, "spec", "sourceRef", "namespace")
	if sourceNamespace == "" {
		sourceNamespace = obj.GetNamespace()
	}
	path, _, _ := unstructured.NestedString(obj.Object, "spec", "update", "path")
	branch, _, _ := unstructured.NestedString(obj.Object, "spec", "git", "push", "branch")
	lastRun, _, _ := unstructured.NestedString(obj.Object, "status", "lastAutomationRunTime")
	commit, _, _ := unstructured.NestedString(obj.Object, "status", "lastPushCommit")
	pushTime, _, _ := unstructured.NestedString(obj.Object, "status", "lastPushTime")
	return FluxImageUpdateAutomationInfo{FluxImageStatus: extractFluxImageStatus(obj),
		SourceName: sourceName, SourceKind: sourceKind, SourceNamespace: sourceNamespace, UpdatePath: path, PushBranch: branch,
		LastRunTime: lastRun, LastPushCommit: commit, LastPushTime: pushTime}
}

func extractFluxImageUpdateAutomationDetail(obj *unstructured.Unstructured) *FluxImageUpdateAutomationDetail {
	checkout, _, _ := unstructured.NestedString(obj.Object, "spec", "git", "checkout", "ref", "branch")
	strategy, _, _ := unstructured.NestedString(obj.Object, "spec", "update", "strategy")
	revision, _, _ := unstructured.NestedString(obj.Object, "status", "observedSourceRevision")
	return &FluxImageUpdateAutomationDetail{FluxImageUpdateAutomationInfo: extractFluxImageUpdateAutomation(obj),
		Conditions: extractFluxConditions(obj), CheckoutBranch: checkout, UpdateStrategy: strategy, ObservedSourceRevision: revision}
}

func (m *ClientManager) fluxActionGVR(contextName, kind string) (schema.GroupVersionResource, error) {
	gvr, ok := fluxKindGVR[kind]
	if !ok {
		return schema.GroupVersionResource{}, fmt.Errorf("unsupported flux kind: %q", kind)
	}
	if gvr.Group != fluxImageGroup {
		return gvr, nil
	}
	served, ok := m.servedGVR(contextName, gvr.Group, gvr.Resource)
	if !ok {
		return schema.GroupVersionResource{}, fmt.Errorf("flux %s CRD not found", gvr.Resource)
	}
	return served, nil
}

func (m *ClientManager) ListFluxImageRepositories(contextName, namespace string) []FluxImageRepositoryInfo {
	return listFluxRows(m, contextName, fluxImageRepositoryGVR, namespace, extractFluxImageRepository,
		func(r FluxImageRepositoryInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetFluxImageRepository(ctx context.Context, contextName, namespace, name string) (*FluxImageRepositoryDetail, error) {
	obj, err := m.getFluxImageResource(ctx, contextName, fluxImageRepositoryGVR, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractFluxImageRepositoryDetail(obj), nil
}

func (m *ClientManager) ListFluxImagePolicies(contextName, namespace string) []FluxImagePolicyInfo {
	return listFluxRows(m, contextName, fluxImagePolicyGVR, namespace, extractFluxImagePolicy,
		func(r FluxImagePolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetFluxImagePolicy(ctx context.Context, contextName, namespace, name string) (*FluxImagePolicyDetail, error) {
	obj, err := m.getFluxImageResource(ctx, contextName, fluxImagePolicyGVR, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractFluxImagePolicyDetail(obj), nil
}

func (m *ClientManager) ListFluxImageUpdateAutomations(contextName, namespace string) []FluxImageUpdateAutomationInfo {
	return listFluxRows(m, contextName, fluxImageUpdateAutomationGVR, namespace, extractFluxImageUpdateAutomation,
		func(r FluxImageUpdateAutomationInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetFluxImageUpdateAutomation(ctx context.Context, contextName, namespace, name string) (*FluxImageUpdateAutomationDetail, error) {
	obj, err := m.getFluxImageResource(ctx, contextName, fluxImageUpdateAutomationGVR, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractFluxImageUpdateAutomationDetail(obj), nil
}
