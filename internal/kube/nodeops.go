package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func (m *ClientManager) SetNodeCordon(ctx context.Context, contextName, nodeName string, cordon bool) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}
	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	patch, err := json.Marshal(map[string]any{"spec": map[string]any{"unschedulable": cordon}})
	if err != nil {
		return err
	}
	_, err = cs.CoreV1().Nodes().Patch(
		ctx, nodeName, types.MergePatchType, patch,
		metav1.PatchOptions{FieldManager: "klustr"},
	)
	return err
}

// NodeDrainProgress is streamed to the frontend while a drain runs. Phase is
// one of cordoning / evicting / waiting / done; Pending holds "ns/name" of
// pods still on the node; Error carries the most recent eviction failure
// (e.g. a PDB block) without stopping the drain.
type NodeDrainProgress struct {
	Node    string   `json:"node"`
	Phase   string   `json:"phase"`
	Total   int      `json:"total"`
	Evicted int      `json:"evicted"`
	Pending []string `json:"pending"`
	Error   string   `json:"error"`
}

const drainPollInterval = 2 * time.Second

// DrainNode cordons the node, then evicts every pod except DaemonSet-managed
// and static mirror pods through the policy/v1 Eviction API — so
// PodDisruptionBudgets are honored, with blocked evictions retried each poll
// round. It blocks until the node is empty or ctx is done; callers run it in
// a goroutine and consume onProgress.
func (m *ClientManager) DrainNode(ctx context.Context, contextName, nodeName string, onProgress func(NodeDrainProgress)) error {
	if err := m.assertWritable(contextName); err != nil {
		return err
	}

	key := contextName + "/" + nodeName
	m.drainMu.Lock()
	if m.draining[key] {
		m.drainMu.Unlock()
		return fmt.Errorf("a drain of node %q is already running", nodeName)
	}
	m.draining[key] = true
	m.drainMu.Unlock()
	defer func() {
		m.drainMu.Lock()
		delete(m.draining, key)
		m.drainMu.Unlock()
	}()

	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	report := func(p NodeDrainProgress) {
		if onProgress == nil {
			return
		}
		p.Node = nodeName
		if p.Pending == nil {
			p.Pending = []string{}
		}
		onProgress(p)
	}

	report(NodeDrainProgress{Phase: "cordoning"})
	if err := m.SetNodeCordon(ctx, contextName, nodeName, true); err != nil {
		return fmt.Errorf("cordon: %w", err)
	}

	list, err := cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + nodeName,
	})
	if err != nil {
		return err
	}
	targets := drainTargets(list.Items)
	total := len(targets)
	report(NodeDrainProgress{Phase: "evicting", Total: total, Pending: podKeys(targets)})

	for {
		pending := make([]corev1.Pod, 0, len(targets))
		for _, p := range targets {
			cur, err := cs.CoreV1().Pods(p.Namespace).Get(ctx, p.Name, metav1.GetOptions{})
			switch {
			case apierrors.IsNotFound(err):
			case err == nil && cur.UID != p.UID:
				// Same name, new pod: the controller recreated it elsewhere
				// (the cordon keeps it off this node) — the original is gone.
			case err != nil:
				pending = append(pending, p)
			default:
				pending = append(pending, *cur)
			}
		}
		if len(pending) == 0 {
			report(NodeDrainProgress{Phase: "done", Total: total, Evicted: total})
			return nil
		}

		evictErr := ""
		for _, p := range pending {
			if p.DeletionTimestamp != nil {
				continue
			}
			err := cs.PolicyV1().Evictions(p.Namespace).Evict(ctx, &policyv1.Eviction{
				ObjectMeta: metav1.ObjectMeta{Name: p.Name, Namespace: p.Namespace},
			})
			switch {
			case err == nil, apierrors.IsNotFound(err):
			case apierrors.IsTooManyRequests(err):
				evictErr = fmt.Sprintf("%s/%s: blocked by a PodDisruptionBudget, retrying", p.Namespace, p.Name)
			default:
				evictErr = fmt.Sprintf("%s/%s: %v", p.Namespace, p.Name, err)
			}
		}

		report(NodeDrainProgress{
			Phase:   "waiting",
			Total:   total,
			Evicted: total - len(pending),
			Pending: podKeys(pending),
			Error:   evictErr,
		})

		select {
		case <-ctx.Done():
			return fmt.Errorf("drain interrupted with %d pod(s) still on the node: %w", len(pending), ctx.Err())
		case <-time.After(drainPollInterval):
		}
	}
}

// drainTargets selects the pods a drain must evict: everything on the node
// except DaemonSet-managed pods (their controller recreates them in place and
// they tolerate the cordon anyway), static mirror pods (owned by the kubelet,
// not evictable) and pods that already finished.
func drainTargets(pods []corev1.Pod) []corev1.Pod {
	out := make([]corev1.Pod, 0, len(pods))
	for _, p := range pods {
		if p.Status.Phase == corev1.PodSucceeded || p.Status.Phase == corev1.PodFailed {
			continue
		}
		if _, mirror := p.Annotations[corev1.MirrorPodAnnotationKey]; mirror {
			continue
		}
		if ref := metav1.GetControllerOf(&p); ref != nil && ref.Kind == "DaemonSet" {
			continue
		}
		out = append(out, p)
	}
	return out
}

func podKeys(pods []corev1.Pod) []string {
	keys := make([]string, 0, len(pods))
	for _, p := range pods {
		keys = append(keys, p.Namespace+"/"+p.Name)
	}
	sort.Strings(keys)
	return keys
}
