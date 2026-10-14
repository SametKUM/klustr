package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// integrationResource is one CRD-backed resource with a dedicated view.
// integrationCatalog is the single list of them: the frontend's generated
// catalog (integration_catalog_test.go) derives from it, and every entry runs
// the same conformance checks against its fixture, a manifest shaped like what
// the upstream controller writes, at testdata/integrations/<group>/<resource>.yaml.
type integrationResource struct {
	// view is the frontend ResourceView id of the resource's list.
	view       string
	gr         schema.GroupResource
	kind       string
	namespaced bool
	// list calls the integration's list binding; namespace is "" for
	// cluster-scoped kinds.
	list func(m *ClientManager, namespace string) any
	// get calls the detail binding, nil when the integration has none (the
	// detail panel then shows the generic CR view).
	get func(m *ClientManager, namespace, name string) (any, error)
}

func listOf[T any](f func(m *ClientManager, namespace string) []T) func(*ClientManager, string) any {
	return func(m *ClientManager, namespace string) any { return f(m, namespace) }
}

func getOf[T any](f func(ctx context.Context, m *ClientManager, namespace, name string) (T, error)) func(*ClientManager, string, string) (any, error) {
	return func(m *ClientManager, namespace, name string) (any, error) {
		return f(context.Background(), m, namespace, name)
	}
}

