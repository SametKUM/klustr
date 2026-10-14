package kube

import (
	"context"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// The frontend starts every CR watch at the version the discovered CRD
// stores, so an integration that read at any other version would find no
// informer and render an empty list. Each case serves its kind at a version
// other than the current upstream one: older Karpenter, Flux and cert-manager
// installs store exactly these.
func TestIntegrationListsReadTheServedVersion(t *testing.T) {
	cases := []struct {
		gvr        schema.GroupVersionResource
		kind       string
		namespaced bool
		list       func(m *ClientManager) int
	}{
		{schema.GroupVersionResource{Group: "argoproj.io", Version: "v1beta1", Resource: "applications"}, "Application", true,
			func(m *ClientManager) int { return len(m.ListArgoApplications("ctx", "")) }},
		{schema.GroupVersionResource{Group: "argoproj.io", Version: "v1beta1", Resource: "appprojects"}, "AppProject", true,
			func(m *ClientManager) int { return len(m.ListArgoAppProjects("ctx", "")) }},
		{schema.GroupVersionResource{Group: "argoproj.io", Version: "v1beta1", Resource: "applicationsets"}, "ApplicationSet", true,
			func(m *ClientManager) int { return len(m.ListArgoApplicationSets("ctx", "")) }},
		{schema.GroupVersionResource{Group: "cert-manager.io", Version: "v1beta1", Resource: "certificates"}, "Certificate", true,
			func(m *ClientManager) int { return len(m.ListCertManagerCertificates("ctx", "")) }},
		{schema.GroupVersionResource{Group: "cert-manager.io", Version: "v1beta1", Resource: "issuers"}, "Issuer", true,
			func(m *ClientManager) int { return len(m.ListCertManagerIssuers("ctx", "")) }},
		{schema.GroupVersionResource{Group: "cert-manager.io", Version: "v1beta1", Resource: "clusterissuers"}, "ClusterIssuer", false,
			func(m *ClientManager) int { return len(m.ListCertManagerClusterIssuers("ctx")) }},
		{schema.GroupVersionResource{Group: "cert-manager.io", Version: "v1beta1", Resource: "certificaterequests"}, "CertificateRequest", true,
			func(m *ClientManager) int { return len(m.ListCertManagerCertificateRequests("ctx", "")) }},
		{schema.GroupVersionResource{Group: "acme.cert-manager.io", Version: "v1beta1", Resource: "orders"}, "Order", true,
			func(m *ClientManager) int { return len(m.ListCertManagerOrders("ctx", "")) }},
		{schema.GroupVersionResource{Group: "acme.cert-manager.io", Version: "v1beta1", Resource: "challenges"}, "Challenge", true,
			func(m *ClientManager) int { return len(m.ListCertManagerChallenges("ctx", "")) }},
		{schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1beta1", Resource: "nodepools"}, "NodePool", false,
			func(m *ClientManager) int { return len(m.ListKarpenterNodePools("ctx")) }},
		{schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1beta1", Resource: "nodeclaims"}, "NodeClaim", false,
			func(m *ClientManager) int { return len(m.ListKarpenterNodeClaims("ctx")) }},
		{schema.GroupVersionResource{Group: "kustomize.toolkit.fluxcd.io", Version: "v1beta2", Resource: "kustomizations"}, "Kustomization", true,
			func(m *ClientManager) int { return len(m.ListFluxKustomizations("ctx", "")) }},
		{schema.GroupVersionResource{Group: "helm.toolkit.fluxcd.io", Version: "v2beta2", Resource: "helmreleases"}, "HelmRelease", true,
			func(m *ClientManager) int { return len(m.ListFluxHelmReleases("ctx", "")) }},
		{schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "gitrepositories"}, "GitRepository", true,
			func(m *ClientManager) int { return len(m.ListFluxGitRepositories("ctx", "")) }},
		{schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "helmrepositories"}, "HelmRepository", true,
			func(m *ClientManager) int { return len(m.ListFluxHelmRepositories("ctx", "")) }},
		{schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "ocirepositories"}, "OCIRepository", true,
			func(m *ClientManager) int { return len(m.ListFluxOCIRepositories("ctx", "")) }},
		{schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "buckets"}, "Bucket", true,
			func(m *ClientManager) int { return len(m.ListFluxBuckets("ctx", "")) }},
		{schema.GroupVersionResource{Group: "notification.toolkit.fluxcd.io", Version: "v1beta2", Resource: "providers"}, "Provider", true,
			func(m *ClientManager) int { return len(m.ListFluxProviders("ctx", "")) }},
		{schema.GroupVersionResource{Group: "notification.toolkit.fluxcd.io", Version: "v1beta2", Resource: "alerts"}, "Alert", true,
			func(m *ClientManager) int { return len(m.ListFluxAlerts("ctx", "")) }},
		{schema.GroupVersionResource{Group: "notification.toolkit.fluxcd.io", Version: "v1beta2", Resource: "receivers"}, "Receiver", true,
			func(m *ClientManager) int { return len(m.ListFluxReceivers("ctx", "")) }},
	}
	for _, tc := range cases {
		t.Run(tc.gvr.String(), func(t *testing.T) {
			m, _ := fakeCRDManager(t, []fakeCRD{{gvr: tc.gvr, kind: tc.kind, namespaced: tc.namespaced}})
			obj := &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": tc.gvr.GroupVersion().String(),
				"kind":       tc.kind,
				"metadata":   map[string]any{"name": "one"},
			}}
			if tc.namespaced {
				obj.SetNamespace("apps")
			}
			startFakeCRWatch(t, m, tc.gvr, obj)
			if got := tc.list(m); got != 1 {
				t.Fatalf("list at served version %s returned %d rows, want 1", tc.gvr.Version, got)
			}
		})
	}
}

