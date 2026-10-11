package kube

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/dynamicinformer"
)

func TestFluxImagePolicyRefsAndVersions(t *testing.T) {
	for _, tc := range []struct{ name, status, want, namespace string }{
		{"current", "latestRef:\n  name: registry.example:5000/app\n  tag: 2.1.0\n  digest: sha256:abc", "registry.example:5000/app:2.1.0@sha256:abc", "shared"},
		{"image-field", "latestRef:\n  image: registry.example:5000/app\n  tag: 2.1.0\n  digest: sha256:abc", "registry.example:5000/app:2.1.0@sha256:abc", "shared"},
		{"legacy", "latestImage: registry.example:5000/app:1.9.0", "registry.example:5000/app:1.9.0", ""},
		{"pending", "{}", "", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			obj := mustUnstructured(t, "apiVersion: image.toolkit.fluxcd.io/v1\nkind: ImagePolicy\nmetadata:\n  name: app\n  namespace: apps\nspec:\n  imageRepositoryRef:\n    name: images\n    namespace: "+tc.namespace+"\n  policy:\n    semver:\n      range: '>=1.0.0'\nstatus:\n"+indentFixture(tc.status))
			got := extractFluxImagePolicyDetail(obj)
			wantNS := tc.namespace
			if wantNS == "" {
				wantNS = "apps"
			}
			if got.LatestImage != tc.want || got.RepositoryNamespace != wantNS || got.RepositoryName != "images" {
				t.Fatalf("unexpected image reference: %+v", got)
			}
			if got.PolicyType != "semver" || got.PolicyValue != ">=1.0.0" || got.DigestReflectionPolicy != "Never" {
				t.Fatalf("unexpected policy: %+v", got)
			}
		})
	}
}

func TestFluxImagePolicyPreviousRef(t *testing.T) {
	for _, field := range []string{"name", "image"} {
		t.Run(field, func(t *testing.T) {
			obj := mustUnstructured(t, "apiVersion: image.toolkit.fluxcd.io/v1\nkind: ImagePolicy\nmetadata:\n  name: app\n  namespace: apps\nstatus:\n  observedPreviousRef:\n    "+field+": registry.example:5000/app\n    tag: 2.0.0\n    digest: sha256:previous")
			got := extractFluxImagePolicyDetail(obj)
			if got.PreviousImage != "registry.example:5000/app:2.0.0@sha256:previous" {
				t.Fatalf("unexpected previous image reference: %q", got.PreviousImage)
			}
		})
	}
}

func indentFixture(value string) string {
	return "  " + strings.ReplaceAll(value, "\n", "\n  ") + "\n"
}

func TestFluxImageRepositoryScanAndEmptyArrays(t *testing.T) {
	obj := mustUnstructured(t, `apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageRepository
metadata:
  name: app
  namespace: apps
spec:
  image: ghcr.io/example/app
  interval: 5m
  suspend: true
status:
  canonicalImageName: ghcr.io/example/app
  lastScanResult:
    tagCount: 42
    scanTime: "2026-10-11T12:00:00Z"
    latestTags: ["2.0.0", "1.9.0"]
  conditions:
    - type: Ready
      status: "False"
      reason: AuthenticationFailed
      message: registry authentication failed
`)
	got := extractFluxImageRepositoryDetail(obj)
	if got.TagCount != 42 || len(got.LatestTags) != 2 || !got.Suspended || got.Provider != "generic" {
		t.Fatalf("scan projection lost fields: %+v", got)
	}
	if got.Ready != "False" || got.Status != "registry authentication failed" {
		t.Fatalf("failure status lost: %+v", got)
	}
	empty := extractFluxImageRepositoryDetail(&unstructured.Unstructured{})
	if empty.Conditions == nil || empty.LatestTags == nil || empty.ExclusionList == nil {
		t.Fatal("missing status must serialize arrays as []")
	}
}