func ciliumCatalogEntry(resource string) integrationResource {
	def := ciliumResources[resource]
	return integrationResource{
		view: resource, gr: ciliumGR(resource), kind: def.kind, namespaced: def.namespaced,
		list: listOf(func(m *ClientManager, ns string) []CiliumResourceInfo {
			return m.ListCiliumResources("ctx", resource, ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*CiliumResourceDetail, error) {
			return m.GetCiliumResource(ctx, "ctx", resource, ns, name)
		}),
	}
}

var integrationCatalog = append([]integrationResource{
	// Argo CD
	{view: "argocdapplications", gr: argoApplicationGR, kind: "Application", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []ArgoApplicationInfo { return m.ListArgoApplications("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (ArgoApplicationHealth, error) {
			return m.GetArgoApplicationHealth(ctx, "ctx", ns, name)
		})},
	{view: "argocdappprojects", gr: argoAppProjectGR, kind: "AppProject", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []ArgoAppProjectInfo { return m.ListArgoAppProjects("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*ArgoAppProjectDetail, error) {
			return m.GetArgoAppProject(ctx, "ctx", ns, name)
		})},
	{view: "argocdapplicationsets", gr: argoApplicationSetGR, kind: "ApplicationSet", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []ArgoApplicationSetInfo {
			return m.ListArgoApplicationSets("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*ArgoApplicationSetDetail, error) {
			return m.GetArgoApplicationSet(ctx, "ctx", ns, name)
		})},

	// cert-manager
	{view: "certmanagercertificates", gr: certManagerCertificateGR, kind: "Certificate", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []CertManagerCertificateInfo {
			return m.ListCertManagerCertificates("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*CertManagerCertificateDetail, error) {
			return m.GetCertManagerCertificate(ctx, "ctx", ns, name)
		})},
	{view: "certmanagerissuers", gr: certManagerIssuerGR, kind: "Issuer", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []CertManagerIssuerInfo { return m.ListCertManagerIssuers("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*CertManagerIssuerDetail, error) {
			return m.GetCertManagerIssuer(ctx, "ctx", ns, name)
		})},
	{view: "certmanagerclusterissuers", gr: certManagerClusterIssuerGR, kind: "ClusterIssuer",
		list: listOf(func(m *ClientManager, _ string) []CertManagerIssuerInfo {
			return m.ListCertManagerClusterIssuers("ctx")
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, _, name string) (*CertManagerIssuerDetail, error) {
			return m.GetCertManagerClusterIssuer(ctx, "ctx", name)
		})},
	{view: "certmanagercertificaterequests", gr: certManagerCertificateRequestGR, kind: "CertificateRequest", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []CertManagerCertificateRequestInfo {
			return m.ListCertManagerCertificateRequests("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*CertManagerCertificateRequestDetail, error) {
			return m.GetCertManagerCertificateRequest(ctx, "ctx", ns, name)
		})},
	{view: "certmanagerorders", gr: certManagerOrderGR, kind: "Order", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []CertManagerOrderInfo { return m.ListCertManagerOrders("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*CertManagerOrderDetail, error) {
			return m.GetCertManagerOrder(ctx, "ctx", ns, name)
		})},
	{view: "certmanagerchallenges", gr: certManagerChallengeGR, kind: "Challenge", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []CertManagerChallengeInfo {
			return m.ListCertManagerChallenges("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*CertManagerChallengeDetail, error) {
			return m.GetCertManagerChallenge(ctx, "ctx", ns, name)
		})},

	// Flux
	{view: "fluxkustomizations", gr: fluxKustomizationGR, kind: "Kustomization", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxKustomizationInfo { return m.ListFluxKustomizations("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxKustomizationDetail, error) {
			return m.GetFluxKustomization(ctx, "ctx", ns, name)
		})},
	{view: "fluxhelmreleases", gr: fluxHelmReleaseGR, kind: "HelmRelease", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxHelmReleaseInfo { return m.ListFluxHelmReleases("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxHelmReleaseDetail, error) {
			return m.GetFluxHelmRelease(ctx, "ctx", ns, name)
		})},
	{view: "fluxgitrepositories", gr: fluxGitRepositoryGR, kind: "GitRepository", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxGitRepositoryInfo { return m.ListFluxGitRepositories("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxGitRepositoryDetail, error) {
			return m.GetFluxGitRepository(ctx, "ctx", ns, name)
		})},
	{view: "fluxhelmrepositories", gr: fluxHelmRepositoryGR, kind: "HelmRepository", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxHelmRepositoryInfo {
			return m.ListFluxHelmRepositories("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxHelmRepositoryDetail, error) {
			return m.GetFluxHelmRepository(ctx, "ctx", ns, name)
		})},
	{view: "fluxocirepositories", gr: fluxOCIRepositoryGR, kind: "OCIRepository", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxOCIRepositoryInfo { return m.ListFluxOCIRepositories("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxOCIRepositoryDetail, error) {
			return m.GetFluxOCIRepository(ctx, "ctx", ns, name)
		})},
	{view: "fluxbuckets", gr: fluxBucketGR, kind: "Bucket", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxBucketInfo { return m.ListFluxBuckets("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxBucketDetail, error) {
			return m.GetFluxBucket(ctx, "ctx", ns, name)
		})},
	{view: "fluxproviders", gr: fluxProviderGR, kind: "Provider", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxProviderInfo { return m.ListFluxProviders("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxProviderDetail, error) {
			return m.GetFluxProvider(ctx, "ctx", ns, name)
		})},
	{view: "fluxalerts", gr: fluxAlertGR, kind: "Alert", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxAlertInfo { return m.ListFluxAlerts("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxAlertDetail, error) {
			return m.GetFluxAlert(ctx, "ctx", ns, name)
		})},
	{view: "fluxreceivers", gr: fluxReceiverGR, kind: "Receiver", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxReceiverInfo { return m.ListFluxReceivers("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxReceiverDetail, error) {
			return m.GetFluxReceiver(ctx, "ctx", ns, name)
		})},
	{view: "fluximagerepositories", gr: fluxImageRepositoryGR, kind: "ImageRepository", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxImageRepositoryInfo {
			return m.ListFluxImageRepositories("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxImageRepositoryDetail, error) {
			return m.GetFluxImageRepository(ctx, "ctx", ns, name)
		})},
	{view: "fluximagepolicies", gr: fluxImagePolicyGR, kind: "ImagePolicy", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxImagePolicyInfo { return m.ListFluxImagePolicies("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxImagePolicyDetail, error) {
			return m.GetFluxImagePolicy(ctx, "ctx", ns, name)
		})},
	{view: "fluximageupdateautomations", gr: fluxImageUpdateAutomationGR, kind: "ImageUpdateAutomation", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []FluxImageUpdateAutomationInfo {
			return m.ListFluxImageUpdateAutomations("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*FluxImageUpdateAutomationDetail, error) {
			return m.GetFluxImageUpdateAutomation(ctx, "ctx", ns, name)
		})},

	// Karpenter
	{view: "karpenternodepools", gr: karpenterNodePoolGR, kind: "NodePool",
		list: listOf(func(m *ClientManager, _ string) []KarpenterNodePoolInfo { return m.ListKarpenterNodePools("ctx") })},
	{view: "karpenternodeclaims", gr: karpenterNodeClaimGR, kind: "NodeClaim",
		list: listOf(func(m *ClientManager, _ string) []KarpenterNodeClaimInfo { return m.ListKarpenterNodeClaims("ctx") })},
	{view: "karpenterec2nodeclasses", gr: karpenterEC2NodeClassGR, kind: "EC2NodeClass",
		list: listOf(func(m *ClientManager, _ string) []KarpenterEC2NodeClassInfo {
			return m.ListKarpenterEC2NodeClasses("ctx")
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, _, name string) (*KarpenterEC2NodeClassDetail, error) {
			return m.GetKarpenterEC2NodeClass(ctx, "ctx", name)
		})},

	// Istio
	{view: "istiovirtualservices", gr: istioVirtualServiceGR, kind: "VirtualService", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []IstioVirtualServiceInfo {
			return m.ListIstioVirtualServices("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*IstioVirtualServiceDetail, error) {
			return m.GetIstioVirtualService(ctx, "ctx", ns, name)
		})},
	{view: "istiodestinationrules", gr: istioDestinationRuleGR, kind: "DestinationRule", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []IstioDestinationRuleInfo {
			return m.ListIstioDestinationRules("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*IstioDestinationRuleDetail, error) {
			return m.GetIstioDestinationRule(ctx, "ctx", ns, name)
		})},
	{view: "istiopeerauthentications", gr: istioPeerAuthenticationGR, kind: "PeerAuthentication", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []IstioPeerAuthenticationInfo {
			return m.ListIstioPeerAuthentications("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*IstioPeerAuthenticationDetail, error) {
			return m.GetIstioPeerAuthentication(ctx, "ctx", ns, name)
		})},

	// Tekton
	{view: "tektonpipelineruns", gr: tektonGR(tektonPipelineRunsResource), kind: "PipelineRun", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []TektonPipelineRunInfo { return m.ListTektonPipelineRuns("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*TektonPipelineRunDetail, error) {
			return m.GetTektonPipelineRun(ctx, "ctx", ns, name)
		})},
	{view: "tektontaskruns", gr: tektonGR(tektonTaskRunsResource), kind: "TaskRun", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []TektonTaskRunInfo { return m.ListTektonTaskRuns("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*TektonTaskRunDetail, error) {
			return m.GetTektonTaskRun(ctx, "ctx", ns, name)
		})},
	{view: "tektonpipelines", gr: tektonGR(tektonPipelinesResource), kind: "Pipeline", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []TektonPipelineInfo { return m.ListTektonPipelines("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*TektonPipelineDetail, error) {
			return m.GetTektonPipeline(ctx, "ctx", ns, name)
		})},
	{view: "tektontasks", gr: tektonGR(tektonTasksResource), kind: "Task", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []TektonTaskInfo { return m.ListTektonTasks("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*TektonTaskDetail, error) {
			return m.GetTektonTask(ctx, "ctx", ns, name)
		})},

	// Kyverno and policy reports
	{view: "kyvernoclusterpolicies", gr: kyvernoGR(kyvernoClusterPoliciesResource), kind: "ClusterPolicy",
		list: listOf(func(m *ClientManager, _ string) []KyvernoPolicyInfo { return m.ListKyvernoClusterPolicies("ctx") }),
		get: getOf(func(ctx context.Context, m *ClientManager, _, name string) (*KyvernoPolicyDetail, error) {
			return m.GetKyvernoClusterPolicy(ctx, "ctx", name)
		})},
	{view: "kyvernopolicies", gr: kyvernoGR(kyvernoPoliciesResource), kind: "Policy", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []KyvernoPolicyInfo { return m.ListKyvernoPolicies("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*KyvernoPolicyDetail, error) {
			return m.GetKyvernoPolicy(ctx, "ctx", ns, name)
		})},
	{view: "kyvernopolicyexceptions", gr: kyvernoGR(kyvernoPolicyExceptionsResource), kind: "PolicyException", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []KyvernoPolicyExceptionInfo {
			return m.ListKyvernoPolicyExceptions("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*KyvernoPolicyExceptionDetail, error) {
			return m.GetKyvernoPolicyException(ctx, "ctx", ns, name)
		})},
	{view: "kyvernovalidatingpolicies", gr: kyvernoCELGR(kyvernoValidatingPoliciesResource), kind: "ValidatingPolicy",
		list: listOf(func(m *ClientManager, _ string) []KyvernoValidatingPolicyInfo {
			return m.ListKyvernoValidatingPolicies("ctx")
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, _, name string) (*KyvernoValidatingPolicyDetail, error) {
			return m.GetKyvernoValidatingPolicy(ctx, "ctx", name)
		})},
	{view: "kyvernonamespacedvalidatingpolicies", gr: kyvernoCELGR(kyvernoNamespacedValidatingPoliciesResource), kind: "NamespacedValidatingPolicy", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []KyvernoValidatingPolicyInfo {
			return m.ListKyvernoNamespacedValidatingPolicies("ctx", ns)
		}),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*KyvernoValidatingPolicyDetail, error) {
			return m.GetKyvernoNamespacedValidatingPolicy(ctx, "ctx", ns, name)
		})},
	{view: "policyreports", gr: policyReportGR(policyReportsResource), kind: "PolicyReport", namespaced: true,
		list: listOf(func(m *ClientManager, ns string) []PolicyReportInfo { return m.ListPolicyReports("ctx", ns) }),
		get: getOf(func(ctx context.Context, m *ClientManager, ns, name string) (*PolicyReportDetail, error) {
			return m.GetPolicyReport(ctx, "ctx", ns, name)
		})},
	{view: "clusterpolicyreports", gr: policyReportGR(clusterPolicyReportsResource), kind: "ClusterPolicyReport",
		list: listOf(func(m *ClientManager, _ string) []PolicyReportInfo { return m.ListClusterPolicyReports("ctx") }),
		get: getOf(func(ctx context.Context, m *ClientManager, _, name string) (*PolicyReportDetail, error) {
			return m.GetClusterPolicyReport(ctx, "ctx", name)
		})},
}, ciliumCatalog()...)

