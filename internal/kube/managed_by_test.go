package kube

import (
	"context"
	"encoding/json"
	"path/filepath"
	"reflect"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	metadatafake "k8s.io/client-go/metadata/fake"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

var (
	argoAppTestGVR       = argoApplicationGR.WithVersion("v1alpha1")
	fluxKustomizeTestGVR = fluxKustomizationGR.WithVersion("v1")
	fluxHelmTestGVR      = fluxHelmReleaseGR.WithVersion("v2")
)

var managedByCRDs = []fakeCRD{
	{gvr: argoAppTestGVR, kind: "Application", namespaced: true},
	{gvr: fluxKustomizeTestGVR, kind: "Kustomization", namespaced: true},
	{gvr: fluxHelmTestGVR, kind: "HelmRelease", namespaced: true},
}

func managedDeployment(t *testing.T, labels, annotations string) *unstructured.Unstructured {
	t.Helper()
	return mustUnstructured(t, `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
  labels: {`+labels+`}
  annotations: {`+annotations+`}
spec:
  replicas: 2
`)
}

// argoApp is an Application named name in namespace that lists the shop/api
// Deployment when lists is set.
func argoApp(t *testing.T, namespace, name, server string, lists bool, syncPolicy string) *unstructured.Unstructured {
	t.Helper()
	resources := "[]"
	if lists {
		resources = "[{group: apps, version: v1, kind: Deployment, namespace: shop, name: api, status: Synced}]"
	}
	return mustUnstructured(t, `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: `+name+`
  namespace: `+namespace+`
spec:
  destination: {server: "`+server+`", namespace: shop}
  syncPolicy: {`+syncPolicy+`}
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers: [/spec/replicas]
    - kind: ConfigMap
      jsonPointers: [/data]
    - group: "*"
      kind: Deployment
      name: other
      jqPathExpressions: [.spec.template]
    - group: apps
      kind: "*"
      jqPathExpressions: [.metadata.labels.team, '.spec.template.spec.containers[] | select(.name == "x")']
status:
  resources: `+resources+`
`)
}

func resourceManagersFor(t *testing.T, m *ClientManager) []ResourceManager {
	t.Helper()
	got, err := m.GetResourceManagers(context.Background(), "ctx", "Deployment", "shop", "api")
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func TestResourceManagersUnmanaged(t *testing.T) {
	m, _ := fakeCRDManager(t, managedByCRDs, managedDeployment(t, "", ""))
	got := resourceManagersFor(t, m)
	if data, _ := json.Marshal(got); string(data) != "[]" {
		t.Fatalf("unmanaged resource = %s, want []", data)
	}
}

func TestResourceManagersHelm(t *testing.T) {
	m, _ := fakeCRDManager(t, nil, managedDeployment(t,
		`app.kubernetes.io/managed-by: Helm, app.kubernetes.io/instance: api`,
		`meta.helm.sh/release-name: api, meta.helm.sh/release-namespace: releases`))
	got := resourceManagersFor(t, m)
	want := []ResourceManager{{
		Tool: "helm", Kind: "HelmRelease", Context: "ctx", Namespace: "releases", Name: "api",
		Resolved: true, IgnoredFields: []string{},
	}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("managers = %+v, want %+v", got, want)
	}
}

func TestResourceManagersReadsMetadataOnly(t *testing.T) {
	scheme := metadatafake.NewTestScheme()
	if err := metav1.AddMetaToScheme(scheme); err != nil {
		t.Fatal(err)
	}
	secret := &metav1.PartialObjectMetadata{
		TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Secret"},
		ObjectMeta: metav1.ObjectMeta{Namespace: "shop", Name: "creds", Annotations: map[string]string{
			helmReleaseNameAnnotation: "api",
		}},
	}
	m, dyn := fakeCRDManager(t, nil)
	m.watchers["ctx"].meta = metadatafake.NewSimpleMetadataClient(scheme, secret)
	got, err := m.GetResourceManagers(context.Background(), "ctx", "Secret", "shop", "creds")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Tool != "helm" || got[0].Namespace != "shop" {
		t.Fatalf("managers = %+v, want the api release in shop", got)
	}
	if len(dyn.Actions()) != 0 {
		t.Fatalf("read the full object: %v", dyn.Actions())
	}
}

func TestResourceManagersArgoTrackingID(t *testing.T) {
	const tracking = `argocd.argoproj.io/tracking-id: "shop-api:apps/Deployment:shop/api"`
	cases := []struct {
		name       string
		annotation string
		app        *unstructured.Unstructured
		want       *ResourceManager
	}{
		{
			name:       "self-heal",
			annotation: tracking,
			app:        argoApp(t, "argocd", "shop-api", "https://kubernetes.default.svc", true, "automated: {selfHeal: true, prune: true}"),
			want: &ResourceManager{
				Tool: "argocd", Kind: "Application", Group: "argoproj.io", Resource: "applications",
				Context: "ctx", Namespace: "argocd", Name: "shop-api", Resolved: true,
				RevertsDrift: true, RevertReason: "self-heal is on",
				IgnoredFields: []string{"/spec/replicas", "/metadata/labels/team"},
			},
		},
		{
			name:       "auto-sync without self-heal",
			annotation: tracking,
			app:        argoApp(t, "argocd", "shop-api", "https://kubernetes.default.svc", true, "automated: {prune: true}"),
			want: &ResourceManager{
				Tool: "argocd", Kind: "Application", Group: "argoproj.io", Resource: "applications",
				Context: "ctx", Namespace: "argocd", Name: "shop-api", Resolved: true,
				IgnoredFields: []string{"/spec/replicas", "/metadata/labels/team"},
			},
		},
		{
			name:       "automation disabled",
			annotation: tracking,
			app:        argoApp(t, "argocd", "shop-api", "https://kubernetes.default.svc", true, "automated: {enabled: false, selfHeal: true}"),
			want: &ResourceManager{
				Tool: "argocd", Kind: "Application", Group: "argoproj.io", Resource: "applications",
				Context: "ctx", Namespace: "argocd", Name: "shop-api", Resolved: true,
				IgnoredFields: []string{"/spec/replicas", "/metadata/labels/team"},
			},
		},
		{
			name:       "app in another namespace",
			annotation: `argocd.argoproj.io/tracking-id: "team-a_shop-api:apps/Deployment:shop/api"`,
			app:        argoApp(t, "team-a", "shop-api", "https://kubernetes.default.svc", true, "automated: {selfHeal: true}"),
			want: &ResourceManager{
				Tool: "argocd", Kind: "Application", Group: "argoproj.io", Resource: "applications",
				Context: "ctx", Namespace: "team-a", Name: "shop-api", Resolved: true,
				RevertsDrift: true, RevertReason: "self-heal is on",
				IgnoredFields: []string{"/spec/replicas", "/metadata/labels/team"},
			},
		},
		{
			name:       "not reconciled yet",
			annotation: tracking,
			app:        argoApp(t, "argocd", "shop-api", "https://kubernetes.default.svc", false, ""),
			want: &ResourceManager{
				Tool: "argocd", Kind: "Application", Group: "argoproj.io", Resource: "applications",
				Context: "ctx", Namespace: "argocd", Name: "shop-api", Resolved: true,
				IgnoredFields: []string{"/spec/replicas", "/metadata/labels/team"},
			},
		},
		{
			name:       "application not found",
			annotation: tracking,
			want: &ResourceManager{
				Tool: "argocd", Kind: "Application", Group: "argoproj.io", Resource: "applications",
				Name: "shop-api", IgnoredFields: []string{},
			},
		},
		{
			// A manifest copied from another object keeps its tracking-id;
			// Argo CD does not treat the copy as its own.
			name:       "tracking-id of another object",
			annotation: `argocd.argoproj.io/tracking-id: "shop-api:apps/Deployment:shop/web"`,
			app:        argoApp(t, "argocd", "shop-api", "https://kubernetes.default.svc", true, "automated: {selfHeal: true}"),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			objs := []runtime.Object{managedDeployment(t, "", tc.annotation)}
			if tc.app != nil {
				objs = append(objs, tc.app)
			}
			m, _ := fakeCRDManager(t, managedByCRDs, objs...)
			got := resourceManagersFor(t, m)
			if tc.want == nil {
				if len(got) != 0 {
					t.Fatalf("managers = %+v, want none", got)
				}
				return
			}
			if len(got) != 1 || !reflect.DeepEqual(got[0], *tc.want) {
				t.Fatalf("managers = %+v\nwant %+v", got, *tc.want)
			}
		})
	}
}

func TestResourceManagersArgoLabelTracking(t *testing.T) {
	const label = `app.kubernetes.io/instance: shop-api`
	t.Run("helm instance label", func(t *testing.T) {
		// An Application of that name that does not list the object is not
		// its owner: Helm sets the same label to the release name.
		m, _ := fakeCRDManager(t, managedByCRDs,
			managedDeployment(t, label, ""),
			argoApp(t, "argocd", "shop-api", "https://kubernetes.default.svc", false, "automated: {selfHeal: true}"))
		if got := resourceManagersFor(t, m); len(got) != 0 {
			t.Fatalf("managers = %+v, want none", got)
		}
	})
	t.Run("listed by the application", func(t *testing.T) {
		m, _ := fakeCRDManager(t, managedByCRDs,
			managedDeployment(t, label, ""),
			argoApp(t, "argocd", "shop-api", "https://kubernetes.default.svc", true, "automated: {selfHeal: true}"))
		got := resourceManagersFor(t, m)
		if len(got) != 1 || got[0].Name != "shop-api" || !got[0].RevertsDrift {
			t.Fatalf("managers = %+v, want shop-api with self-heal", got)
		}
	})
}

// A central Argo CD deploys to clusters that do not run it: the Application
// lives in another watched context.
func TestResourceManagersArgoInAnotherContext(t *testing.T) {
	m, _ := fakeCRDManager(t, managedByCRDs[1:], managedDeployment(t, "",
		`argocd.argoproj.io/tracking-id: "shop-api:apps/Deployment:shop/api"`))
	devops, _ := fakeCRDManager(t, managedByCRDs[:1],
		argoApp(t, "argocd", "shop-api", "https://dev.example.com", true, "automated: {selfHeal: true}"))
	m.watchers["devops"] = devops.watchers["ctx"]

	got := resourceManagersFor(t, m)
	if len(got) != 1 || got[0].Context != "devops" || got[0].Namespace != "argocd" || !got[0].Resolved || !got[0].RevertsDrift {
		t.Fatalf("managers = %+v, want shop-api in devops with self-heal", got)
	}
}

// Two contexts can reach one cluster, say a namespace-scoped one that cannot
// read Applications and an admin one: an in-cluster Application read through
// the second still owns what the first shows.
func TestResourceManagersArgoInClusterThroughAnotherContext(t *testing.T) {
	m, _ := fakeCRDManager(t, managedByCRDs[1:], managedDeployment(t, "",
		`argocd.argoproj.io/tracking-id: "shop-api:apps/Deployment:shop/api"`))
	admin, _ := fakeCRDManager(t, managedByCRDs[:1],
		argoApp(t, "argocd", "shop-api", "https://kubernetes.default.svc", true, "automated: {selfHeal: true}"))
	m.watchers["admin"] = admin.watchers["ctx"]
	config := clientcmdapi.Config{
		Clusters: map[string]*clientcmdapi.Cluster{
			"dev":       {Server: "https://dev.example.com"},
			"dev-again": {Server: "https://DEV.example.com/"},
		},
		Contexts: map[string]*clientcmdapi.Context{
			"ctx":   {Cluster: "dev"},
			"admin": {Cluster: "dev-again"},
		},
	}
	path := filepath.Join(t.TempDir(), "config")
	if err := clientcmd.WriteToFile(config, path); err != nil {
		t.Fatal(err)
	}
	m.rules = &clientcmd.ClientConfigLoadingRules{ExplicitPath: path}

	got := resourceManagersFor(t, m)
	if len(got) != 1 || got[0].Context != "admin" || !got[0].Resolved || !got[0].RevertsDrift {
		t.Fatalf("managers = %+v, want shop-api in admin with self-heal", got)
	}
}

func TestArgoOwnerScore(t *testing.T) {
	target := managedTarget{group: "apps", kind: "Deployment", namespace: "shop", name: "api"}
	cases := []struct {
		name         string
		server       string
		lists        bool
		sameContext  bool
		appServer    string
		targetServer string
		score        int
	}{
		{name: "listed, destination matches", server: "https://dev.example.com/", lists: true, targetServer: "https://DEV.example.com", score: argoScoreConfirmed},
		{name: "listed, other cluster", server: "https://prod.example.com", lists: true, targetServer: "https://dev.example.com", score: 0},
		{name: "listed, kubeconfig server unknown", server: "https://dev.example.com", lists: true, score: argoScoreListed},
		{name: "in-cluster from another context", server: "https://kubernetes.default.svc", lists: true, appServer: "https://devops.example.com", targetServer: "https://dev.example.com", score: 0},
		{name: "in-cluster from another context, servers unknown", server: "https://kubernetes.default.svc", lists: true, score: 0},
		{name: "in-cluster from another context on the same server", server: "https://kubernetes.default.svc", lists: true, appServer: "https://dev.example.com/", targetServer: "https://DEV.example.com", score: argoScoreConfirmed},
		{name: "in-cluster, same context", server: "https://kubernetes.default.svc", lists: true, sameContext: true, score: argoScoreConfirmed},
		{name: "not listed, same context", server: "https://kubernetes.default.svc", sameContext: true, score: argoScoreNameOnly},
		{name: "not listed, other context", server: "https://dev.example.com", targetServer: "https://dev.example.com", score: 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := argoApp(t, "argocd", "shop-api", tc.server, tc.lists, "")
			clusters := argoClusters{appContext: "devops", appServer: tc.appServer, targetContext: "dev", targetServer: tc.targetServer}
			if tc.sameContext {
				clusters.appContext = "dev"
			}
			if got := argoOwnerScore(app, target, true, clusters); got != tc.score {
				t.Fatalf("score = %d, want %d", got, tc.score)
			}
		})
	}
}

