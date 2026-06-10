package kube

import (
	"context"
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilrand "k8s.io/apimachinery/pkg/util/rand"
	"k8s.io/client-go/kubernetes"
)

const (
	nodeShellNamespace     = "kube-system"
	nodeShellContainerName = "shell"
	nodeShellImage         = "docker.io/library/alpine:3.22"
	nodeShellReadyTimeout  = 90 * time.Second
)

// nodeShellCommand returns the nsenter invocation for the node's host OS.
//
// nsenter options are the long form, not the short `-t 1 -m -u -i -n -p`
// cluster: the helper image's busybox nsenter mis-parses the short
// optional-arg form on some node runtimes, exec'ing the post-`--` program with
// the wrong argv.
//
// Normal hosts: enter every namespace including --mount, so the shell and `/`
// are the host's. The `sh -c` probe prefers the host's bash and falls back to
// sh — bash is not guaranteed (minimal node VMs such as OrbStack's ship none).
//
// Bottlerocket: its host /bin/sh is `brush`, a sandboxed shell whose
// allow-list refuses almost every program (even `ls`), so a --mount host shell
// is unusable. Instead we skip --mount and run the helper image's own busybox
// shell with the host's pid/net/ipc/uts namespaces, starting in /proc/1/root
// (the live host filesystem). You still see every host process and the whole
// host fs; only the shell binary and `/` come from the helper image.
func nodeShellCommand(osImage string) []string {
	if strings.Contains(strings.ToLower(osImage), "bottlerocket") {
		return []string{
			"nsenter", "--target", "1", "--uts", "--ipc", "--net", "--pid", "--",
			"/bin/sh", "-c", "cd /proc/1/root 2>/dev/null; exec /bin/sh -l",
		}
	}
	return []string{
		"nsenter", "--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", "--",
		"sh", "-c",
		"if command -v bash >/dev/null 2>&1; then exec bash -l; else exec sh -l; fi",
	}
}

// StartNodeShell gives a root shell on the node by creating a privileged
// hostPID pod pinned to it and nsenter-ing into the host's namespaces — the
// same approach as `kubectl node-shell` and Lens. The pod is deleted when the
// session ends; ActiveDeadlineSeconds is the safety net if Klustr dies first.
func (m *ClientManager) StartNodeShell(
	parent context.Context,
	contextName, nodeName string,
	onData ExecDataFunc,
	onClose ExecCloseFunc,
) (string, error) {
	if err := m.assertWritable(contextName); err != nil {
		return "", err
	}
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", err
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return "", err
	}

	osImage := ""
	if node, err := cs.CoreV1().Nodes().Get(parent, nodeName, metav1.GetOptions{}); err == nil {
		osImage = node.Status.NodeInfo.OSImage
	}

	created, err := cs.CoreV1().Pods(nodeShellNamespace).Create(
		parent, nodeShellPod(nodeName), metav1.CreateOptions{FieldManager: "klustr"})
	if err != nil {
		return "", fmt.Errorf("create node-shell pod: %w", err)
	}

	if err := waitPodRunning(parent, cs, nodeShellNamespace, created.Name, nodeShellReadyTimeout); err != nil {
		deleteNodeShellPod(cs, created.Name)
		return "", err
	}

	id, err := m.execs.start(
		parent, cfg, cs, nodeShellNamespace, created.Name, nodeShellContainerName, nodeShellCommand(osImage),
		onData,
		func(err error) {
			deleteNodeShellPod(cs, created.Name)
			if onClose != nil {
				onClose(err)
			}
		},
	)
	if err != nil {
		deleteNodeShellPod(cs, created.Name)
		return "", err
	}
	return id, nil
}

func nodeShellPod(nodeName string) *corev1.Pod {
	privileged := true
	noGrace := int64(0)
	deadline := int64(4 * 60 * 60)
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("klustr-node-shell-%s", utilrand.String(5)),
			Namespace: nodeShellNamespace,
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "klustr",
				"klustr/component":             "node-shell",
			},
		},
		Spec: corev1.PodSpec{
			// Pinning spec.nodeName bypasses the scheduler, so a cordoned
			// node can still be shelled into.
			NodeName:                      nodeName,
			HostPID:                       true,
			HostIPC:                       true,
			HostNetwork:                   true,
			RestartPolicy:                 corev1.RestartPolicyNever,
			TerminationGracePeriodSeconds: &noGrace,
			ActiveDeadlineSeconds:         &deadline,
			Tolerations:                   []corev1.Toleration{{Operator: corev1.TolerationOpExists}},
			Containers: []corev1.Container{{
				Name:            nodeShellContainerName,
				Image:           nodeShellImage,
				Command:         []string{"sleep", "14400"},
				SecurityContext: &corev1.SecurityContext{Privileged: &privileged},
			}},
		},
	}
}

func waitPodRunning(ctx context.Context, cs kubernetes.Interface, namespace, name string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	lastState := "Pending"
	for {
		pod, err := cs.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return fmt.Errorf("node-shell pod %q disappeared while starting", name)
		}
		if err == nil {
			switch pod.Status.Phase {
			case corev1.PodRunning:
				return nil
			case corev1.PodSucceeded, corev1.PodFailed:
				return fmt.Errorf("node-shell pod %q exited before attach (%s)", name, podStartState(pod))
			}
			lastState = podStartState(pod)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("timed out waiting for node-shell pod %q to start (%s)", name, lastState)
		case <-time.After(500 * time.Millisecond):
		}
	}
}

func podStartState(pod *corev1.Pod) string {
	for _, cs := range pod.Status.ContainerStatuses {
		if w := cs.State.Waiting; w != nil && w.Reason != "" {
			return w.Reason
		}
		if t := cs.State.Terminated; t != nil && t.Reason != "" {
			return t.Reason
		}
	}
	if pod.Status.Reason != "" {
		return pod.Status.Reason
	}
	return string(pod.Status.Phase)
}

// deleteNodeShellPod is fire-and-forget: the session is already over, so the
// user has nothing to wait on, and ActiveDeadlineSeconds covers a lost delete.
func deleteNodeShellPod(cs kubernetes.Interface, name string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		noGrace := int64(0)
		_ = cs.CoreV1().Pods(nodeShellNamespace).Delete(ctx, name, metav1.DeleteOptions{GracePeriodSeconds: &noGrace})
	}()
}
