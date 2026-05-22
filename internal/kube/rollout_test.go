package kube

import (
	"encoding/json"
	"slices"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestIsOwnedBy(t *testing.T) {
	refs := []metav1.OwnerReference{
		{Kind: "Deployment", Name: "demo"},
		{Kind: "ReplicaSet", Name: "demo-abc"},
	}
	if !isOwnedBy(refs, "Deployment", "demo") {
		t.Error("expected match on Deployment/demo")
	}
	if isOwnedBy(refs, "Deployment", "other") {
		t.Error("name mismatch should not match")
	}
	if isOwnedBy(refs, "StatefulSet", "demo") {
		t.Error("kind mismatch should not match")
	}
	if isOwnedBy(nil, "Deployment", "demo") {
		t.Error("nil refs should not match")
	}
	if isOwnedBy([]metav1.OwnerReference{}, "Deployment", "demo") {
		t.Error("empty refs should not match")
	}
}

func TestImagesFromControllerRevision(t *testing.T) {
	t.Run("empty payload", func(t *testing.T) {
		got := imagesFromControllerRevision(nil)
		if len(got) != 0 {
			t.Fatalf("got %v, want empty", got)
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		got := imagesFromControllerRevision([]byte("not json"))
		if len(got) != 0 {
			t.Fatalf("got %v, want empty for invalid JSON", got)
		}
	})

	t.Run("happy path", func(t *testing.T) {
		raw := []byte(`{
			"spec": {
				"template": {
					"spec": {
						"containers": [
							{"name": "app", "image": "nginx:1.27"},
							{"name": "sidecar", "image": "envoy:v1.30"}
						]
					}
				}
			}
		}`)
		got := imagesFromControllerRevision(raw)
		want := []string{"nginx:1.27", "envoy:v1.30"}
		if !slices.Equal(got, want) {
			t.Fatalf("got %v, want %v", got, want)
		}
	})
}

func TestControllerRevisionToWorkloadRevision(t *testing.T) {
	raw, err := json.Marshal(map[string]any{
		"spec": map[string]any{
			"template": map[string]any{
				"spec": map[string]any{
					"containers": []map[string]any{
						{"name": "main", "image": "busybox:1.36"},
					},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	cr := &appsv1.ControllerRevision{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "ss-77c8",
			Annotations: map[string]string{changeCauseAnnotation: "kubectl set image"},
		},
		Revision: 4,
		Data:     runtime.RawExtension{Raw: raw},
	}

	got := controllerRevisionToWorkloadRevision(cr, "ss-77c8")
	if got.Revision != 4 {
		t.Errorf("revision: got %d, want 4", got.Revision)
	}
	if got.ChangeCause != "kubectl set image" {
		t.Errorf("change cause: got %q", got.ChangeCause)
	}
	if !got.Active {
		t.Error("should be Active when current revision name matches")
	}
	if !slices.Equal(got.Images, []string{"busybox:1.36"}) {
		t.Errorf("images: got %v", got.Images)
	}

	inactive := controllerRevisionToWorkloadRevision(cr, "different-name")
	if inactive.Active {
		t.Error("should not be Active when current revision name differs")
	}
}
