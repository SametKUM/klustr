package kube

import (
	"context"
	"testing"

	authv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	clienttesting "k8s.io/client-go/testing"
)

// fakeSAR builds a fake clientset whose SelfSubjectAccessReview reactor
// answers from a (verb, resource, namespace) → allowed map.
func fakeSAR(t *testing.T, allow map[string]bool) *fake.Clientset {
	t.Helper()
	cs := fake.NewClientset()
	cs.PrependReactor("create", "selfsubjectaccessreviews",
		func(action clienttesting.Action) (bool, runtime.Object, error) {
			create := action.(clienttesting.CreateAction)
			ssar := create.GetObject().(*authv1.SelfSubjectAccessReview)
			r := ssar.Spec.ResourceAttributes
			key := r.Verb + ":" + r.Resource + ":" + r.Namespace
			result := &authv1.SelfSubjectAccessReview{
				Spec:   ssar.Spec,
				Status: authv1.SubjectAccessReviewStatus{Allowed: allow[key]},
			}
			return true, result, nil
		})
	return cs
}

func TestDiscoverAccess(t *testing.T) {
	cases := []struct {
		name        string
		allow       map[string]bool
		candidateNS string
		expect      map[string]KindAccess
	}{
		{
			name: "admin: everything cluster-wide",
			allow: map[string]bool{
				"list:pods:":     true,
				"list:secrets:":  true,
				"list:services:": true,
			},
			expect: map[string]KindAccess{
				"Pod":     {Mode: AccessCluster},
				"Secret":  {Mode: AccessCluster},
				"Service": {Mode: AccessCluster},
			},
		},
		{
			name: "prod-secret-reader: only secrets in prod",
			allow: map[string]bool{
				"list:namespaces:":  true,
				"list:secrets:prod": true,
			},
			candidateNS: "prod",
			expect: map[string]KindAccess{
				"Namespace": {Mode: AccessCluster},
				"Secret":    {Mode: AccessNamespaced, Namespace: "prod"},
				"Pod":       {Mode: AccessDenied},
				"ConfigMap": {Mode: AccessDenied},
			},
		},
		{
			name: "team-a-dev: many kinds in team-a, namespace list cluster-wide",
			allow: map[string]bool{
				"list:namespaces:":        true,
				"list:pods:team-a":        true,
				"list:deployments:team-a": true,
				"list:secrets:team-a":     true,
				"list:configmaps:team-a":  true,
			},
			candidateNS: "team-a",
			expect: map[string]KindAccess{
				"Namespace":  {Mode: AccessCluster},
				"Pod":        {Mode: AccessNamespaced, Namespace: "team-a"},
				"Deployment": {Mode: AccessNamespaced, Namespace: "team-a"},
				"Secret":     {Mode: AccessNamespaced, Namespace: "team-a"},
				"ConfigMap":  {Mode: AccessNamespaced, Namespace: "team-a"},
				"Service":    {Mode: AccessDenied},
			},
		},
		{
			name: "pods-only: cluster-wide pods + namespaces, nothing else",
			allow: map[string]bool{
				"list:pods:":       true,
				"list:namespaces:": true,
			},
			expect: map[string]KindAccess{
				"Pod":       {Mode: AccessCluster},
				"Namespace": {Mode: AccessCluster},
				"Secret":    {Mode: AccessDenied},
				"Service":   {Mode: AccessDenied},
			},
		},
		{
			name: "cluster-scoped resource has no namespaced fallback",
			allow: map[string]bool{
				// User cannot list nodes cluster-wide, can list pods in `team-a`
				// — but Node is cluster-scoped so even a candidateNS does not
				// help. Discovery should mark it Denied, not Namespaced.
				"list:pods:team-a": true,
			},
			candidateNS: "team-a",
			expect: map[string]KindAccess{
				"Node": {Mode: AccessDenied},
				"Pod":  {Mode: AccessNamespaced, Namespace: "team-a"},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cs := fakeSAR(t, tc.allow)
			got := discoverAccess(context.Background(), cs, tc.candidateNS)
			for kind, want := range tc.expect {
				gotAccess := got.For(kind)
				if gotAccess.Mode != want.Mode {
					t.Errorf("%s: mode want %v got %v", kind, want.Mode, gotAccess.Mode)
				}
				if gotAccess.Namespace != want.Namespace {
					t.Errorf("%s: ns want %q got %q", kind, want.Namespace, gotAccess.Namespace)
				}
			}
		})
	}
}

func TestContextAccessHelpers(t *testing.T) {
	a := &contextAccess{kinds: map[string]KindAccess{
		"Pod":    {Mode: AccessCluster},
		"Secret": {Mode: AccessNamespaced, Namespace: "prod"},
		"Node":   {Mode: AccessDenied},
	}}
	if !a.HasAnyClusterWide() {
		t.Error("expected HasAnyClusterWide true")
	}
	if ns := a.ScopedNamespace(); ns != "prod" {
		t.Errorf("ScopedNamespace want prod got %q", ns)
	}

	empty := &contextAccess{kinds: map[string]KindAccess{
		"Pod": {Mode: AccessDenied},
	}}
	if empty.HasAnyClusterWide() {
		t.Error("expected HasAnyClusterWide false")
	}
	if ns := empty.ScopedNamespace(); ns != "" {
		t.Errorf("ScopedNamespace want empty got %q", ns)
	}

	var nilA *contextAccess
	if !nilA.HasAnyClusterWide() {
		t.Error("nil access should behave as cluster-wide admin")
	}
	if got := nilA.For("Pod").Mode; got != AccessCluster {
		t.Errorf("nil access For: want AccessCluster got %v", got)
	}
}

// Suppress unused import warning when authv1 metadata fields shrink.
var _ = metav1.CreateOptions{}
