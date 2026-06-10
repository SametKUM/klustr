package kube

import (
	"slices"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func drainPod(name string, mutate func(*corev1.Pod)) corev1.Pod {
	p := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Status:     corev1.PodStatus{Phase: corev1.PodRunning},
	}
	if mutate != nil {
		mutate(&p)
	}
	return p
}

func TestDrainTargets(t *testing.T) {
	controller := true
	pods := []corev1.Pod{
		drainPod("app", nil),
		drainPod("ds-managed", func(p *corev1.Pod) {
			p.OwnerReferences = []metav1.OwnerReference{
				{Kind: "DaemonSet", Name: "fluentd", Controller: &controller},
			}
		}),
		drainPod("rs-managed", func(p *corev1.Pod) {
			p.OwnerReferences = []metav1.OwnerReference{
				{Kind: "ReplicaSet", Name: "web-abc", Controller: &controller},
			}
		}),
		drainPod("mirror", func(p *corev1.Pod) {
			p.Annotations = map[string]string{corev1.MirrorPodAnnotationKey: "x"}
		}),
		drainPod("finished", func(p *corev1.Pod) {
			p.Status.Phase = corev1.PodSucceeded
		}),
		drainPod("crashed", func(p *corev1.Pod) {
			p.Status.Phase = corev1.PodFailed
		}),
	}

	got := podKeys(drainTargets(pods))
	want := []string{"default/app", "default/rs-managed"}
	if !slices.Equal(got, want) {
		t.Fatalf("drainTargets = %v, want %v", got, want)
	}
}

func TestPodKeysSorted(t *testing.T) {
	pods := []corev1.Pod{
		{ObjectMeta: metav1.ObjectMeta{Name: "b", Namespace: "kube-system"}},
		{ObjectMeta: metav1.ObjectMeta{Name: "a", Namespace: "default"}},
	}
	got := podKeys(pods)
	want := []string{"default/a", "kube-system/b"}
	if !slices.Equal(got, want) {
		t.Fatalf("podKeys = %v, want %v", got, want)
	}
}

func TestNodeShellPodSpec(t *testing.T) {
	pod := nodeShellPod("worker-1")
	if pod.Spec.NodeName != "worker-1" {
		t.Fatalf("NodeName = %q, want worker-1", pod.Spec.NodeName)
	}
	if !pod.Spec.HostPID {
		t.Fatal("node-shell pod must set hostPID for nsenter -t 1")
	}
	c := pod.Spec.Containers[0]
	if c.SecurityContext == nil || c.SecurityContext.Privileged == nil || !*c.SecurityContext.Privileged {
		t.Fatal("node-shell container must be privileged")
	}
	if pod.Spec.ActiveDeadlineSeconds == nil || *pod.Spec.ActiveDeadlineSeconds <= 0 {
		t.Fatal("node-shell pod must self-destruct via activeDeadlineSeconds")
	}
	if len(pod.Spec.Tolerations) == 0 || pod.Spec.Tolerations[0].Operator != corev1.TolerationOpExists {
		t.Fatal("node-shell pod must tolerate every taint")
	}
}