// ciliumCatalog covers every Cilium resource, which share one generic
// list and detail binding.
func ciliumCatalog() []integrationResource {
	resources := make([]string, 0, len(ciliumResources))
	for resource := range ciliumResources {
		resources = append(resources, resource)
	}
	sort.Strings(resources)
	out := make([]integrationResource, 0, len(resources))
	for _, resource := range resources {
		out = append(out, ciliumCatalogEntry(resource))
	}
	return out
}

const conformanceFixtureDir = "testdata/integrations"

func conformanceFixturePath(gr schema.GroupResource) string {
	return filepath.Join(conformanceFixtureDir, gr.Group, gr.Resource+".yaml")
}

func loadConformanceFixture(t *testing.T, r integrationResource) *unstructured.Unstructured {
	t.Helper()
	data, err := os.ReadFile(conformanceFixturePath(r.gr))
	if err != nil {
		t.Fatalf("fixture missing: %v", err)
	}
	obj := mustUnstructured(t, string(data))
	gv, err := schema.ParseGroupVersion(obj.GetAPIVersion())
	if err != nil || gv.Group != r.gr.Group || gv.Version == "" {
		t.Fatalf("fixture apiVersion %q does not belong to %s", obj.GetAPIVersion(), r.gr.Group)
	}
	if obj.GetKind() != r.kind || obj.GetName() == "" {
		t.Fatalf("fixture must be a named %s, got kind %q name %q", r.kind, obj.GetKind(), obj.GetName())
	}
	if r.namespaced != (obj.GetNamespace() != "") {
		t.Fatalf("fixture namespace %q does not match namespaced=%v", obj.GetNamespace(), r.namespaced)
	}
	return obj
}

