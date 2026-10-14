package kube

import (
	"context"
	"encoding/json"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/util/retry"
)

// Integration actions (Argo CD sync, Flux reconcile, cert-manager renew,
// Tekton cancel, …) write only through the helpers in this file. Each starts
// from writableResource, so a read-only context is refused before any request
// and the CR is addressed at the version the cluster serves.

// writableResource is the dynamic client actions write through: it fails with
// errReadOnly first, then resolves the served version.
func (m *ClientManager) writableResource(contextName string, gr schema.GroupResource, namespace string) (dynamic.ResourceInterface, error) {
	if err := m.assertWritable(contextName); err != nil {
		return nil, err
	}
	return m.servedClient(contextName, gr, namespace)
}

// mergePatchCR sends patch, marshaled to JSON, as a merge patch to one CR.
func (m *ClientManager) mergePatchCR(ctx context.Context, contextName string, gr schema.GroupResource, namespace, name string, patch any) error {
	ri, err := m.writableResource(contextName, gr, namespace)
	if err != nil {
		return err
	}
	body, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	_, err = ri.Patch(ctx, name, types.MergePatchType, body, metav1.PatchOptions{})
	return err
}

// updateCR applies mutate to a fresh copy of the named CR and writes it back.
// Controllers rewrite status on every reconcile, so a single Get → Update
// races them and 409s; the whole round is retried on conflict. mutate reports
// whether it changed anything, and an unchanged object is not written.
func updateCR(ctx context.Context, ri dynamic.ResourceInterface, name string, mutate func(*unstructured.Unstructured) (bool, error)) error {
	return retryUpdate(ctx, ri, name, false, mutate)
}

// updateCRStatus is updateCR through the status subresource.
func updateCRStatus(ctx context.Context, ri dynamic.ResourceInterface, name string, mutate func(*unstructured.Unstructured) (bool, error)) error {
	return retryUpdate(ctx, ri, name, true, mutate)
}

func retryUpdate(ctx context.Context, ri dynamic.ResourceInterface, name string, status bool, mutate func(*unstructured.Unstructured) (bool, error)) error {
	// The callback returns raw errors: RetryOnConflict inspects the error
	// directly and does not unwrap a wrapped 409.
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := ri.Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		changed, err := mutate(obj)
		if err != nil || !changed {
			return err
		}
		if status {
			_, err = ri.UpdateStatus(ctx, obj, metav1.UpdateOptions{})
		} else {
			_, err = ri.Update(ctx, obj, metav1.UpdateOptions{})
		}
		return err
	})
}
