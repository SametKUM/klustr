package kube

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strconv"
	"sync"
	"time"

	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/release"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/metadata/metadatainformer"
	"k8s.io/client-go/metadata/metadatalister"
	"k8s.io/client-go/tools/cache"
)

// Helm v3 stores each release revision as a Secret of type helm.sh/release.v1,
// labelled owner=helm, name, version and status, with Data["release"] =
// base64(gzip(JSON)). The layout is stable across Helm 3.x.
const (
	helmReleaseSecretType    = "helm.sh/release.v1"
	helmReleaseSecretDataKey = "release"
	helmReleaseSelector      = "owner=helm"
)

// HelmChangeKind is the kind the Helm views subscribe to. The release watch
// touches it on every change to a release Secret.
const HelmChangeKind = "HelmRelease"

// A list refresh fetches the release Secrets it has no current row for,
// a bounded number at a time.
const (
	helmRowFetchConcurrency = 8
	helmRowFetchTimeout     = 20 * time.Second
)

var (
	secretsGVR    = schema.GroupVersionResource{Version: "v1", Resource: "secrets"}
	helmGzipMagic = []byte{0x1f, 0x8b, 0x08}
)

// helmWatch follows a context's Helm release Secrets through a metadata-only
// informer: names, labels and resourceVersions are cached, never the release
// payloads, which carry chart values in plaintext. Every change touches
// HelmChangeKind, and the release list is served from rows decoded once per
// Secret resourceVersion, so a refresh fetches only the latest revisions that
// changed since the last one instead of every revision of every release.
type helmWatch struct {
	w    *contextWatcher
	once sync.Once
	// informer stays nil when the context can't list Secrets.
	informer cache.SharedIndexInformer

	mu   sync.Mutex
	rows map[string]helmRow // keyed by the Secret's "namespace/name"
}

type helmRow struct {
	resourceVersion string
	info            HelmReleaseInfo
}

func newHelmWatch(w *contextWatcher) *helmWatch {
	return &helmWatch{w: w, rows: make(map[string]helmRow)}
}

// ensure starts the watch on first use, routed like the Secret kind.
func (h *helmWatch) ensure() {
	h.once.Do(h.start)
}

func (h *helmWatch) start() {
	w := h.w
	namespace := ""
	switch access := w.access.For("Secret"); access.Mode {
	case AccessCluster:
	case AccessNamespaced:
		namespace = access.Namespace
	default:
		// No informer; a touch still opens the views' synced gate so the
		// empty list shows without waiting out the skeleton grace timer.
		w.touch(HelmChangeKind)
		return
	}
	if w.meta == nil {
		w.touch(HelmChangeKind)
		return
	}
	factory := metadatainformer.NewFilteredSharedInformerFactory(w.meta, 0, namespace, func(o *metav1.ListOptions) {
		o.LabelSelector = helmReleaseSelector
		o.FieldSelector = "type=" + helmReleaseSecretType
	})
	informer := factory.ForResource(secretsGVR).Informer()
	// A fresh informer can't be running yet, so SetTransform can't fail here.
	_ = informer.SetTransform(stripManagedFields)
	if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(any) { h.changed(informer) },
		UpdateFunc: func(_, obj any) {
			h.forget(obj)
			h.changed(informer)
		},
		DeleteFunc: func(obj any) {
			h.forget(obj)
			h.changed(informer)
		},
	}); err != nil {
		w.touch(HelmChangeKind)
		return
	}
	h.informer = informer
	factory.Start(w.stopCh)
	go func() {
		if cache.WaitForCacheSync(w.stopCh, informer.HasSynced) {
			w.touch(HelmChangeKind)
		}
	}()
}

// changed ignores the initial LIST replay, which the post-sync touch covers.
func (h *helmWatch) changed(informer cache.SharedIndexInformer) {
	if informer.HasSynced() {
		h.w.touch(HelmChangeKind)
	}
}

// forget drops the row decoded from a Secret that changed or went away. A
// superseded revision is relabelled when the next one lands, so rows for
// revisions that are no longer the latest don't linger.
func (h *helmWatch) forget(obj any) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		return
	}
	h.mu.Lock()
	delete(h.rows, key)
	h.mu.Unlock()
}

