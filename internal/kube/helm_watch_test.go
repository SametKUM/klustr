package kube

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"testing"
	"time"

	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/release"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	metadatafake "k8s.io/client-go/metadata/fake"
)

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

func TestDecodeHelmReleaseMetaPayloads(t *testing.T) {
	rel := &release.Release{Name: "demo", Namespace: "default", Version: 3}

	for _, gzipped := range []bool{true, false} {
		t.Run(fmt.Sprintf("gzipped=%v", gzipped), func(t *testing.T) {
			s := &corev1.Secret{Data: map[string][]byte{"release": []byte(encodeHelmReleasePayload(t, rel, gzipped))}}
			got, err := decodeHelmReleaseMeta(s)
			if err != nil {
				t.Fatalf("decode: %v", err)
			}
			if got.Name != rel.Name || got.Namespace != rel.Namespace || got.Version != rel.Version {
				t.Fatalf("got %+v, want %+v", got, rel)
			}
		})
	}

	bad := map[string][]byte{
		"missing release data": nil,
		"invalid base64":       []byte("not!!!base64=="),
		"invalid JSON":         []byte(base64.StdEncoding.EncodeToString([]byte("{not valid json"))),
	}
	for name, data := range bad {
		t.Run(name, func(t *testing.T) {
			s := &corev1.Secret{Data: map[string][]byte{}}
			if data != nil {
				s.Data["release"] = data
			}
			if _, err := decodeHelmReleaseMeta(s); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
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

func TestHelmRevision(t *testing.T) {
	cases := map[string]struct {
		labels map[string]string
		want   int
	}{
		"valid":   {map[string]string{"version": "7"}, 7},
		"missing": {map[string]string{}, 0},
		"invalid": {map[string]string{"version": "abc"}, 0},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			s := &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Labels: tc.labels}}
			if got := helmRevision(s); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

// helmRevisionFixture is one release Secret, served both as metadata (the
// watch) and in full (the per-row GET).
type helmRevisionFixture struct {
	namespace, release string
	revision           int
	status             release.Status
	chartVersion       string
	resourceVersion    string
	corrupt            bool
}

func (f helmRevisionFixture) name() string {
	return fmt.Sprintf("sh.helm.release.v1.%s.v%d", f.release, f.revision)
}

func (f helmRevisionFixture) labels() map[string]string {
	return map[string]string{
		"owner":   "helm",
		"name":    f.release,
		"version": strconv.Itoa(f.revision),
		"status":  f.status.String(),
	}
}

func (f helmRevisionFixture) meta() *metav1.PartialObjectMetadata {
	return &metav1.PartialObjectMetadata{
		TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Secret"},
		ObjectMeta: metav1.ObjectMeta{
			Namespace:       f.namespace,
			Name:            f.name(),
			ResourceVersion: f.resourceVersion,
			Labels:          f.labels(),
		},
	}
}

func (f helmRevisionFixture) secret(t *testing.T) *corev1.Secret {
	t.Helper()
	payload := []byte("not!!!base64==")
	if !f.corrupt {
		payload = []byte(encodeHelmReleasePayload(t, &release.Release{
			Name:      f.release,
			Namespace: f.namespace,
			Version:   f.revision,
			Info:      &release.Info{Status: f.status},
			Chart:     &chart.Chart{Metadata: &chart.Metadata{Name: f.release + "-chart", Version: f.chartVersion, AppVersion: "1.0"}},
		}, true))
	}
	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:       f.namespace,
			Name:            f.name(),
			ResourceVersion: f.resourceVersion,
			Labels:          f.labels(),
		},
		Type: helmReleaseSecretType,
		Data: map[string][]byte{"release": payload},
	}
}

type helmTestWatch struct {
	w    *contextWatcher
	cs   *fake.Clientset
	meta *metadatafake.FakeMetadataClient

	mu      sync.Mutex
	touches int
}

func newHelmTestWatch(t *testing.T, access *contextAccess, fixtures ...helmRevisionFixture) *helmTestWatch {
	t.Helper()
	scheme := metadatafake.NewTestScheme()
	if err := metav1.AddMetaToScheme(scheme); err != nil {
		t.Fatal(err)
	}
	metaObjs := make([]runtime.Object, 0, len(fixtures))
	secrets := make([]runtime.Object, 0, len(fixtures))
	for _, f := range fixtures {
		metaObjs = append(metaObjs, f.meta())
		secrets = append(secrets, f.secret(t))
	}
	stopCh := make(chan struct{})
	t.Cleanup(func() { close(stopCh) })

	h := &helmTestWatch{
		cs:   fake.NewClientset(secrets...),
		meta: metadatafake.NewSimpleMetadataClient(scheme, metaObjs...),
	}
	h.w = newContextWatcher(nil, nil, nil, nil, h.meta, "", func(kind string, _ *KindDelta) {
		if kind == HelmChangeKind {
			h.mu.Lock()
			h.touches++
			h.mu.Unlock()
		}
	})
	h.w.cs = h.cs
	h.w.stopCh = stopCh
	h.w.access = access
	return h
}

func (h *helmTestWatch) touchCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.touches
}

func (h *helmTestWatch) waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// synced starts the watch and waits for its post-sync touch.
func (h *helmTestWatch) synced(t *testing.T) {
	t.Helper()
	h.w.helm.ensure()
	h.waitFor(t, "the post-sync touch", func() bool { return h.touchCount() > 0 })
}

func (h *helmTestWatch) secretGets() int {
	n := 0
	for _, a := range h.cs.Actions() {
		if a.GetVerb() == "get" && a.GetResource().Resource == "secrets" {
			n++
		}
	}
	return n
}

func releaseKeys(rows []HelmReleaseInfo) []string {
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, fmt.Sprintf("%s/%s#%d", r.Namespace, r.Name, r.Revision))
	}
	return out
}

