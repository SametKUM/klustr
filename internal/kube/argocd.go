package kube

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// ArgoApplicationResource describes one managed resource as Argo reports it
// under Application.status.resources. The frontend turns each row into a
// clickable link that opens that resource's detail panel.
type ArgoApplicationResource struct {
	Group     string `json:"group"`
	Version   string `json:"version"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Sync      string `json:"sync"`
	Health    string `json:"health"`
	Message   string `json:"message"`
}

// argoApplicationGVR is the canonical GVR for argoproj.io/v1alpha1 Applications.
// Argo CD has used the same group + v1alpha1 storage version since 1.0.
var argoApplicationGVR = schema.GroupVersionResource{
	Group:    "argoproj.io",
	Version:  "v1alpha1",
	Resource: "applications",
}

// SyncArgoApplication triggers a sync on an Argo CD Application by writing the
// top-level `operation.sync` field. The Argo application-controller watches
// for `operation` being set, runs the sync, then clears the field once done.
//
// revision is the git ref to sync to ("" → "HEAD" which means the target
// revision currently stored in spec.source.targetRevision).
func (m *ClientManager) SyncArgoApplication(ctx context.Context, contextName, namespace, name, revision string, prune bool) error {
	if revision == "" {
		revision = "HEAD"
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}
	patch := map[string]any{
		"operation": map[string]any{
			"initiatedBy": map[string]any{
				"username":  "klustr",
				"automated": false,
			},
			"sync": map[string]any{
				"revision": revision,
				"prune":    prune,
				"syncStrategy": map[string]any{
					"hook": map[string]any{},
				},
			},
		},
	}
	body, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	_, err = dyn.Resource(argoApplicationGVR).Namespace(namespace).Patch(
		ctx, name, types.MergePatchType, body, metav1.PatchOptions{},
	)
	if err != nil {
		return fmt.Errorf("sync %s/%s: %w", namespace, name, err)
	}
	return nil
}

// ListArgoApplicationResources reads the Application's status.resources slice
// and returns it in a typed form so the frontend can render a table of
// managed resources and let the user drill into each one.
func (m *ClientManager) ListArgoApplicationResources(ctx context.Context, contextName, namespace, name string) ([]ArgoApplicationResource, error) {
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	obj, err := dyn.Resource(argoApplicationGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return extractArgoResources(obj), nil
}

func extractArgoResources(obj *unstructured.Unstructured) []ArgoApplicationResource {
	raw, found, err := unstructured.NestedSlice(obj.Object, "status", "resources")
	if err != nil || !found {
		return []ArgoApplicationResource{}
	}
	out := make([]ArgoApplicationResource, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		group, _ := m["group"].(string)
		version, _ := m["version"].(string)
		kind, _ := m["kind"].(string)
		ns, _ := m["namespace"].(string)
		name, _ := m["name"].(string)
		status, _ := m["status"].(string)
		var health, message string
		if h, ok := m["health"].(map[string]any); ok {
			health, _ = h["status"].(string)
			message, _ = h["message"].(string)
		}
		if kind == "" || name == "" {
			continue
		}
		out = append(out, ArgoApplicationResource{
			Group:     group,
			Version:   version,
			Kind:      kind,
			Namespace: ns,
			Name:      name,
			Sync:      status,
			Health:    health,
			Message:   message,
		})
	}
	return out
}

// RefreshArgoApplication forces Argo to recompute the Application's status
// without running a sync, via the `argocd.argoproj.io/refresh` annotation.
// mode is "normal" or "hard"; empty defaults to "normal".
func (m *ClientManager) RefreshArgoApplication(ctx context.Context, contextName, namespace, name, mode string) error {
	if mode == "" {
		mode = "normal"
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}
	patch := map[string]any{
		"metadata": map[string]any{
			"annotations": map[string]any{
				"argocd.argoproj.io/refresh": mode,
			},
		},
	}
	body, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	_, err = dyn.Resource(argoApplicationGVR).Namespace(namespace).Patch(
		ctx, name, types.MergePatchType, body, metav1.PatchOptions{},
	)
	if err != nil {
		return fmt.Errorf("refresh %s/%s: %w", namespace, name, err)
	}
	return nil
}