// Releases lists the latest revision of each release in namespace ("" lists
// every namespace in scope), sorted by namespace and name. Like `helm list
// --all`, it keeps pending and failed releases and hides uninstalled ones kept
// with --keep-history.
func (h *helmWatch) Releases(namespace string) ([]HelmReleaseInfo, error) {
	h.ensure()
	if h.informer == nil {
		return []HelmReleaseInfo{}, nil
	}
	latest, err := h.latestSecrets(namespace)
	if err != nil {
		return nil, err
	}
	out := make([]HelmReleaseInfo, 0, len(latest))
	var stale []*metav1.PartialObjectMetadata
	h.mu.Lock()
	for _, s := range latest {
		if row, ok := h.rows[s.Namespace+"/"+s.Name]; ok && row.resourceVersion == s.ResourceVersion {
			out = append(out, row.info)
		} else {
			stale = append(stale, s)
		}
	}
	h.mu.Unlock()
	out = append(out, h.fetchRows(stale)...)
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

// latestSecrets returns the highest-revision Secret of each release that isn't
// uninstalled. Helm applies its state filter after this reduction too, so a
// release whose latest revision is uninstalled stays hidden.
func (h *helmWatch) latestSecrets(namespace string) ([]*metav1.PartialObjectMetadata, error) {
	lister := metadatalister.New(h.informer.GetIndexer(), secretsGVR)
	var all []*metav1.PartialObjectMetadata
	var err error
	if namespace == "" {
		all, err = lister.List(labels.Everything())
	} else {
		all, err = lister.Namespace(namespace).List(labels.Everything())
	}
	if err != nil {
		return nil, err
	}
	byRelease := make(map[string]*metav1.PartialObjectMetadata, len(all))
	for _, s := range all {
		key := s.Namespace + "/" + s.Labels["name"]
		if cur, ok := byRelease[key]; !ok || helmRevision(s) > helmRevision(cur) {
			byRelease[key] = s
		}
	}
	out := make([]*metav1.PartialObjectMetadata, 0, len(byRelease))
	for _, s := range byRelease {
		if s.Labels["status"] != release.StatusUninstalled.String() {
			out = append(out, s)
		}
	}
	return out, nil
}

// fetchRows reads and decodes each Secret and caches its row. The payload is
// dropped once its row is built.
func (h *helmWatch) fetchRows(secrets []*metav1.PartialObjectMetadata) []HelmReleaseInfo {
	if len(secrets) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), helmRowFetchTimeout)
	defer cancel()
	go func() {
		select {
		case <-h.w.stopCh:
			cancel()
		case <-ctx.Done():
		}
	}()

	rows := make([]HelmReleaseInfo, len(secrets))
	found := make([]bool, len(secrets))
	sem := make(chan struct{}, helmRowFetchConcurrency)
	var wg sync.WaitGroup
	for i, s := range secrets {
		wg.Go(func() {
			sem <- struct{}{}
			defer func() { <-sem }()
			rows[i], found[i] = h.fetchRow(ctx, s)
		})
	}
	wg.Wait()

	out := make([]HelmReleaseInfo, 0, len(rows))
	for i, row := range rows {
		if found[i] {
			out = append(out, row)
		}
	}
	return out
}

func (h *helmWatch) fetchRow(ctx context.Context, meta *metav1.PartialObjectMetadata) (HelmReleaseInfo, bool) {
	secret, err := h.w.cs.CoreV1().Secrets(meta.Namespace).Get(ctx, meta.Name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		// Deleted since the list was read; its delete event touches the views.
		return HelmReleaseInfo{}, false
	}
	var rel *release.Release
	if err == nil {
		rel, err = decodeHelmReleaseMeta(secret)
	}
	if err != nil {
		// Keep the release visible from its labels, uncached, so the next
		// refresh retries the chart columns.
		return helmLabelRow(meta), true
	}
	info := releaseInfoFromRelease(rel)
	// Keyed by the cached metadata's version, the one the next list compares:
	// a live GET reads that version or a newer one, and the watch event that
	// brings the newer one drops this row anyway.
	h.mu.Lock()
	h.rows[meta.Namespace+"/"+meta.Name] = helmRow{resourceVersion: meta.ResourceVersion, info: info}
	h.mu.Unlock()
	return info, true
}

func helmLabelRow(s *metav1.PartialObjectMetadata) HelmReleaseInfo {
	return HelmReleaseInfo{
		Name:      s.Labels["name"],
		Namespace: s.Namespace,
		Revision:  helmRevision(s),
		Status:    s.Labels["status"],
	}
}

// helmRevision reads a release Secret's revision from its "version" label.
func helmRevision(s *metav1.PartialObjectMetadata) int {
	v, err := strconv.Atoi(s.Labels["version"])
	if err != nil {
		return 0
	}
	return v
}

// helmReleasePayload returns the decoded (base64, then gunzipped) release JSON
// from a release Secret.
func helmReleasePayload(s *corev1.Secret) ([]byte, error) {
	raw, ok := s.Data[helmReleaseSecretDataKey]
	if !ok || len(raw) == 0 {
		return nil, fmt.Errorf("secret %s/%s has no release data", s.Namespace, s.Name)
	}
	b, err := base64.StdEncoding.DecodeString(string(raw))
	if err != nil {
		return nil, fmt.Errorf("base64 decode %s/%s: %w", s.Namespace, s.Name, err)
	}
	if len(b) >= 3 && bytes.Equal(b[0:3], helmGzipMagic) {
		gr, err := gzip.NewReader(bytes.NewReader(b))
		if err != nil {
			return nil, fmt.Errorf("gzip reader %s/%s: %w", s.Namespace, s.Name, err)
		}
		defer func() { _ = gr.Close() }()
		b, err = io.ReadAll(gr)
		if err != nil {
			return nil, fmt.Errorf("gunzip %s/%s: %w", s.Namespace, s.Name, err)
		}
	}
	return b, nil
}

// decodeHelmReleaseMeta decodes only the fields a list row needs. Leaving the
// manifest and chart templates/files/values out of the target struct lets
// encoding/json skip them, which dominates the cost of decoding a release.
func decodeHelmReleaseMeta(s *corev1.Secret) (*release.Release, error) {
	b, err := helmReleasePayload(s)
	if err != nil {
		return nil, err
	}
	var m struct {
		Name      string        `json:"name"`
		Namespace string        `json:"namespace"`
		Version   int           `json:"version"`
		Info      *release.Info `json:"info"`
		Chart     *struct {
			Metadata *chart.Metadata `json:"metadata"`
		} `json:"chart"`
	}
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, fmt.Errorf("json %s/%s: %w", s.Namespace, s.Name, err)
	}
	rls := &release.Release{Name: m.Name, Namespace: m.Namespace, Version: m.Version, Info: m.Info}
	if m.Chart != nil {
		rls.Chart = &chart.Chart{Metadata: m.Chart.Metadata}
	}
	return rls, nil
}
