package kube

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strconv"
	"time"

	"helm.sh/helm/v3/pkg/release"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
)

// Helm v3 release storage layout in core/v1 Secrets:
//   Type   = "helm.sh/release.v1"
//   Labels = owner=helm, name=<release>, version=<int>, status=<lowercase>
//   Data["release"] = base64( gzip( JSON release ) )
//
// We rely on this format to decode releases directly from the Secret informer
// cache instead of doing a fresh `helm list` API call every time the UI asks
// for releases. The format has been stable across Helm 3.x.

const helmReleaseSecretType = "helm.sh/release.v1"
const helmReleaseSecretOwner = "helm"
const helmReleaseSecretDataKey = "release"

var helmGzipMagic = []byte{0x1f, 0x8b, 0x08}

func isHelmReleaseSecret(s *corev1.Secret) bool {
	if s == nil {
		return false
	}
	if string(s.Type) != helmReleaseSecretType {
		return false
	}
	if s.Labels["owner"] != helmReleaseSecretOwner {
		return false
	}
	return true
}

func decodeHelmReleaseSecret(s *corev1.Secret) (*release.Release, error) {
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
		defer gr.Close()
		b, err = io.ReadAll(gr)
		if err != nil {
			return nil, fmt.Errorf("gunzip %s/%s: %w", s.Namespace, s.Name, err)
		}
	}
	var rls release.Release
	if err := json.Unmarshal(b, &rls); err != nil {
		return nil, fmt.Errorf("json %s/%s: %w", s.Namespace, s.Name, err)
	}
	return &rls, nil
}

// helmSecretVersion is parsed from the Secret's "version" label without
// touching the payload, which is what keeps listing cheap.
func helmSecretVersion(s *corev1.Secret) int {
	v, err := strconv.Atoi(s.Labels["version"])
	if err != nil {
		return 0
	}
	return v
}

// HelmReleases reads the contextWatcher's Secret informer cache, groups the
// helm storage secrets by (namespace, release name), and decodes only the
// latest revision per release. Compared to action.NewList (which hits the
// Kubernetes API each call) this is orders of magnitude faster on clusters
// with hundreds of releases.
func (w *contextWatcher) HelmReleases(namespace string) ([]HelmReleaseInfo, error) {
	latest, err := w.helmLatestSecrets(namespace)
	if err != nil {
		return nil, err
	}
	out := make([]HelmReleaseInfo, 0, len(latest))
	for _, s := range latest {
		rel, err := decodeHelmReleaseSecret(s)
		if err != nil {
			continue
		}
		if rel.Info != nil && rel.Info.Status == release.StatusUninstalled {
			continue
		}
		out = append(out, releaseInfoFromRelease(rel))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

// HelmRelease returns the full detail (latest revision + history) for one
// release entirely from the Secret informer cache.
func (w *contextWatcher) HelmRelease(namespace, name string) (*HelmReleaseDetail, error) {
	secrets, err := w.helmReleaseSecrets(namespace, name)
	if err != nil {
		return nil, err
	}
	if len(secrets) == 0 {
		return nil, fmt.Errorf("release %q not found in namespace %q", name, namespace)
	}
	sort.Slice(secrets, func(i, j int) bool {
		return helmSecretVersion(secrets[i]) > helmSecretVersion(secrets[j])
	})

	latest, err := decodeHelmReleaseSecret(secrets[0])
	if err != nil {
		return nil, err
	}

	revisions := make([]HelmRevisionInfo, 0, len(secrets))
	for _, s := range secrets {
		rev, err := decodeHelmReleaseSecret(s)
		if err != nil {
			continue
		}
		revisions = append(revisions, revisionInfoFromRelease(rev))
	}

	userVals, err := marshalValues(latest.Config)
	if err != nil {
		return nil, err
	}
	var chartDefaults map[string]any
	if latest.Chart != nil {
		chartDefaults = latest.Chart.Values
	}
	mergedVals, err := marshalValues(chartDefaults)
	if err != nil {
		return nil, err
	}

	notes := ""
	if latest.Info != nil {
		notes = latest.Info.Notes
	}
	chartName, chartVer, appVer := "", "", ""
	if latest.Chart != nil && latest.Chart.Metadata != nil {
		chartName = latest.Chart.Metadata.Name
		chartVer = latest.Chart.Metadata.Version
		appVer = latest.Chart.Metadata.AppVersion
	}
	return &HelmReleaseDetail{
		Info:         releaseInfoFromRelease(latest),
		Notes:        notes,
		Manifest:     latest.Manifest,
		UserValues:   userVals,
		MergedValues: mergedVals,
		ChartName:    chartName,
		ChartVersion: chartVer,
		AppVersion:   appVer,
		Revisions:    revisions,
	}, nil
}

// HelmReleaseRevisions returns the history of a single release from cache.
func (w *contextWatcher) HelmReleaseRevisions(namespace, name string) ([]HelmRevisionInfo, error) {
	secrets, err := w.helmReleaseSecrets(namespace, name)
	if err != nil {
		return nil, err
	}
	sort.Slice(secrets, func(i, j int) bool {
		return helmSecretVersion(secrets[i]) > helmSecretVersion(secrets[j])
	})
	out := make([]HelmRevisionInfo, 0, len(secrets))
	for _, s := range secrets {
		rel, err := decodeHelmReleaseSecret(s)
		if err != nil {
			continue
		}
		out = append(out, revisionInfoFromRelease(rel))
	}
	return out, nil
}

// helmLatestSecrets returns the latest-revision Secret per release in the
// given namespace (or all if namespace is "").
func (w *contextWatcher) helmLatestSecrets(namespace string) (map[string]*corev1.Secret, error) {
	all, err := w.helmAllSecrets(namespace)
	if err != nil {
		return nil, err
	}
	latest := make(map[string]*corev1.Secret, len(all))
	for _, s := range all {
		key := s.Namespace + "/" + s.Labels["name"]
		cur, ok := latest[key]
		if !ok || helmSecretVersion(s) > helmSecretVersion(cur) {
			latest[key] = s
		}
	}
	return latest, nil
}

// helmReleaseSecrets returns every Secret belonging to a given release.
func (w *contextWatcher) helmReleaseSecrets(namespace, name string) ([]*corev1.Secret, error) {
	all, err := w.helmAllSecrets(namespace)
	if err != nil {
		return nil, err
	}
	out := make([]*corev1.Secret, 0, 4)
	for _, s := range all {
		if s.Labels["name"] != name {
			continue
		}
		out = append(out, s)
	}
	return out, nil
}

func (w *contextWatcher) helmAllSecrets(namespace string) ([]*corev1.Secret, error) {
	f := w.factoryFor("Secret")
	if f == nil {
		return nil, nil
	}
	lister := f.Core().V1().Secrets().Lister()
	var raw []*corev1.Secret
	var err error
	if namespace == "" {
		raw, err = lister.List(labels.Everything())
	} else {
		raw, err = lister.Secrets(namespace).List(labels.Everything())
	}
	if err != nil {
		return nil, err
	}
	out := make([]*corev1.Secret, 0, len(raw))
	for _, s := range raw {
		if !isHelmReleaseSecret(s) {
			continue
		}
		out = append(out, s)
	}
	return out, nil
}

// helmReleaseFromInfo enriches a HelmReleaseInfo with the absolute updated
// time; useful when sorting clients want a parsed time.Time.
func parseHelmInfoTime(info HelmReleaseInfo) time.Time {
	if info.Updated == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, info.Updated)
	if err != nil {
		return time.Time{}
	}
	return t
}
