package kube

import (
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/tools/cache"
)

// stripManagedFields is an informer TransformFunc that drops
// metadata.managedFields from every object before it enters the shared cache
// and replaces Secret values with same-length zero buffers.
// managedFields is large (one entry per field-manager, each carrying a FieldsV1
// set) and nothing in Klustr reads it: the lean list projections (podInfoFrom et
// al.) never touch it, and the YAML detail view fetches live from the API and
// strips managedFields itself (mutate.go sanitizeForYAML). Stripping it shrinks
// every cached object. Secret key names and sizes remain available for list and
// detail metadata, while Reveal fetches the value live from the API. Annotations
// (including last-applied-configuration, which detail builders surface) remain.
func stripManagedFields(obj any) (any, error) {
	// Tombstones arrive on delete; leave them untouched.
	if _, ok := obj.(cache.DeletedFinalStateUnknown); ok {
		return obj, nil
	}
	accessor, err := meta.Accessor(obj)
	if err != nil {
		// Not a metav1.Object (shouldn't happen for typed informers); leave as-is.
		return obj, nil
	}
	if accessor.GetManagedFields() != nil {
		accessor.SetManagedFields(nil)
	}
	if secret, ok := obj.(*corev1.Secret); ok {
		for key, value := range secret.Data {
			secret.Data[key] = make([]byte, len(value))
		}
	}
	return obj, nil
}
