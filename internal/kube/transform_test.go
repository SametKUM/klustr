package kube

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"
)

func TestStripManagedFieldsClearsOnlyManagedFields(t *testing.T) {
	pod := makePod(0)
	if len(pod.ManagedFields) == 0 {
		t.Fatal("fixture should carry managedFields")
	}

	out, err := stripManagedFields(pod)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got, ok := out.(*corev1.Pod)
	if !ok {
		t.Fatalf("transform must return the same type, got %T", out)
	}
	if got.GetManagedFields() != nil {
		t.Fatalf("managedFields should be cleared, got %d entries", len(got.GetManagedFields()))
	}
	// Everything the UI actually reads must survive.
	if got.Name != pod.Name || got.Namespace != pod.Namespace {
		t.Fatal("identity must be preserved")
	}
	if len(got.Spec.Containers) != 2 || got.Spec.NodeName == "" {
		t.Fatal("spec must be preserved")
	}
	if got.Labels["app"] == "" {
		t.Fatal("labels must be preserved")
	}
	if got.Status.Phase != corev1.PodRunning {
		t.Fatal("status must be preserved")
	}
}

func TestStripManagedFieldsPassesTombstones(t *testing.T) {
	tomb := cache.DeletedFinalStateUnknown{Key: "ns/name", Obj: makePod(0)}
	out, err := stripManagedFields(tomb)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := out.(cache.DeletedFinalStateUnknown); !ok {
		t.Fatalf("tombstone must pass through untouched, got %T", out)
	}
}

func TestStripManagedFieldsNoManagedFieldsIsNoop(t *testing.T) {
	pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "n"}}
	out, err := stripManagedFields(pod)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.(*corev1.Pod).GetManagedFields() != nil {
		t.Fatal("expected nil managedFields to stay nil")
	}
}

func TestStripManagedFieldsZerosCachedSecretValues(t *testing.T) {
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "credentials", Namespace: "prod"},
		Data: map[string][]byte{
			"token": []byte("super-secret"),
		},
	}

	out, err := stripManagedFields(secret)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	value := out.(*corev1.Secret).Data["token"]
	if len(value) != len("super-secret") {
		t.Fatalf("value length must survive for key-size metadata, got %d", len(value))
	}
	for _, b := range value {
		if b != 0 {
			t.Fatal("cached secret value must be zeroed")
		}
	}
}