func fluxKustomization(t *testing.T, spec string) *unstructured.Unstructured {
	t.Helper()
	return mustUnstructured(t, `
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata: {name: apps, namespace: flux-system}
spec: {`+spec+`}
`)
}

func TestResourceManagersFluxKustomization(t *testing.T) {
	const labels = `kustomize.toolkit.fluxcd.io/name: apps, kustomize.toolkit.fluxcd.io/namespace: flux-system`
	cases := []struct {
		name          string
		labels        string
		annotations   string
		kustomization *unstructured.Unstructured
		reverts       bool
		suspended     bool
		reason        string
	}{
		{name: "reconciling", kustomization: fluxKustomization(t, "interval: 10m"), reverts: true, reason: "it is reapplied every 10m"},
		{name: "suspended", kustomization: fluxKustomization(t, "interval: 10m, suspend: true"), suspended: true},
		{name: "reconcile disabled on the object", annotations: `kustomize.toolkit.fluxcd.io/reconcile: disabled`, kustomization: fluxKustomization(t, "interval: 10m")},
		{name: "reconcile disabled by label", labels: `kustomize.toolkit.fluxcd.io/reconcile: Disabled`, kustomization: fluxKustomization(t, "interval: 10m")},
		{name: "ssa IfNotPresent", annotations: `kustomize.toolkit.fluxcd.io/ssa: IfNotPresent`, kustomization: fluxKustomization(t, "interval: 10m")},
		{name: "ssa ignore in lower case", annotations: `kustomize.toolkit.fluxcd.io/ssa: ignore`, kustomization: fluxKustomization(t, "interval: 10m")},
		{name: "ssa set to another value", annotations: `kustomize.toolkit.fluxcd.io/ssa: Merge`, kustomization: fluxKustomization(t, "interval: 10m"), reverts: true, reason: "it is reapplied every 10m"},
		// The chip's Suspend/Resume action reads the owner's state, which an
		// opted-out object must still report.
		{name: "opted out, kustomization suspended", annotations: `kustomize.toolkit.fluxcd.io/ssa: Ignore`, kustomization: fluxKustomization(t, "interval: 10m, suspend: true"), suspended: true},
		{name: "kustomization unreadable", reverts: true, reason: "it is reapplied on every reconcile"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			objLabels := labels
			if tc.labels != "" {
				objLabels += ", " + tc.labels
			}
			objs := []runtime.Object{managedDeployment(t, objLabels, tc.annotations)}
			if tc.kustomization != nil {
				objs = append(objs, tc.kustomization)
			}
			m, _ := fakeCRDManager(t, managedByCRDs, objs...)
			got := resourceManagersFor(t, m)
			want := ResourceManager{
				Tool: "flux", Kind: "Kustomization", Group: fluxKustomizationGR.Group, Resource: fluxKustomizationGR.Resource,
				Context: "ctx", Namespace: "flux-system", Name: "apps", Resolved: true,
				Suspended: tc.suspended, RevertsDrift: tc.reverts, RevertReason: tc.reason, IgnoredFields: []string{},
			}
			if len(got) != 1 || !reflect.DeepEqual(got[0], want) {
				t.Fatalf("managers = %+v\nwant %+v", got, want)
			}
		})
	}
}

