package kube

import (
	"context"
	"encoding/json"
	"slices"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

// Rollback must REPLACE the pod template, not strategic-merge it: a merge keys
// PodSpec lists on name, so a sidecar/env a newer revision added would survive
// the rollback. Revert rev2 (app+env, sidecar) to rev1 (app only) and assert
// the sidecar and env are gone.
func TestRollbackDeploymentReplacesTemplate(t *testing.T) {
	ownerRef := metav1.OwnerReference{Kind: "Deployment", Name: "demo"}
	rs1 := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:       "default",
			Name:            "demo-rev1",
			OwnerReferences: []metav1.OwnerReference{ownerRef},
			Annotations:     map[string]string{deploymentRevisionAnnotation: "1"},
		},
		Spec: appsv1.ReplicaSetSpec{
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "demo", podTemplateHashLabel: "rev1hash"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "busybox:1"}}},
			},
		},
	}
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "demo"},
		Spec: appsv1.DeploymentSpec{
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "demo"}},
				Spec: corev1.PodSpec{Containers: []corev1.Container{
					{Name: "app", Image: "busybox:2", Env: []corev1.EnvVar{{Name: "LOG_LEVEL", Value: "debug"}}},
					{Name: "sidecar", Image: "busybox:2"},
				}},
			},
		},
	}

	cs := fake.NewSimpleClientset(rs1, dep)
	if err := rollbackDeploymentToRevision(context.Background(), cs, "default", "demo", 1); err != nil {
		t.Fatal(err)
	}

	got, err := cs.AppsV1().Deployments("default").Get(context.Background(), "demo", metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	names := make([]string, 0, len(got.Spec.Template.Spec.Containers))
	for _, c := range got.Spec.Template.Spec.Containers {
		names = append(names, c.Name)
	}
	if !slices.Equal(names, []string{"app"}) {
		t.Errorf("containers = %v, want [app] (sidecar must be removed by a full replace)", names)
	}
	if len(got.Spec.Template.Spec.Containers[0].Env) != 0 {
		t.Errorf("app env = %v, want none after rollback to rev1", got.Spec.Template.Spec.Containers[0].Env)
	}
	if _, ok := got.Spec.Template.Labels[podTemplateHashLabel]; ok {
		t.Error("pod-template-hash label should be stripped from the rolled-back template")
	}
	if got.Annotations[changeCauseAnnotation] == "" {
		t.Error("change-cause annotation not recorded")
	}
}

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