func TestArgoSyncPatchesTheServedVersion(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "argoproj.io", Version: "v1beta1", Resource: "applications"}
	app := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "argoproj.io/v1beta1",
		"kind":       "Application",
		"metadata":   map[string]any{"name": "web", "namespace": "argocd"},
	}}
	m, dyn := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "Application", namespaced: true}}, app)
	if err := m.SyncArgoApplication(context.Background(), "ctx", "argocd", "web", ArgoSyncOptions{}); err != nil {
		t.Fatal(err)
	}
	got, err := dyn.Resource(gvr).Namespace("argocd").Get(context.Background(), "web", metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if _, found, _ := unstructured.NestedMap(got.Object, "operation", "sync"); !found {
		t.Fatal("sync did not patch the served version")
	}
}

func TestIntegrationReadsReportAnAbsentCRD(t *testing.T) {
	m, dyn := fakeCRDManager(t, nil)
	if rows := m.ListArgoApplications("ctx", ""); rows == nil || len(rows) != 0 {
		t.Fatalf("absent CRD must list as [], got %#v", rows)
	}
	if _, err := m.GetCertManagerCertificate(context.Background(), "ctx", "apps", "web"); err == nil {
		t.Fatal("detail of an absent CRD must fail")
	}
	if err := m.RefreshArgoApplication(context.Background(), "ctx", "argocd", "web", ""); err == nil {
		t.Fatal("action on an absent CRD must fail")
	}
	if len(dyn.Actions()) != 0 {
		t.Fatal("absent CRD must not reach the API")
	}
}

func TestScaledObjectLookupUsesTheStartedVersion(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "keda.sh", Version: "v1beta1", Resource: "scaledobjects"}
	so := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "keda.sh/v1beta1",
		"kind":       "ScaledObject",
		"metadata":   map[string]any{"name": "worker", "namespace": "apps"},
	}}
	m, _ := fakeCRDManager(t, []fakeCRD{{gvr: gvr, kind: "ScaledObject", namespaced: true}})
	startFakeCRWatch(t, m, gvr, so)
	if _, ok := m.watchers["ctx"].scaledObjectByName("apps", "worker"); !ok {
		t.Fatal("ScaledObject cached at the started version was not found")
	}
}
