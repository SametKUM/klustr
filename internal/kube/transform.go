package kube

import (
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
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

// crCachePrunedFields lists, per CR resource, fields too large to keep in the
// informer cache that no list projection reads. Tekton copies the whole
// resolved Task/Pipeline spec into every run's status: on a CI cluster with
// ~7k TaskRuns, status.taskSpec alone was over 70% of the payload. Detail
// builders that need these fields read the object live.
var crCachePrunedFields = map[schema.GroupResource][][]string{
	{Group: tektonGroup, Resource: tektonTaskRunsResource}:     {{"status", "taskSpec"}, {"status", "provenance"}},
	{Group: tektonGroup, Resource: tektonPipelineRunsResource}: {{"status", "pipelineSpec"}, {"status", "provenance"}},
}

// transformForCR returns the informer TransformFunc for a CR GVR:
// stripManagedFields, plus dropping the resource's crCachePrunedFields.
func transformForCR(gvr schema.GroupVersionResource) cache.TransformFunc {
	pruned := crCachePrunedFields[gvr.GroupResource()]
	if len(pruned) == 0 {
		return stripManagedFields
	}
	return func(obj any) (any, error) {
		obj, err := stripManagedFields(obj)
		if err != nil {
			return obj, err
		}
		if u, ok := obj.(*unstructured.Unstructured); ok {
			for _, path := range pruned {
				unstructured.RemoveNestedField(u.Object, path...)
			}
		}
		return obj, nil
	}
}
