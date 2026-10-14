package kube

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestExtractFluxKustomization(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name":      "podinfo",
			"namespace": "flux-system",
		},
		"spec": map[string]any{
			"path":     "./kustomize",
			"interval": "10m0s",
			"suspend":  true,
			"sourceRef": map[string]any{
				"kind": "GitRepository",
				"name": "podinfo",
			},
		},
		"status": map[string]any{
			"lastAttemptedRevision": "main@sha1:abc",
			"lastAppliedRevision":   "main@sha1:abc",
			"conditions": []any{
				map[string]any{
					"type":    "Ready",
					"status":  "True",
					"reason":  "ReconciliationSucceeded",
					"message": "Applied revision: main@sha1:abc",
				},
			},
		},
	}}

	got := extractFluxKustomization(obj)
	if got.Name != "podinfo" || got.Namespace != "flux-system" {
		t.Errorf("identity wrong: %+v", got)
	}
	if got.Ready != "True" || got.Status != "Applied revision: main@sha1:abc" {
		t.Errorf("ready summary wrong: %+v", got)
	}
	if !got.Suspended {
		t.Errorf("suspend flag not propagated: %+v", got)
	}
	if got.SourceRef != "GitRepository/podinfo" {
		t.Errorf("sourceRef wrong: %q", got.SourceRef)
	}
	if got.Revision != "main@sha1:abc" || got.LastAppliedRevision != "main@sha1:abc" {
		t.Errorf("revision fields wrong: %+v", got)
	}
}

func TestExtractFluxKustomizationDefaults(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "bare", "namespace": "flux-system"},
		"spec":     map[string]any{},
	}}
	got := extractFluxKustomization(obj)
	if got.Ready != "" || got.Status != "" {
		t.Errorf("missing Ready condition should produce empty ready summary: %+v", got)
	}
	if got.Suspended {
		t.Error("missing suspend should default to false")
	}
}

func TestExtractFluxHelmReleaseChartTemplate(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "redis", "namespace": "infra"},
		"spec": map[string]any{
			"interval": "5m0s",
			"chart": map[string]any{
				"spec": map[string]any{
					"chart":   "redis",
					"version": "20.0.0",
					"sourceRef": map[string]any{
						"kind":      "HelmRepository",
						"name":      "bitnami",
						"namespace": "flux-system",
					},
				},
			},
		},
		"status": map[string]any{
			"lastAppliedRevision": "20.0.0",
			"conditions": []any{
				map[string]any{"type": "Ready", "status": "False", "reason": "InstallFailed", "message": "values mismatch"},
			},
		},
	}}
	got := extractFluxHelmRelease(obj)
	if got.Chart != "redis" || got.Version != "20.0.0" {
		t.Errorf("chart fields wrong: %+v", got)
	}
	if got.SourceRef != "HelmRepository/flux-system/bitnami" {
		t.Errorf("cross-namespace sourceRef wrong: %q", got.SourceRef)
	}
	if got.Ready != "False" || got.Status != "values mismatch" {
		t.Errorf("ready summary wrong: %+v", got)
	}
}

func TestExtractFluxHelmReleaseChartRef(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "demo", "namespace": "apps"},
		"spec": map[string]any{
			"chartRef": map[string]any{
				"kind": "OCIRepository",
				"name": "podinfo",
			},
		},
	}}
	got := extractFluxHelmRelease(obj)
	if got.Chart != "podinfo" {
		t.Errorf("chartRef.name should populate Chart: %+v", got)
	}
	if got.SourceRef != "OCIRepository/podinfo" {
		t.Errorf("chartRef sourceRef wrong: %q", got.SourceRef)
	}
}