func TestFluxImageAutomationGitStatus(t *testing.T) {
	obj := mustUnstructured(t, `apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageUpdateAutomation
metadata:
  name: app-update
  namespace: apps
spec:
  sourceRef: {kind: GitRepository, name: app}
  interval: 10m
  git:
    checkout:
      ref: {branch: main}
    push: {branch: updates}
  update: {path: ./clusters, strategy: Setters}
status:
  lastPushCommit: abc123
  lastPushTime: "2026-10-11T12:00:00Z"
  lastAutomationRunTime: "2026-10-11T12:01:00Z"
  observedSourceRevision: main@sha1:def456
`)
	got := extractFluxImageUpdateAutomationDetail(obj)
	if got.SourceName != "app" || got.SourceKind != "GitRepository" || got.CheckoutBranch != "main" || got.PushBranch != "updates" {
		t.Fatalf("Git references lost: %+v", got)
	}
	if got.UpdatePath != "./clusters" || got.LastPushCommit != "abc123" || got.LastRunTime != "2026-10-11T12:01:00Z" || got.ObservedSourceRevision != "main@sha1:def456" {
		t.Fatalf("automation status lost: %+v", got)
	}
}

func TestFluxImageAutomationSourceNamespace(t *testing.T) {
	for _, version := range []string{"v1", "v1beta2"} {
		for _, namespace := range []string{"", "flux-system"} {
			t.Run(version+"/"+namespace, func(t *testing.T) {
				obj := mustUnstructured(t, "apiVersion: image.toolkit.fluxcd.io/"+version+"\nkind: ImageUpdateAutomation\nmetadata: {name: updates, namespace: apps}\nspec:\n  sourceRef: {name: fleet}")
				if namespace != "" {
					if err := unstructured.SetNestedField(obj.Object, namespace, "spec", "sourceRef", "namespace"); err != nil {
						t.Fatal(err)
					}
				}
				got := extractFluxImageUpdateAutomationDetail(obj)
				wantNamespace := namespace
				if wantNamespace == "" {
					wantNamespace = "apps"
				}
				if got.SourceNamespace != wantNamespace || got.SourceKind != "GitRepository" {
					t.Fatalf("source reference lost namespace or default kind: %+v", got)
				}
			})
		}
	}
}

func TestFluxImageDeleteAndYAMLUseDiscoveredVersion(t *testing.T) {
	for _, version := range []string{"v1", "v1beta2"} {
		for _, resource := range []struct{ kind, resource string }{
			{"ImageRepository", "imagerepositories"},
			{"ImagePolicy", "imagepolicies"},
			{"ImageUpdateAutomation", "imageupdateautomations"},
		} {
			for _, operation := range []string{"yaml", "delete"} {
				t.Run(version+"/"+resource.kind+"/"+operation, func(t *testing.T) {
					gvr := schema.GroupVersionResource{Group: fluxImageGroup, Version: version, Resource: resource.resource}
					obj := &unstructured.Unstructured{Object: map[string]any{
						"apiVersion": gvr.Group + "/" + gvr.Version, "kind": resource.kind,
						"metadata": map[string]any{"name": "app", "namespace": "apps"},
					}}
					m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: resource.kind, namespaced: true}}, obj)
					if operation == "yaml" {
						got, err := m.GetResourceYAML(context.Background(), "ctx", "Flux"+resource.kind, "apps", "app")
						if err != nil {
							t.Fatal(err)
						}
						if !strings.Contains(got, "apiVersion: "+gvr.Group+"/"+version) {
							t.Fatalf("YAML does not use the served version: %s", got)
						}
					} else if err := m.DeleteResource(context.Background(), "ctx", "Flux"+resource.kind, "apps", "app"); err != nil {
						t.Fatal(err)
					}
					for _, action := range dyn.Actions() {
						if action.GetResource() != gvr {
							t.Fatalf("operation used %v, want %v", action.GetResource(), gvr)
						}
					}
				})
			}
		}
	}
}