// atVersion returns a copy of obj served as gvr's version, in namespace when
// the kind is namespaced.
func atVersion(obj *unstructured.Unstructured, gvr schema.GroupVersionResource, namespace string) *unstructured.Unstructured {
	out := obj.DeepCopy()
	out.SetAPIVersion(gvr.GroupVersion().String())
	if namespace != "" {
		out.SetNamespace(namespace)
	}
	return out
}

// conformanceManager serves r's CRD at gvr, holds objs in the fake API and,
// when watch is set, in the started informer cache.
func conformanceManager(t *testing.T, r integrationResource, gvr schema.GroupVersionResource, watch bool, objs ...*unstructured.Unstructured) *ClientManager {
	t.Helper()
	raw := make([]runtime.Object, 0, len(objs))
	for _, obj := range objs {
		raw = append(raw, obj)
	}
	m, _ := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: r.kind, namespaced: r.namespaced}}, raw...)
	if watch {
		startFakeCRWatch(t, m, gvr, objs...)
	}
	return m
}

func rowCount(t *testing.T, rows any) int {
	t.Helper()
	v := reflect.ValueOf(rows)
	if v.Kind() != reflect.Slice {
		t.Fatalf("list returned %T, want a slice", rows)
	}
	if v.IsNil() {
		t.Fatal("list returned nil, which reaches the frontend as null")
	}
	return v.Len()
}