func TestExtractFluxGitRepositoryRefPrecedence(t *testing.T) {
	cases := []struct {
		name string
		ref  map[string]any
		want string
	}{
		{"commit beats tag", map[string]any{"commit": "deadbeef", "tag": "v1"}, "commit: deadbeef"},
		{"semver beats tag", map[string]any{"semver": ">=1.2", "tag": "v1"}, "semver: >=1.2"},
		{"tag beats branch", map[string]any{"tag": "v1", "branch": "main"}, "tag: v1"},
		{"branch only", map[string]any{"branch": "main"}, "branch: main"},
		{"empty", map[string]any{}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			obj := &unstructured.Unstructured{Object: map[string]any{
				"spec": map[string]any{"ref": tc.ref},
			}}
			got := extractGitRef(obj)
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestFormatSourceRef(t *testing.T) {
	cases := []struct {
		name     string
		ref      map[string]any
		parentNS string
		want     string
	}{
		{"same namespace omitted", map[string]any{"kind": "GitRepository", "name": "podinfo", "namespace": "flux-system"}, "flux-system", "GitRepository/podinfo"},
		{"empty namespace omitted", map[string]any{"kind": "GitRepository", "name": "podinfo"}, "flux-system", "GitRepository/podinfo"},
		{"cross-namespace included", map[string]any{"kind": "HelmRepository", "name": "bitnami", "namespace": "infra"}, "apps", "HelmRepository/infra/bitnami"},
		{"missing kind", map[string]any{"name": "podinfo"}, "flux-system", "podinfo"},
		{"missing name → empty", map[string]any{"kind": "GitRepository"}, "flux-system", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := formatSourceRef(tc.ref, tc.parentNS)
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestExtractFluxHelmRepository(t *testing.T) {
	t.Run("OCI type with provider", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "bitnami", "namespace": "flux-system"},
			"spec": map[string]any{
				"type":     "oci",
				"url":      "oci://registry-1.docker.io/bitnamicharts",
				"interval": "10m",
				"provider": "generic",
			},
			"status": map[string]any{
				"conditions": []any{
					map[string]any{"type": "Ready", "status": "True", "reason": "Succeeded"},
				},
			},
		}}
		got := extractFluxHelmRepository(obj)
		if got.Type != "oci" || got.Provider != "generic" {
			t.Errorf("type/provider wrong: %+v", got)
		}
		if got.URL != "oci://registry-1.docker.io/bitnamicharts" {
			t.Errorf("url wrong: %q", got.URL)
		}
		if got.Ready != "True" {
			t.Errorf("ready wrong: %q", got.Ready)
		}
	})
	t.Run("default type when .spec.type empty", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "bare"},
			"spec":     map[string]any{"url": "https://charts.example.com"},
		}}
		got := extractFluxHelmRepository(obj)
		if got.Type != "default" {
			t.Errorf("missing .spec.type should default to %q, got %q", "default", got.Type)
		}
	})
}

func TestExtractOCIRefPrecedence(t *testing.T) {
	cases := []struct {
		name string
		ref  map[string]any
		want string
	}{
		{"digest beats semver", map[string]any{"digest": "sha256:abc", "semver": ">=1"}, "digest: sha256:abc"},
		{"semver beats tag", map[string]any{"semver": ">=1.2", "tag": "v1"}, "semver: >=1.2"},
		{"tag only", map[string]any{"tag": "v1"}, "tag: v1"},
		{"empty", map[string]any{}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			obj := &unstructured.Unstructured{Object: map[string]any{
				"spec": map[string]any{"ref": tc.ref},
			}}
			got := extractOCIRef(obj)
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestExtractFluxBucket(t *testing.T) {
	t.Run("aws provider with region", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "manifests", "namespace": "flux-system"},
			"spec": map[string]any{
				"provider":   "aws",
				"bucketName": "fleet-manifests",
				"endpoint":   "s3.amazonaws.com",
				"region":     "eu-central-1",
				"interval":   "5m",
			},
		}}
		got := extractFluxBucket(obj)
		if got.Provider != "aws" || got.BucketName != "fleet-manifests" {
			t.Errorf("provider/bucket wrong: %+v", got)
		}
		if got.Region != "eu-central-1" {
			t.Errorf("region wrong: %q", got.Region)
		}
	})
	t.Run("missing provider defaults to generic", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "bare"},
			"spec":     map[string]any{"bucketName": "x"},
		}}
		got := extractFluxBucket(obj)
		if got.Provider != "generic" {
			t.Errorf("missing provider should default to generic, got %q", got.Provider)
		}
	})
}

