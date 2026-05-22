package kube

import (
	"sort"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type ConfigMapInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Keys      int    `json:"keys"`
	CreatedAt string `json:"createdAt"`
}

type SecretInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Type      string `json:"type"`
	Keys      int    `json:"keys"`
	CreatedAt string `json:"createdAt"`
}

func (w *contextWatcher) ConfigMaps(namespace string) []ConfigMapInfo {
	lister := w.factory.Core().V1().ConfigMaps().Lister()
	var (
		cms []*corev1.ConfigMap
		err error
	)
	if namespace == "" {
		cms, err = lister.List(labels.Everything())
	} else {
		cms, err = lister.ConfigMaps(namespace).List(labels.Everything())
	}
	if err != nil {
		return []ConfigMapInfo{}
	}
	out := make([]ConfigMapInfo, 0, len(cms))
	for _, c := range cms {
		out = append(out, ConfigMapInfo{
			Name:      c.Name,
			Namespace: c.Namespace,
			Keys:      len(c.Data) + len(c.BinaryData),
			CreatedAt: c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out
}

func (w *contextWatcher) Secrets(namespace string) []SecretInfo {
	lister := w.factory.Core().V1().Secrets().Lister()
	var (
		secs []*corev1.Secret
		err  error
	)
	if namespace == "" {
		secs, err = lister.List(labels.Everything())
	} else {
		secs, err = lister.Secrets(namespace).List(labels.Everything())
	}
	if err != nil {
		return []SecretInfo{}
	}
	out := make([]SecretInfo, 0, len(secs))
	for _, s := range secs {
		out = append(out, SecretInfo{
			Name:      s.Name,
			Namespace: s.Namespace,
			Type:      string(s.Type),
			Keys:      len(s.Data),
			CreatedAt: s.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out
}
