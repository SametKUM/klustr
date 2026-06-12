package kube

import (
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"
)

// The frontend encodes a multi-namespace selection as a comma-separated list
// (namespace names cannot contain commas). Listing per selected namespace
// keeps multi-namespace payloads proportional to the selection instead of the
// whole cluster. Returns nil for the single-namespace (or all-namespaces)
// case; sorted so concatenated per-namespace results keep the global
// (namespace, name) ordering the listers produce.
func splitNamespaces(namespace string) []string {
	if !strings.Contains(namespace, ",") {
		return nil
	}
	// Drop empty segments and duplicates: an empty namespace inside a comma
	// set would silently widen the query to the whole cluster, and a
	// duplicate would produce duplicate rows with colliding identities.
	seen := make(map[string]struct{})
	parts := make([]string, 0, strings.Count(namespace, ",")+1)
	for _, ns := range strings.Split(namespace, ",") {
		if ns == "" {
			continue
		}
		if _, ok := seen[ns]; ok {
			continue
		}
		seen[ns] = struct{}{}
		parts = append(parts, ns)
	}
	if len(parts) == 0 {
		return nil
	}
	sort.Strings(parts)
	return parts
}

func listAcrossNamespaces[T any](namespace string, list func(string) []T) []T {
	parts := splitNamespaces(namespace)
	if parts == nil {
		return list(namespace)
	}
	out := []T{}
	for _, ns := range parts {
		out = append(out, list(ns)...)
	}
	return out
}

func listAcrossNamespacesErr[T any](namespace string, list func(string) ([]T, error)) ([]T, error) {
	parts := splitNamespaces(namespace)
	if parts == nil {
		return list(namespace)
	}
	out := []T{}
	for _, ns := range parts {
		items, err := list(ns)
		if err != nil {
			return nil, err
		}
		out = append(out, items...)
	}
	return out, nil
}

func listFromGenericLister(lister cache.GenericLister, namespace string) ([]runtime.Object, error) {
	return listAcrossNamespacesErr(namespace, func(ns string) ([]runtime.Object, error) {
		if ns == "" {
			return lister.List(labels.Everything())
		}
		return lister.ByNamespace(ns).List(labels.Everything())
	})
}

func namespaceFilter(namespace string) func(string) bool {
	parts := splitNamespaces(namespace)
	if parts == nil {
		return nil
	}
	set := make(map[string]struct{}, len(parts))
	for _, ns := range parts {
		set[ns] = struct{}{}
	}
	return func(ns string) bool {
		_, ok := set[ns]
		return ok
	}
}