func TestResourceManagersFluxHelmRelease(t *testing.T) {
	release := mustUnstructured(t, `
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata: {name: api, namespace: flux-system}
spec:
  driftDetection:
    mode: enabled
    ignore:
      - paths: [/spec/replicas]
        target: {kind: Deployment}
      - paths: [/spec/template/metadata/annotations]
        target: {kind: Deployment, labelSelector: "tier=frontend"}
      - paths: [/data]
        target: {kind: ConfigMap}
      - paths: [/metadata/labels/team]
`)
	m, _ := fakeCRDManager(t, managedByCRDs,
		managedDeployment(t,
			`helm.toolkit.fluxcd.io/name: api, helm.toolkit.fluxcd.io/namespace: flux-system, tier: backend`,
			`meta.helm.sh/release-name: shop-api, meta.helm.sh/release-namespace: shop`),
		release)
	got := resourceManagersFor(t, m)
	want := []ResourceManager{
		{
			Tool: "flux", Kind: "HelmRelease", Group: fluxHelmReleaseGR.Group, Resource: fluxHelmReleaseGR.Resource,
			Context: "ctx", Namespace: "flux-system", Name: "api", Resolved: true,
			RevertsDrift: true, RevertReason: "drift detection is on",
			IgnoredFields: []string{"/spec/replicas", "/metadata/labels/team"},
		},
		{Tool: "helm", Kind: "HelmRelease", Context: "ctx", Namespace: "shop", Name: "shop-api", Resolved: true, IgnoredFields: []string{}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("managers = %+v\nwant %+v", got, want)
	}
}

func TestResourceManagersFluxHelmReleaseDriftExclusions(t *testing.T) {
	const owner = `helm.toolkit.fluxcd.io/name: api, helm.toolkit.fluxcd.io/namespace: flux-system`
	cases := []struct {
		name        string
		labels      string
		annotations string
		ignore      string
		reverts     bool
	}{
		{name: "drift detection on", reverts: true},
		{name: "object opts out by annotation", annotations: `helm.toolkit.fluxcd.io/driftDetection: disabled`},
		{name: "object opts out by label", labels: `helm.toolkit.fluxcd.io/driftDetection: Disabled`},
		{name: "whole document ignored", ignore: `[{paths: [""], target: {kind: Deployment}}]`},
		{name: "whole document ignored for every object", ignore: `[{paths: [""]}]`},
		{name: "whole document ignored for another kind", ignore: `[{paths: [""], target: {kind: StatefulSet}}]`, reverts: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ignore := tc.ignore
			if ignore == "" {
				ignore = "[]"
			}
			release := mustUnstructured(t, `
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata: {name: api, namespace: flux-system}
spec:
  driftDetection: {mode: enabled, ignore: `+ignore+`}
`)
			objLabels := owner
			if tc.labels != "" {
				objLabels += ", " + tc.labels
			}
			m, _ := fakeCRDManager(t, managedByCRDs, managedDeployment(t, objLabels, tc.annotations), release)
			got := resourceManagersFor(t, m)
			if len(got) != 1 || got[0].Tool != "flux" || got[0].RevertsDrift != tc.reverts {
				t.Fatalf("managers = %+v, want a HelmRelease that reverts drift: %v", got, tc.reverts)
			}
			if !tc.reverts && got[0].RevertReason != "" {
				t.Fatalf("revert reason = %q without a revert", got[0].RevertReason)
			}
		})
	}
}

