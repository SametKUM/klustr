package kube

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"encoding/json"
	"testing"

	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/release"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestIsHelmReleaseSecret(t *testing.T) {
	cases := []struct {
		name   string
		secret *corev1.Secret
		want   bool
	}{
		{"nil", nil, false},
		{
			"happy",
			&corev1.Secret{
				Type:       corev1.SecretType("helm.sh/release.v1"),
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"owner": "helm"}},
			},
			true,
		},
		{
			"wrongType",
			&corev1.Secret{
				Type:       corev1.SecretType("Opaque"),
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"owner": "helm"}},
			},
			false,
		},
		{
			"wrongOwner",
			&corev1.Secret{
				Type:       corev1.SecretType("helm.sh/release.v1"),
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"owner": "someone-else"}},
			},
			false,
		},
		{
			"missingLabels",
			&corev1.Secret{Type: corev1.SecretType("helm.sh/release.v1")},
			false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isHelmReleaseSecret(tc.secret); got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestHelmSecretVersion(t *testing.T) {
	cases := []struct {
		name   string
		labels map[string]string
		want   int
	}{
		{"valid", map[string]string{"version": "7"}, 7},
		{"missing", map[string]string{}, 0},
		{"invalid", map[string]string{"version": "abc"}, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := &corev1.Secret{ObjectMeta: metav1.ObjectMeta{Labels: tc.labels}}
			if got := helmSecretVersion(s); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func encodeHelmReleasePayload(t *testing.T, rel *release.Release, gzipped bool) string {
	t.Helper()
	raw, err := json.Marshal(rel)
	if err != nil {
		t.Fatalf("marshal release: %v", err)
	}
	if gzipped {
		var buf bytes.Buffer
		gw := gzip.NewWriter(&buf)
		if _, err := gw.Write(raw); err != nil {
			t.Fatalf("gzip write: %v", err)
		}
		if err := gw.Close(); err != nil {
			t.Fatalf("gzip close: %v", err)
		}
		raw = buf.Bytes()
	}
	return base64.StdEncoding.EncodeToString(raw)
}

func TestDecodeHelmReleaseSecret(t *testing.T) {
	rel := &release.Release{
		Name:      "demo",
		Namespace: "default",
		Version:   3,
	}

	t.Run("gzipped payload", func(t *testing.T) {
		payload := encodeHelmReleasePayload(t, rel, true)
		s := &corev1.Secret{Data: map[string][]byte{"release": []byte(payload)}}
		got, err := decodeHelmReleaseSecret(s)
		if err != nil {
			t.Fatalf("decode: %v", err)
		}
		if got.Name != rel.Name || got.Namespace != rel.Namespace || got.Version != rel.Version {
			t.Fatalf("got %+v, want %+v", got, rel)
		}
	})

	t.Run("plain JSON payload", func(t *testing.T) {
		payload := encodeHelmReleasePayload(t, rel, false)
		s := &corev1.Secret{Data: map[string][]byte{"release": []byte(payload)}}
		got, err := decodeHelmReleaseSecret(s)
		if err != nil {
			t.Fatalf("decode: %v", err)
		}
		if got.Name != rel.Name {
			t.Fatalf("got %q, want %q", got.Name, rel.Name)
		}
	})

	t.Run("missing release data", func(t *testing.T) {
		s := &corev1.Secret{Data: map[string][]byte{}}
		if _, err := decodeHelmReleaseSecret(s); err == nil {
			t.Fatal("expected error for empty data")
		}
	})

	t.Run("invalid base64", func(t *testing.T) {
		s := &corev1.Secret{Data: map[string][]byte{"release": []byte("not!!!base64==")}}
		if _, err := decodeHelmReleaseSecret(s); err == nil {
			t.Fatal("expected base64 error")
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		bad := base64.StdEncoding.EncodeToString([]byte("{not valid json"))
		s := &corev1.Secret{Data: map[string][]byte{"release": []byte(bad)}}
		if _, err := decodeHelmReleaseSecret(s); err == nil {
			t.Fatal("expected json error")
		}
	})
}

// decodeHelmReleaseMeta must extract the list-row fields but skip the heavy
// manifest and chart template/values bytes.
func TestDecodeHelmReleaseMeta(t *testing.T) {
	rel := &release.Release{
		Name:      "demo",
		Namespace: "default",
		Version:   3,
		Info:      &release.Info{Status: release.StatusDeployed, Description: "Install complete"},
		Manifest:  "apiVersion: v1\nkind: ConfigMap\n# ...huge rendered manifest...",
		Chart: &chart.Chart{
			Metadata:  &chart.Metadata{Name: "nginx", Version: "1.2.3", AppVersion: "1.25"},
			Templates: []*chart.File{{Name: "templates/deploy.yaml", Data: []byte("big template body")}},
			Values:    map[string]any{"replicas": 3},
		},
	}
	payload := encodeHelmReleasePayload(t, rel, true)
	s := &corev1.Secret{Data: map[string][]byte{"release": []byte(payload)}}

	got, err := decodeHelmReleaseMeta(s)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Name != "demo" || got.Namespace != "default" || got.Version != 3 {
		t.Fatalf("identity fields wrong: %+v", got)
	}
	if got.Info == nil || got.Info.Status != release.StatusDeployed || got.Info.Description != "Install complete" {
		t.Fatalf("info fields wrong: %+v", got.Info)
	}
	if got.Chart == nil || got.Chart.Metadata == nil || got.Chart.Metadata.Name != "nginx" || got.Chart.Metadata.Version != "1.2.3" {
		t.Fatalf("chart metadata wrong: %+v", got.Chart)
	}
	// The whole point: manifest and template/values bytes are never decoded.
	if got.Manifest != "" {
		t.Errorf("manifest should be skipped, got %q", got.Manifest)
	}
	if len(got.Chart.Templates) != 0 || got.Chart.Values != nil {
		t.Errorf("chart templates/values should be skipped, got templates=%d values=%v", len(got.Chart.Templates), got.Chart.Values)
	}

	// The row builder reads only the decoded fields, so it matches a full decode.
	if decodeHelmReleaseMetaInfo := releaseInfoFromRelease(got); decodeHelmReleaseMetaInfo != releaseInfoFromRelease(rel) {
		t.Errorf("row info diverged from full decode: %+v vs %+v", decodeHelmReleaseMetaInfo, releaseInfoFromRelease(rel))
	}
}