func TestHelmWatchListsLatestRevisionOfEachRelease(t *testing.T) {
	h := newHelmTestWatch(t, nil,
		helmRevisionFixture{"apps", "web", 1, release.StatusSuperseded, "1.0.0", "11", false},
		helmRevisionFixture{"apps", "web", 2, release.StatusDeployed, "1.1.0", "12", false},
		helmRevisionFixture{"apps", "upgrading", 1, release.StatusPendingUpgrade, "2.0.0", "13", false},
		// Uninstalled with --keep-history: hidden even though an older
		// revision was deployed.
		helmRevisionFixture{"apps", "gone", 2, release.StatusSuperseded, "3.0.0", "14", false},
		helmRevisionFixture{"apps", "gone", 3, release.StatusUninstalled, "3.0.0", "15", false},
		helmRevisionFixture{"data", "db", 1, release.StatusDeployed, "4.0.0", "16", false},
	)
	h.synced(t)

	rows, err := h.w.helm.Releases("")
	if err != nil {
		t.Fatal(err)
	}
	if got, want := fmt.Sprint(releaseKeys(rows)), "[apps/upgrading#1 apps/web#2 data/db#1]"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
	web := rows[1]
	if web.ChartName != "web-chart" || web.ChartVer != "1.1.0" || web.Status != "deployed" {
		t.Fatalf("web row not decoded from its latest revision: %+v", web)
	}

	rows, err = h.w.helm.Releases("data")
	if err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprint(releaseKeys(rows)); got != "[data/db#1]" {
		t.Fatalf("namespace filter: got %s", got)
	}
}

func TestHelmWatchFetchesEachRevisionOnce(t *testing.T) {
	web := helmRevisionFixture{"apps", "web", 1, release.StatusDeployed, "1.0.0", "21", false}
	db := helmRevisionFixture{"data", "db", 1, release.StatusDeployed, "4.0.0", "22", false}
	h := newHelmTestWatch(t, nil, web, db)
	h.synced(t)

	if _, err := h.w.helm.Releases(""); err != nil {
		t.Fatal(err)
	}
	if got := h.secretGets(); got != 2 {
		t.Fatalf("first list should read each latest revision once, got %d GETs", got)
	}
	if _, err := h.w.helm.Releases(""); err != nil {
		t.Fatal(err)
	}
	if got := h.secretGets(); got != 2 {
		t.Fatalf("an unchanged refresh must not read Secrets again, got %d GETs", got)
	}

	// helm upgrade web: revision 2 lands, revision 1 is relabelled superseded.
	next := helmRevisionFixture{"apps", "web", 2, release.StatusDeployed, "1.1.0", "23", false}
	if _, err := h.cs.CoreV1().Secrets("apps").Create(context.Background(), next.secret(t), metav1.CreateOptions{}); err != nil {
		t.Fatal(err)
	}
	touches := h.touchCount()
	if _, err := h.meta.Resource(secretsGVR).Namespace("apps").(metadatafake.MetadataClient).CreateFake(next.meta(), metav1.CreateOptions{}); err != nil {
		t.Fatal(err)
	}
	h.waitFor(t, "a touch for the new revision", func() bool { return h.touchCount() > touches })

	rows, err := h.w.helm.Releases("")
	if err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprint(releaseKeys(rows)); got != "[apps/web#2 data/db#1]" {
		t.Fatalf("got %s", got)
	}
	if rows[0].ChartVer != "1.1.0" {
		t.Fatalf("web should show the upgraded chart, got %+v", rows[0])
	}
	if got := h.secretGets(); got != 3 {
		t.Fatalf("only the new revision should be read, got %d GETs in total", got)
	}
}

