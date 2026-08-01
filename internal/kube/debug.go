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
	// Pinned, not :latest — an unpinned tag makes the kubelet default to
	// imagePullPolicy: Always, so every debug session re-pulls a ~600 MB image
	// and a cold node can outrun debugReadyTimeout.
	defaultDebugImage    = "nicolaka/netshoot:v0.16"
	defaultDebugShell    = "/bin/sh"
	debugContainerPrefix = "klustr-debugger-"
	debugReadyTimeout    = 90 * time.Second
)

// DebugSession is what StartPodDebug hands back: the live exec session id plus
// the ephemeral container it created, so a reattach is a plain StartExec into
// the same container rather than a second injection.
type DebugSession struct {
	SessionID     string `json:"sessionID"`
	ContainerName string `json:"containerName"`
}

// debugEphemeralContainer builds the ephemeral container kubectl-debug injects.
// The keep-alive command is a large fixed number, not `sleep infinity`, because
// busybox/alpine `sleep` (netshoot, busybox, alpine images) reject the word
// "infinity". TargetContainerName joins the target's PID namespace, which is
// what makes its processes visible.
//
// elevated adds CAP_SYS_PTRACE. Reading the target's filesystem through
// /proc/<pid>/root needs ptrace permission, and the container runtime's default
// capability set omits it — without this, that path is "Permission denied" even
// as root. It stays opt-in because the PodSecurity baseline policy rejects any
// added capability except NET_BIND_SERVICE, so defaulting it on would make
// debugging impossible in exactly the hardened namespaces that need it.
func debugEphemeralContainer(name, image, target string, elevated bool) corev1.EphemeralContainer {
	ec := corev1.EphemeralContainer{
		EphemeralContainerCommon: corev1.EphemeralContainerCommon{
			Name:            name,
			Image:           image,
			ImagePullPolicy: corev1.PullIfNotPresent,
			Command:         []string{"sleep", "2147483647"},
			Stdin:           true,
			TTY:             true,
		},
	}
	if target != "" {
		ec.TargetContainerName = target
	}
	if elevated {
		ec.SecurityContext = &corev1.SecurityContext{
			Capabilities: &corev1.Capabilities{Add: []corev1.Capability{"SYS_PTRACE"}},
		}
	}
	return ec
}

// runningEphemeralContainer reports whether the named ephemeral container is
// Running; otherwise it returns the Waiting/Terminated reason (empty when the
// container is not present in status yet). terminal is true for Terminated —
// the kubelet never restarts an ephemeral container, so that state is
// permanent the instant it's observed, unlike a Waiting reason which may
// still resolve on its own.
func runningEphemeralContainer(status *corev1.PodStatus, name string) (running bool, reason string, terminal bool) {
	for i := range status.EphemeralContainerStatuses {
		cs := &status.EphemeralContainerStatuses[i]
		if cs.Name != name {
			continue
		}
		switch {
		case cs.State.Running != nil:
			return true, "", false
		case cs.State.Waiting != nil:
			return false, cs.State.Waiting.Reason, false
		case cs.State.Terminated != nil:
			r := cs.State.Terminated.Reason
			if r == "" {
				r = fmt.Sprintf("Terminated (exit %d)", cs.State.Terminated.ExitCode)
			}
			return false, r, true
		}
		return false, "", false
	}
	return false, "", false
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
			running, reason, terminal := runningEphemeralContainer(&pod.Status, containerName)
			if running {
				return nil
			}
			if terminal {
				return fmt.Errorf("debug container %q terminated before ready: %s", containerName, reason)
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
	contextName, namespace, podName, target, image, shell string,
	elevated bool,
	onData ExecDataFunc,
	onClose ExecCloseFunc,
) (DebugSession, error) {
	if err := m.assertWritable(contextName); err != nil {
		return DebugSession{}, err
	}
	if image == "" {
		image = defaultDebugImage
	}
	if shell == "" {
		shell = defaultDebugShell
	}
	cs, err := m.Clientset(contextName)
	if err != nil {
		return DebugSession{}, err
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return DebugSession{}, err
	}

	pod, err := cs.CoreV1().Pods(namespace).Get(parent, podName, metav1.GetOptions{})
	if err != nil {
		return DebugSession{}, fmt.Errorf("get pod: %w", err)
	}

	name := debugContainerPrefix + utilrand.String(5)
	pod.Spec.EphemeralContainers = append(pod.Spec.EphemeralContainers, debugEphemeralContainer(name, image, target, elevated))

	if _, err := cs.CoreV1().Pods(namespace).UpdateEphemeralContainers(
		parent, podName, pod, metav1.UpdateOptions{FieldManager: "klustr"}); err != nil {
		return DebugSession{}, fmt.Errorf("add debug container: %w", err)
	}

	if err := waitEphemeralRunning(parent, cs, namespace, podName, name, debugReadyTimeout); err != nil {
		return DebugSession{}, err
	}

	id, err := m.execs.start(parent, cfg, cs, contextName, namespace, podName, name, []string{shell}, onData, onClose)
	if err != nil {
		return DebugSession{}, err
	}
	return DebugSession{SessionID: id, ContainerName: name}, nil
}