func TestFluxImageActionsUseDiscoveredVersion(t *testing.T) {
	for _, resource := range []struct{ kind, resource, version string }{
		{"ImageRepository", "imagerepositories", "v1beta2"},
		{"ImageUpdateAutomation", "imageupdateautomations", "v1beta2"},
		{"ImagePolicy", "imagepolicies", "v1"},
	} {
		t.Run(resource.kind, func(t *testing.T) {
			gvr := schema.GroupVersionResource{Group: fluxImageGroup, Version: resource.version, Resource: resource.resource}
			obj := &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": gvr.Group + "/" + gvr.Version, "kind": resource.kind,
				"metadata": map[string]any{"name": "app", "namespace": "apps"},
				"spec":     map[string]any{},
			}}
			m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: resource.kind, namespaced: true}}, obj)
			if err := m.SetFluxResourceSuspended(context.Background(), "ctx", "Flux"+resource.kind, "apps", "app", true); err != nil {
				t.Fatal(err)
			}
			got, err := dyn.Resource(gvr).Namespace("apps").Get(context.Background(), "app", metav1.GetOptions{})
			if err != nil {
				t.Fatal(err)
			}
			suspended, _, _ := unstructured.NestedBool(got.Object, "spec", "suspend")
			if !suspended {
				t.Fatal("suspend did not patch the served API")
			}
			if resource.kind != "ImagePolicy" {
				if err := m.ReconcileFluxResource(context.Background(), "ctx", "Flux"+resource.kind, "apps", "app"); err != nil {
					t.Fatal(err)
				}
				got, err = dyn.Resource(gvr).Namespace("apps").Get(context.Background(), "app", metav1.GetOptions{})
				if err != nil {
					t.Fatal(err)
				}
				if got.GetAnnotations()[fluxReconcileAnnotation] == "" {
					t.Fatal("reconcile annotation missing")
				}
			}
			m.readOnly = map[string]bool{"ctx": true}
			if err := m.SetFluxResourceSuspended(context.Background(), "ctx", "Flux"+resource.kind, "apps", "app", false); err == nil {
				t.Fatal("read-only context allowed a patch")
			}
		})
	}
}

func TestLegacyImagePolicyActionsDoNotWrite(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: fluxImageGroup, Version: "v1beta2", Resource: "imagepolicies"}
	m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "ImagePolicy", namespaced: true}})
	if err := m.SetFluxResourceSuspended(context.Background(), "ctx", "FluxImagePolicy", "apps", "app", true); err == nil {
		t.Fatal("legacy ImagePolicy must not receive an unsupported suspend field")
	}
	if err := m.ReconcileFluxResource(context.Background(), "ctx", "FluxImagePolicy", "apps", "app"); err == nil {
		t.Fatal("ImagePolicy reconcile must go through the referenced repository")
	}
	if len(dyn.Actions()) != 0 {
		t.Fatal("unsupported actions reached the Kubernetes API")
	}
}

func TestFluxImageListsUseServedCacheAndNamespaceSelection(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: fluxImageGroup, Version: "v1beta2", Resource: "imagerepositories"}
	m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "ImageRepository", namespaced: true}})
	w := m.watchers["ctx"].crd
	w.crFactory = dynamicinformer.NewDynamicSharedInformerFactory(dyn, 0)
	w.crWatches = map[schema.GroupVersionResource]bool{gvr: true}
	informer := w.crFactory.ForResource(gvr).Informer()
	for _, ns := range []string{"zeta", "alpha", "excluded"} {
		obj := &unstructured.Unstructured{Object: map[string]any{"apiVersion": gvr.Group + "/" + gvr.Version,
			"kind": "ImageRepository", "metadata": map[string]any{"name": "app", "namespace": ns}}}
		if err := informer.GetStore().Add(obj); err != nil {
			t.Fatal(err)
		}
	}
	rows := m.ListFluxImageRepositories("ctx", "zeta,alpha")
	if len(rows) != 2 || rows[0].Namespace != "alpha" || rows[1].Namespace != "zeta" {
		t.Fatalf("namespace selection/sorting wrong: %+v", rows)
	}
	if len(dyn.Actions()) != 0 {
		t.Fatal("list should read the informer cache")
	}
	if rows := m.ListFluxImageRepositories("missing", ""); rows == nil || len(rows) != 0 {
		t.Fatal("missing context must return []")
	}
}

