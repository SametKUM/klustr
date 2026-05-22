package kube

import (
	"fmt"
	"sort"
	"time"
)

type ConfigMapDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Data        map[string]string `json:"data"`
	BinaryKeys  []string          `json:"binaryKeys"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type SecretKeyInfo struct {
	Key  string `json:"key"`
	Size int    `json:"size"`
}

type SecretDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Type        string            `json:"type"`
	Keys        []SecretKeyInfo   `json:"keys"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

func (w *contextWatcher) ConfigMap(namespace, name string) (*ConfigMapDetail, error) {
	f := w.factoryFor("ConfigMap")
	if f == nil {
		return nil, errKindNoAccess("ConfigMap")
	}
	c, err := f.Core().V1().ConfigMaps().Lister().ConfigMaps(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	binaryKeys := make([]string, 0, len(c.BinaryData))
	for k := range c.BinaryData {
		binaryKeys = append(binaryKeys, k)
	}
	sort.Strings(binaryKeys)
	return &ConfigMapDetail{
		Name:        c.Name,
		Namespace:   c.Namespace,
		UID:         string(c.UID),
		Data:        c.Data,
		BinaryKeys:  binaryKeys,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Secret(namespace, name string) (*SecretDetail, error) {
	f := w.factoryFor("Secret")
	if f == nil {
		return nil, errKindNoAccess("Secret")
	}
	s, err := f.Core().V1().Secrets().Lister().Secrets(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	keys := make([]SecretKeyInfo, 0, len(s.Data))
	for k, v := range s.Data {
		keys = append(keys, SecretKeyInfo{Key: k, Size: len(v)})
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i].Key < keys[j].Key })
	return &SecretDetail{
		Name:        s.Name,
		Namespace:   s.Namespace,
		UID:         string(s.UID),
		Type:        string(s.Type),
		Keys:        keys,
		Labels:      s.Labels,
		Annotations: s.Annotations,
		CreatedAt:   s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

// SecretValue returns the decoded UTF-8 value for a single key of a
// Secret. Values are only fetched when the user explicitly asks the UI
// to reveal them — never as part of a list or detail load.
func (w *contextWatcher) SecretValue(namespace, name, key string) (string, error) {
	f := w.factoryFor("Secret")
	if f == nil {
		return "", errKindNoAccess("Secret")
	}
	s, err := f.Core().V1().Secrets().Lister().Secrets(namespace).Get(name)
	if err != nil {
		return "", err
	}
	v, ok := s.Data[key]
	if !ok {
		return "", fmt.Errorf("secret %s/%s has no key %q", namespace, name, key)
	}
	return string(v), nil
}
