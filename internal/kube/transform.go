package kube

import (
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/tools/cache"
)

// stripManagedFields is an informer TransformFunc that drops the large
// metadata.managedFields from every cached object and replaces Secret values
// with same-length zero buffers. Nothing reads either from the cache: the YAML
// view and Secret Reveal fetch live, and key names and sizes survive for the
// list and detail views.
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