func TestHelmWatchTouchesOnDelete(t *testing.T) {
	web := helmRevisionFixture{"apps", "web", 1, release.StatusDeployed, "1.0.0", "31", false}
	h := newHelmTestWatch(t, nil, web)
	h.synced(t)
	if _, err := h.w.helm.Releases(""); err != nil {
		t.Fatal(err)
	}

	touches := h.touchCount()
	if err := h.meta.Resource(secretsGVR).Namespace("apps").Delete(context.Background(), web.name(), metav1.DeleteOptions{}); err != nil {
		t.Fatal(err)
	}
	h.waitFor(t, "a touch for the uninstall", func() bool { return h.touchCount() > touches })
	rows, err := h.w.helm.Releases("")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 0 {
		t.Fatalf("uninstalled release still listed: %v", releaseKeys(rows))
	}
	h.w.helm.mu.Lock()
	defer h.w.helm.mu.Unlock()
	if len(h.w.helm.rows) != 0 {
		t.Fatalf("row of a deleted Secret should be dropped, have %d", len(h.w.helm.rows))
	}
}

func TestHelmWatchFollowsSecretAccess(t *testing.T) {
	fixtures := []helmRevisionFixture{
		{"apps", "web", 1, release.StatusDeployed, "1.0.0", "41", false},
		{"data", "db", 1, release.StatusDeployed, "4.0.0", "42", false},
	}

	t.Run("namespaced", func(t *testing.T) {
		access := &contextAccess{kinds: map[string]KindAccess{"Secret": {Mode: AccessNamespaced, Namespace: "apps"}}}
		h := newHelmTestWatch(t, access, fixtures...)
		h.synced(t)
		rows, err := h.w.helm.Releases("")
		if err != nil {
			t.Fatal(err)
		}
		if got := fmt.Sprint(releaseKeys(rows)); got != "[apps/web#1]" {
			t.Fatalf("a namespace-scoped user should see only that namespace, got %s", got)
		}
	})

	t.Run("denied", func(t *testing.T) {
		h := newHelmTestWatch(t, &contextAccess{kinds: map[string]KindAccess{}}, fixtures...)
		rows, err := h.w.helm.Releases("")
		if err != nil {
			t.Fatal(err)
		}
		if rows == nil || len(rows) != 0 {
			t.Fatalf("want an empty, non-nil list, got %#v", rows)
		}
		h.waitFor(t, "the touch that opens the synced gate", func() bool { return h.touchCount() > 0 })
		if n := len(h.meta.Actions()); n != 0 {
			t.Fatalf("a denied context must not list Secrets, got %d metadata calls", n)
		}
	})
}

// The release list must read through the watch, or nothing starts it and the
// view never hears about a change: what the list missed once the Secret
// informer stopped carrying release payloads.
func TestClientManagerHelmReleasesStartTheWatch(t *testing.T) {
	h := newHelmTestWatch(t, nil,
		helmRevisionFixture{"apps", "web", 1, release.StatusDeployed, "1.0.0", "61", false},
		helmRevisionFixture{"data", "db", 1, release.StatusDeployed, "4.0.0", "62", false},
		helmRevisionFixture{"other", "skip", 1, release.StatusDeployed, "5.0.0", "63", false},
	)
	m := &ClientManager{watchers: map[string]*contextWatcher{"ctx": h.w}}

	// The first list starts the watch; its post-sync touch is the view's cue
	// to list again.
	if _, err := m.HelmReleases("ctx", ""); err != nil {
		t.Fatal(err)
	}
	h.waitFor(t, "the post-sync touch", func() bool { return h.touchCount() > 0 })

	rows, err := m.HelmReleases("ctx", "apps,data")
	if err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprint(releaseKeys(rows)); got != "[apps/web#1 data/db#1]" {
		t.Fatalf("got %s", got)
	}
}

// A release whose payload can't be read stays listed from its labels and is
// retried on the next refresh rather than cached.
func TestHelmWatchKeepsUndecodableReleaseVisible(t *testing.T) {
	broken := helmRevisionFixture{"apps", "broken", 4, release.StatusFailed, "1.0.0", "51", true}
	h := newHelmTestWatch(t, nil, broken)
	h.synced(t)

	for range 2 {
		rows, err := h.w.helm.Releases("")
		if err != nil {
			t.Fatal(err)
		}
		want := HelmReleaseInfo{Name: "broken", Namespace: "apps", Revision: 4, Status: "failed"}
		if len(rows) != 1 || rows[0] != want {
			t.Fatalf("got %+v, want %+v", rows, want)
		}
	}
	if got := h.secretGets(); got != 2 {
		t.Fatalf("an undecodable release should be retried on every refresh, got %d GETs", got)
	}
}