func TestFluxSelectorMatches(t *testing.T) {
	target := managedTarget{
		group: "apps", version: "v1", kind: "Deployment", namespace: "shop", name: "api",
		labels: map[string]string{"tier": "backend"},
	}
	cases := []struct {
		name     string
		selector map[string]any
		want     bool
	}{
		{name: "empty", selector: map[string]any{}, want: true},
		{name: "kind alternation", selector: map[string]any{"kind": "(Deployment|StatefulSet)"}, want: true},
		{name: "name pattern", selector: map[string]any{"name": "ap.*"}, want: true},
		{name: "anchored at both ends", selector: map[string]any{"name": "ap"}, want: false},
		{name: "anchored alternation", selector: map[string]any{"kind": "Deploy|Stateful"}, want: false},
		{name: "namespace pattern", selector: map[string]any{"namespace": "sh.p"}, want: true},
		{name: "group", selector: map[string]any{"group": "apps"}, want: true},
		{name: "other group", selector: map[string]any{"group": "batch"}, want: false},
		{name: "version", selector: map[string]any{"version": "v1"}, want: true},
		{name: "other version", selector: map[string]any{"version": "v1beta1"}, want: false},
		{name: "invalid pattern", selector: map[string]any{"name": "("}, want: false},
		{name: "label selector", selector: map[string]any{"kind": "Deployment", "labelSelector": "tier=backend"}, want: true},
		{name: "other labels", selector: map[string]any{"labelSelector": "tier=frontend"}, want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := fluxSelectorMatches(tc.selector, target); got != tc.want {
				t.Fatalf("match = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestResourceManagersCustomResourceKind(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "example.com", Version: "v1", Resource: "widgets"}
	widget := mustUnstructured(t, `
apiVersion: example.com/v1
kind: Widget
metadata:
  name: w
  namespace: shop
  annotations: {argocd.argoproj.io/tracking-id: "widgets:example.com/Widget:shop/w"}
`)
	app := mustUnstructured(t, `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: {name: widgets, namespace: argocd}
spec: {destination: {server: "https://kubernetes.default.svc"}}
status:
  resources: [{group: example.com, kind: Widget, namespace: shop, name: w}]
`)
	m, _ := fakeCRDManager(t, append([]fakeCRD{{gvr: gvr, kind: "Widget", namespaced: true}}, managedByCRDs...), widget, app)
	got, err := m.GetResourceManagers(context.Background(), "ctx", "cr:example.com/widgets", "shop", "w")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Name != "widgets" || !got[0].Resolved {
		t.Fatalf("managers = %+v, want the widgets Application", got)
	}
}
