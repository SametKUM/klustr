package kube

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilrand "k8s.io/apimachinery/pkg/util/rand"
	"k8s.io/client-go/kubernetes"
)

const (
	defaultDebugImage    = "nicolaka/netshoot"
	debugContainerPrefix = "klustr-debugger-"
	debugReadyTimeout    = 90 * time.Second
)

// debugEphemeralContainer builds the ephemeral container kubectl-debug injects.
// The keep-alive command is a large fixed number, not `sleep infinity`, because
// busybox/alpine `sleep` (netshoot, busybox, alpine images) reject the word
// "infinity". TargetContainerName shares the target's PID namespace so the
// debug shell reaches the target filesystem at /proc/1/root.
func debugEphemeralContainer(name, image, target string) corev1.EphemeralContainer {
	ec := corev1.EphemeralContainer{
		EphemeralContainerCommon: corev1.EphemeralContainerCommon{
			Name:    name,
			Image:   image,
			Command: []string{"sleep", "2147483647"},
			Stdin:   true,
			TTY:     true,
		},
	}
	if target != "" {
		ec.TargetContainerName = target
	}
	return ec
}

// runningEphemeralContainer reports whether the named ephemeral container is
// Running; otherwise it returns the Waiting/Terminated reason (empty when the
// container is not present in status yet).
func runningEphemeralContainer(status *corev1.PodStatus, name string) (bool, string) {
	for i := range status.EphemeralContainerStatuses {
		cs := &status.EphemeralContainerStatuses[i]
		if cs.Name != name {
			continue
		}
		switch {
		case cs.State.Running != nil:
			return true, ""
		case cs.State.Waiting != nil:
			return false, cs.State.Waiting.Reason
		case cs.State.Terminated != nil:
			r := cs.State.Terminated.Reason
			if r == "" {
				r = fmt.Sprintf("Terminated (exit %d)", cs.State.Terminated.ExitCode)
			}
			return false, r
		}
		return false, ""
	}
	return false, ""
}

// waitEphemeralRunning polls until the named ephemeral container is Running.
// A pull/create failure is returned immediately rather than waiting out the
// timeout, so the UI shows the real reason.
func waitEphemeralRunning(ctx context.Context, cs kubernetes.Interface, namespace, podName, containerName string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	lastReason := "Pending"
	for {
		pod, err := cs.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return fmt.Errorf("pod %q disappeared while starting debug container", podName)
		}
		if err == nil {
			running, reason := runningEphemeralContainer(&pod.Status, containerName)
			if running {
				return nil
			}
			switch reason {
			case "ErrImagePull", "ImagePullBackOff", "InvalidImageName",
				"CreateContainerConfigError", "CreateContainerError":
				return fmt.Errorf("debug container %q failed to start: %s", containerName, reason)
			}
			if reason != "" {
				lastReason = reason
			}
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("timed out waiting for debug container %q to start (%s)", containerName, lastReason)
		case <-time.After(500 * time.Millisecond):
		}
	}
}

// StartPodDebug injects an ephemeral debug container into a running pod and
// execs a shell into it — the ephemeral-container mode of `kubectl debug`, for
// pods whose own containers ship no shell. The container shares the target
// container's process namespace. Ephemeral containers cannot be removed, so the
// keep-alive container lingers until the pod restarts; reattach is a plain
// StartExec into the returned container name, never a second injection.
func (m *ClientManager) StartPodDebug(
	parent context.Context,
	contextName, namespace, podName, target, image string,
	onData ExecDataFunc,
	onClose ExecCloseFunc,
) (string, string, error) {
	if err := m.assertWritable(contextName); err != nil {
		return "", "", err
	}
	if image == "" {
		image = defaultDebugImage
	}
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", "", err
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return "", "", err
	}

	pod, err := cs.CoreV1().Pods(namespace).Get(parent, podName, metav1.GetOptions{})
	if err != nil {
		return "", "", fmt.Errorf("get pod: %w", err)
	}

	name := debugContainerPrefix + utilrand.String(5)
	pod.Spec.EphemeralContainers = append(pod.Spec.EphemeralContainers, debugEphemeralContainer(name, image, target))

	if _, err := cs.CoreV1().Pods(namespace).UpdateEphemeralContainers(
		parent, podName, pod, metav1.UpdateOptions{FieldManager: "klustr"}); err != nil {
		return "", "", fmt.Errorf("add debug container: %w", err)
	}

	if err := waitEphemeralRunning(parent, cs, namespace, podName, name, debugReadyTimeout); err != nil {
		return "", "", err
	}

	id, err := m.execs.start(parent, cfg, cs, contextName, namespace, podName, name, []string{"/bin/sh"}, onData, onClose)
	if err != nil {
		return "", "", err
	}
	return id, name, nil
}
