package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
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
func (m *ClientManager) DrainNode(ctx context.Context, contextName, nodeName string, force bool, onProgress func(NodeDrainProgress)) error {
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

	list, err := cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + nodeName,
	})
	if err != nil {
		return err
	}
	targets := drainTargets(list.Items)

	// kubectl drain refuses to delete pods not managed by a controller without
	// --force, since they cannot be rescheduled and are gone for good. Check
	// before cordoning so a refused drain leaves the node untouched.
	if !force {
		if bare := barePods(targets); len(bare) > 0 {
			return fmt.Errorf(
				"%d pod(s) on this node are not managed by a controller and would be permanently deleted (enable force to override): %s",
				len(bare), strings.Join(podKeys(bare), ", "),
			)
		}
	}
	total := len(targets)

	report(NodeDrainProgress{Phase: "cordoning"})
	if err := m.SetNodeCordon(ctx, contextName, nodeName, true); err != nil {
		return fmt.Errorf("cordon: %w", err)
	}

	report(NodeDrainProgress{Phase: "evicting", Total: total, Pending: podKeys(targets)})

	for {
		// One node-scoped List per round instead of a Get per remaining target.
		// A target still present (by UID) is pending; absent means it's gone —
		// evicted, or recreated elsewhere with a new UID (the cordon keeps it off
		// this node, so it won't appear here at all).
		cur, err := cs.CoreV1().Pods("").List(ctx, metav1.ListOptions{
			FieldSelector: "spec.nodeName=" + nodeName,
		})
		if err != nil {
			report(NodeDrainProgress{Phase: "waiting", Total: total, Pending: podKeys(targets), Error: err.Error()})
			select {
			case <-ctx.Done():
				return fmt.Errorf("drain interrupted with %d pod(s) still on the node: %w", len(targets), ctx.Err())
			case <-time.After(drainPollInterval):
			}
			continue
		}
		byUID := make(map[string]corev1.Pod, len(cur.Items))
		for i := range cur.Items {
			byUID[string(cur.Items[i].UID)] = cur.Items[i]
		}
		pending := make([]corev1.Pod, 0, len(targets))
		for _, p := range targets {
			if live, ok := byUID[string(p.UID)]; ok {
				pending = append(pending, live)
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

// barePods returns the drain targets that no controller owns. Evicting one
// deletes it permanently — nothing will recreate it — so a drain only touches
// them when the user explicitly forces it.
func barePods(pods []corev1.Pod) []corev1.Pod {
	out := make([]corev1.Pod, 0)
	for _, p := range pods {
		if metav1.GetControllerOf(&p) == nil {
			out = append(out, p)
		}
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