// assertNoNulls fails when value's JSON holds a null anywhere: the React
// bodies treat these fields as arrays and objects.
func assertNoNulls(t *testing.T, what string, value any) {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	var decoded any
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if path := firstNull(decoded, "$"); path != "" {
		t.Fatalf("%s has null at %s: %s", what, path, data)
	}
}

func firstNull(v any, path string) string {
	switch v := v.(type) {
	case nil:
		return path
	case map[string]any:
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			if p := firstNull(v[k], path+"."+k); p != "" {
				return p
			}
		}
	case []any:
		for i, item := range v {
			if p := firstNull(item, fmt.Sprintf("%s[%d]", path, i)); p != "" {
				return p
			}
		}
	}
	return ""
}

func TestIntegrationConformance(t *testing.T) {
	for _, r := range integrationCatalog {
		t.Run(r.gr.String(), func(t *testing.T) {
			fixture := loadConformanceFixture(t, r)
			fixtureGVR := schema.FromAPIVersionAndKind(fixture.GetAPIVersion(), r.kind).GroupVersion().WithResource(r.gr.Resource)
			ns := fixture.GetNamespace()

			// The frontend watches whatever version the CRD stores; a reader
			// pinned to one version lists nothing on the others.
			for _, gvr := range []schema.GroupVersionResource{fixtureGVR, r.gr.WithVersion("v9alpha1")} {
				t.Run("served "+gvr.Version, func(t *testing.T) {
					obj := atVersion(fixture, gvr, "")
					m := conformanceManager(t, r, gvr, true, obj)
					rows := r.list(m, ns)
					if n := rowCount(t, rows); n != 1 {
						t.Fatalf("list returned %d rows, want 1", n)
					}
					assertNoNulls(t, "list row", rows)
					if r.get == nil {
						return
					}
					detail, err := r.get(m, ns, obj.GetName())
					if err != nil {
						t.Fatalf("detail: %v", err)
					}
					assertNoNulls(t, "detail", detail)
				})
			}

			// An object the controller has not reconciled yet carries no spec
			// or status beyond what the user wrote; projections must not emit
			// nulls for it either.
			t.Run("sparse object", func(t *testing.T) {
				sparse := &unstructured.Unstructured{}
				sparse.SetAPIVersion(fixture.GetAPIVersion())
				sparse.SetKind(r.kind)
				sparse.SetName(fixture.GetName())
				sparse.SetNamespace(ns)
				m := conformanceManager(t, r, fixtureGVR, true, sparse)
				rows := r.list(m, ns)
				if n := rowCount(t, rows); n != 1 {
					t.Fatalf("list returned %d rows, want 1", n)
				}
				assertNoNulls(t, "list row", rows)
				if r.get == nil {
					return
				}
				detail, err := r.get(m, ns, sparse.GetName())
				if err != nil {
					t.Fatalf("detail: %v", err)
				}
				assertNoNulls(t, "detail", detail)
			})

			// A multi-namespace selection reaches the backend comma-separated.
			if r.namespaced {
				t.Run("namespace selection", func(t *testing.T) {
					objs := []*unstructured.Unstructured{
						atVersion(fixture, fixtureGVR, "zeta"),
						atVersion(fixture, fixtureGVR, "alpha"),
						atVersion(fixture, fixtureGVR, "excluded"),
					}
					m := conformanceManager(t, r, fixtureGVR, true, objs...)
					rows := reflect.ValueOf(r.list(m, "zeta,alpha"))
					if rows.Len() != 2 {
						t.Fatalf("list across two namespaces returned %d rows, want 2", rows.Len())
					}
					first := rows.Index(0)
					for first.Kind() == reflect.Pointer {
						first = first.Elem()
					}
					if got := first.FieldByName("Namespace"); got.IsValid() && got.String() != "alpha" {
						t.Fatalf("rows not sorted by namespace: first is %q", got.String())
					}
				})
			}

			// A denied or not yet started watch lists nothing rather than
			// failing, and a cluster without the CRD never reaches the API.
			t.Run("watch not started", func(t *testing.T) {
				m := conformanceManager(t, r, fixtureGVR, false, fixture)
				if n := rowCount(t, r.list(m, ns)); n != 0 {
					t.Fatalf("list without a started watch returned %d rows", n)
				}
			})
			t.Run("CRD absent", func(t *testing.T) {
				m, dyn := fakeCRDManager(t, nil, fixture)
				if n := rowCount(t, r.list(m, ns)); n != 0 {
					t.Fatalf("list without the CRD returned %d rows", n)
				}
				if r.get != nil {
					if _, err := r.get(m, ns, fixture.GetName()); err == nil {
						t.Fatal("detail without the CRD must fail")
					}
				}
				if len(dyn.Actions()) != 0 {
					t.Fatalf("absent CRD reached the API: %v", dyn.Actions())
				}
			})
		})
	}
}

// TestIntegrationFixturesHaveConformanceEntries keeps the fixture directory
// and the table in step: a fixture without an entry is never checked.
func TestIntegrationFixturesHaveConformanceEntries(t *testing.T) {
	covered := map[string]bool{}
	for _, r := range integrationCatalog {
		covered[conformanceFixturePath(r.gr)] = true
	}
	err := filepath.WalkDir(conformanceFixtureDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if !strings.HasSuffix(path, ".yaml") || !covered[path] {
			t.Errorf("%s has no conformance entry", path)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