func TestKarpenterEC2NodeClassResolution(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: karpenterAWSGroup, Version: "v1beta1", Resource: karpenterEC2NodeClassResource}
	obj := mustUnstructured(t, `apiVersion: karpenter.k8s.aws/v1beta1
kind: EC2NodeClass
metadata: {name: default}
spec:
  amiFamily: AL2023
  role: nodes
  subnetSelectorTerms:
    - tags: {environment: dev, team: platform}
    - id: subnet-explicit
  amiSelectorTerms:
    - alias: al2023@latest
status:
  subnets:
    - {id: subnet-a, zone: eu-central-1a}
  securityGroups:
    - {id: sg-a, name: workers}
  amis:
    - id: ami-a
      name: node-image
      requirements:
        - {key: karpenter.k8s.aws/instance-cpu, operator: In, values: ["2", "4"]}
    - id: ami-a
      name: node-image
      requirements:
        - {key: karpenter.k8s.aws/instance-cpu, operator: In, values: ["8"]}
  instanceProfile: resolved-profile
  conditions:
    - {type: Ready, status: "False", reason: AMIsNotReady, message: waiting for AMIs}
`)
	m, _ := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "EC2NodeClass"}}, obj)
	got, err := m.GetKarpenterEC2NodeClass(context.Background(), "ctx", "default")
	if err != nil {
		t.Fatal(err)
	}
	if got.SubnetCount != 1 || got.SecurityGroupCount != 1 || got.AMICount != 1 || got.Subnets[0].Zone != "eu-central-1a" {
		t.Fatalf("resolved resources lost: %+v", got)
	}
	if len(got.AMIs) != 2 || len(got.AMIs[0].Requirements) != 1 || len(got.AMIs[0].Requirements[0].Values) != 2 || got.AMIs[1].Requirements[0].Values[0] != "8" {
		t.Fatalf("AMI requirement sets must stay distinct: %+v", got.AMIs)
	}
	if got.Subnets[0].Requirements == nil {
		t.Fatal("absent requirements must serialize as []")
	}
	if got.Ready != "False" || got.Status != "waiting for AMIs" || got.ResolvedInstanceProfile != "resolved-profile" {
		t.Fatalf("readiness/profile lost: %+v", got)
	}
	if len(got.SubnetSelectors) != 2 || got.SubnetSelectors[0] != "tag:environment=dev, tag:team=platform" {
		t.Fatalf("selector OR terms must stay distinct: %+v", got.SubnetSelectors)
	}
	empty := &unstructured.Unstructured{}
	if extractKarpenterResolvedResources(empty, "amis") == nil || extractKarpenterSelectors(empty, "amiSelectorTerms") == nil {
		t.Fatal("empty arrays must be []")
	}
	data, err := json.Marshal(extractFluxImageRepositoryDetail(empty))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), ":null") {
		t.Fatalf("unexpected null arrays: %s", data)
	}
}

func TestKarpenterEC2NodeClassAMIFamily(t *testing.T) {
	for _, tc := range []struct{ name, family, alias, want string }{
		{"explicit", "AL2023", "", "AL2023"},
		{"custom-override", "Custom", "al2023@latest", "Custom"},
		{"al2", "", "al2@latest", "AL2"},
		{"al2023", "", "al2023@v20240625", "AL2023"},
		{"bottlerocket", "", "bottlerocket@latest", "Bottlerocket"},
		{"windows2019", "", "windows2019@latest", "Windows2019"},
		{"windows2022", "", "windows2022@latest", "Windows2022"},
		{"windows2025", "", "windows2025@latest", "Windows2025"},
		{"unknown", "", "unknown@latest", ""},
		{"missing", "", "", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			obj := mustUnstructured(t, "apiVersion: karpenter.k8s.aws/v1\nkind: EC2NodeClass\nmetadata: {name: workers}\nspec:\n  amiFamily: '"+tc.family+"'\n  amiSelectorTerms:\n    - alias: '"+tc.alias+"'")
			if got := extractKarpenterEC2NodeClass(obj).AMIFamily; got != tc.want {
				t.Fatalf("AMI family = %q, want %q", got, tc.want)
			}
		})
	}
}
