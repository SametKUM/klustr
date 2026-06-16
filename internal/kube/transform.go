package kube

import (
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/tools/cache"
)

// stripManagedFields is an informer TransformFunc that drops
// metadata.managedFields from every object before it enters the shared cache.
// managedFields is large (one entry per field-manager, each carrying a FieldsV1
// set) and nothing in Klustr reads it: the lean list projections (podInfoFrom et
// al.) never touch it, and the YAML detail view fetches live from the API and
// strips managedFields itself (mutate.go sanitizeForYAML). Stripping it shrinks
// every cached object with zero behavioral change. Conservative on purpose —
// only managedFields is cleared; annotations (incl. last-applied-configuration,
// which *Detail builders surface) are left intact.
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
	return obj, nil
}