func TestExtractFluxProviderAddressFromSecret(t *testing.T) {
	t.Run("inline address", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "slack", "namespace": "flux-system"},
			"spec": map[string]any{
				"type":    "slack",
				"channel": "#alerts",
				"address": "https://hooks.slack.com/services/T/B/X",
			},
		}}
		got := extractFluxProvider(obj)
		if got.Type != "slack" || got.Channel != "#alerts" {
			t.Errorf("identity wrong: %+v", got)
		}
		if got.AddressFromSecret {
			t.Errorf("inline address should not be marked as from-Secret")
		}
	})
	t.Run("address provided via Secret", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "slack", "namespace": "flux-system"},
			"spec": map[string]any{
				"type":      "slack",
				"secretRef": map[string]any{"name": "slack-webhook"},
			},
		}}
		got := extractFluxProvider(obj)
		if got.Address != "" {
			t.Errorf("Address should be empty when delivered via Secret, got %q", got.Address)
		}
		if !got.AddressFromSecret {
			t.Error("AddressFromSecret should be true when only secretRef is set")
		}
	})
}

func TestSummariseAlertSources(t *testing.T) {
	cases := []struct {
		name string
		in   []FluxAlertSource
		want string
	}{
		{"empty", nil, ""},
		{"single", []FluxAlertSource{{Kind: "Kustomization", Name: "podinfo"}}, "Kustomization/podinfo"},
		{"two", []FluxAlertSource{
			{Kind: "GitRepository", Name: "podinfo"},
			{Kind: "Kustomization", Name: "podinfo"},
		}, "GitRepository/podinfo, Kustomization/podinfo"},
		{"wildcard name", []FluxAlertSource{{Kind: "Kustomization", Name: "*"}}, "Kustomization/*"},
		{"more than two", []FluxAlertSource{
			{Kind: "GitRepository", Name: "a"},
			{Kind: "GitRepository", Name: "b"},
			{Kind: "GitRepository", Name: "c"},
			{Kind: "GitRepository", Name: "d"},
		}, "GitRepository/a, GitRepository/b +2 more"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := summariseAlertSources(tc.in)
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestExtractFluxReceiverWebhookPath(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "github", "namespace": "flux-system"},
		"spec": map[string]any{
			"type":      "github",
			"secretRef": map[string]any{"name": "webhook-token"},
			"resources": []any{
				map[string]any{"kind": "GitRepository", "name": "podinfo"},
			},
		},
		"status": map[string]any{
			"webhookPath": "/hook/abc123",
		},
	}}
	got := extractFluxReceiver(obj)
	if got.Type != "github" {
		t.Errorf("type wrong: %q", got.Type)
	}
	if got.WebhookPath != "/hook/abc123" {
		t.Errorf("webhook path wrong: %q", got.WebhookPath)
	}
	if got.SecretRef != "webhook-token" {
		t.Errorf("secretRef wrong: %q", got.SecretRef)
	}
	if got.ResourceCount != 1 {
		t.Errorf("resource count wrong: %d", got.ResourceCount)
	}
}

func TestExtractDependsOnRefs(t *testing.T) {
	in := []any{
		map[string]any{"name": "a"},
		map[string]any{"name": "b", "namespace": "infra"},
		map[string]any{"namespace": "infra"}, // skipped: no name
	}
	got := extractDependsOnRefs(in)
	want := []string{"a", "infra/b"}
	if len(got) != len(want) {
		t.Fatalf("got %d, want %d (%+v)", len(got), len(want), got)
	}
	for i, w := range want {
		if got[i] != w {
			t.Errorf("[%d] got %q, want %q", i, got[i], w)
		}
	}
}
