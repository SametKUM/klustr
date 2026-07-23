package kube

import (
	"context"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestDebugEphemeralContainer(t *testing.T) {
	ec := debugEphemeralContainer("klustr-debugger-abcde", "nicolaka/netshoot", "app")
	if ec.Name != "klustr-debugger-abcde" {
		t.Errorf("name = %q", ec.Name)
	}
	if ec.Image != "nicolaka/netshoot" {
		t.Errorf("image = %q", ec.Image)
	}
	if !ec.Stdin || !ec.TTY {
		t.Errorf("stdin=%v tty=%v, want both true", ec.Stdin, ec.TTY)
	}
	if got := ec.Command; len(got) != 2 || got[0] != "sleep" {
		t.Errorf("command = %v, want a sleep keep-alive", got)
	}
	if ec.TargetContainerName != "app" {
		t.Errorf("targetContainerName = %q, want app", ec.TargetContainerName)
	}
}

func TestDebugEphemeralContainerNoTarget(t *testing.T) {
	ec := debugEphemeralContainer("klustr-debugger-abcde", "busybox", "")
	if ec.TargetContainerName != "" {
		t.Errorf("targetContainerName = %q, want empty", ec.TargetContainerName)
	}
}

func TestRunningEphemeralContainer(t *testing.T) {
	status := &corev1.PodStatus{
		EphemeralContainerStatuses: []corev1.ContainerStatus{
			{Name: "dbg", State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
		},
	}
	if running, reason := runningEphemeralContainer(status, "dbg"); !running || reason != "" {
		t.Errorf("running=%v reason=%q, want true/empty", running, reason)
	}
}

func TestRunningEphemeralContainerWaiting(t *testing.T) {
	status := &corev1.PodStatus{
		EphemeralContainerStatuses: []corev1.ContainerStatus{
			{Name: "dbg", State: corev1.ContainerState{
				Waiting: &corev1.ContainerStateWaiting{Reason: "ImagePullBackOff"},
			}},
		},
	}
	if running, reason := runningEphemeralContainer(status, "dbg"); running || reason != "ImagePullBackOff" {
		t.Errorf("running=%v reason=%q, want false/ImagePullBackOff", running, reason)
	}
}

func TestRunningEphemeralContainerAbsent(t *testing.T) {
	status := &corev1.PodStatus{}
	if running, reason := runningEphemeralContainer(status, "dbg"); running || reason != "" {
		t.Errorf("running=%v reason=%q, want false/empty", running, reason)
	}
}

func TestWaitEphemeralRunningReady(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "ns"},
		Status: corev1.PodStatus{
			EphemeralContainerStatuses: []corev1.ContainerStatus{
				{Name: "dbg", State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
			},
		},
	}
	cs := fake.NewSimpleClientset(pod)
	if err := waitEphemeralRunning(context.Background(), cs, "ns", "p", "dbg", time.Second); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestWaitEphemeralRunningImagePullFails(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "ns"},
		Status: corev1.PodStatus{
			EphemeralContainerStatuses: []corev1.ContainerStatus{
				{Name: "dbg", State: corev1.ContainerState{
					Waiting: &corev1.ContainerStateWaiting{Reason: "ImagePullBackOff"},
				}},
			},
		},
	}
	cs := fake.NewSimpleClientset(pod)
	err := waitEphemeralRunning(context.Background(), cs, "ns", "p", "dbg", time.Second)
	if err == nil {
		t.Fatal("expected an error on ImagePullBackOff")
	}
}

func TestWaitEphemeralRunningTimeout(t *testing.T) {
	pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "ns"}}
	cs := fake.NewSimpleClientset(pod)
	err := waitEphemeralRunning(context.Background(), cs, "ns", "p", "dbg", 50*time.Millisecond)
	if err == nil {
		t.Fatal("expected a timeout error")
	}
}
