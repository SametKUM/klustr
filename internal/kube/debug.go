package kube

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
)

const (
	defaultDebugImage    = "nicolaka/netshoot"
	debugContainerPrefix = "klustr-debugger-"
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
