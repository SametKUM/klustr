package kube

import (
	"context"
	"encoding/base64"
	"fmt"
	"sort"
	"time"
	"unicode/utf8"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// SecretValueResult carries a revealed secret value across the bridge. Binary
// (non-UTF-8) values are base64-encoded and flagged, because a raw string would
// have every invalid byte replaced with U+FFFD during JSON marshaling —
// silently corrupting a copied .p12/gzip/key blob.
type SecretValueResult struct {
	Value  string `json:"value"`
	Binary bool   `json:"binary"`
}

// encodeSecretValue returns the value as text when it is valid UTF-8, otherwise
// its base64 encoding with binary=true so the UI can label it and copy it
// losslessly.
func encodeSecretValue(v []byte) SecretValueResult {
	if utf8.Valid(v) {
		return SecretValueResult{Value: string(v), Binary: false}
	}
	return SecretValueResult{Value: base64.StdEncoding.EncodeToString(v), Binary: true}
}

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
func (w *contextWatcher) SecretValue(ctx context.Context, namespace, name, key string) (SecretValueResult, error) {
	f := w.factoryFor("Secret")
	if f == nil {
		return SecretValueResult{}, errKindNoAccess("Secret")
	}
	s, err := w.cs.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return SecretValueResult{}, err
	}
	v, ok := s.Data[key]
	if !ok {
		return SecretValueResult{}, fmt.Errorf("secret %s/%s has no key %q", namespace, name, key)
	}
	return encodeSecretValue(v), nil
}
