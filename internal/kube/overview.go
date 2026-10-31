package kube

import (
	"context"
	"errors"
	"strconv"
	"strings"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"
)

var errNoWatcher = errors.New("no active watcher for context")

type ClusterResource struct {
	Usage       int64 `json:"usage"`
	Requests    int64 `json:"requests"`
	Limits      int64 `json:"limits"`
	Allocatable int64 `json:"allocatable"`
	Capacity    int64 `json:"capacity"`
}

type ClusterPods struct {
	Usage       int `json:"usage"`
	Allocatable int `json:"allocatable"`
	Capacity    int `json:"capacity"`
}

type ClusterOverview struct {
	CPU              ClusterResource `json:"cpu"`
	Memory           ClusterResource `json:"memory"`
	Pods             ClusterPods     `json:"pods"`
	NodeCount        int             `json:"nodeCount"`
	PodCount         int             `json:"podCount"`
	NamespaceCount   int             `json:"namespaceCount"`
	MetricsAvailable bool            `json:"metricsAvailable"`
	MetricsError     string          `json:"metricsError,omitempty"`
}

// WorkloadHealth is one Workloads Overview card: how many objects of a kind are
// expected to run, how many are healthy, and how many are deliberately inactive
// (suspended CronJobs), which the card shows apart from the unhealthy ones.
type WorkloadHealth struct {
	Kind    string `json:"kind"`
	Total   int    `json:"total"`
	Healthy int    `json:"healthy"`
	Neutral int    `json:"neutral"`
}

type workloadLists struct {
	pods                   []PodInfo
	deployments            []DeploymentInfo
	statefulSets           []StatefulSetInfo
	daemonSets             []DaemonSetInfo
	replicaSets            []ReplicaSetInfo
	replicationControllers []ReplicationControllerInfo
	jobs                   []JobInfo
	cronJobs               []CronJobInfo
}

// WorkloadsOverview counts workload health from the informer caches. The view
// refreshes on every workload change, and shipping eight full lists across the
// bridge for a few numbers per kind grows with the cluster.
func (m *ClientManager) WorkloadsOverview(contextName, namespace string) []WorkloadHealth {
	return summarizeWorkloads(workloadLists{
		pods:                   m.Pods(contextName, namespace),
		deployments:            m.Deployments(contextName, namespace),
		statefulSets:           m.StatefulSets(contextName, namespace),
		daemonSets:             m.DaemonSets(contextName, namespace),
		replicaSets:            m.ReplicaSets(contextName, namespace),
		replicationControllers: m.ReplicationControllers(contextName, namespace),
		jobs:                   m.Jobs(contextName, namespace),
		cronJobs:               m.CronJobs(contextName, namespace),
	})
}

type workloadState int

const (
	workloadUnhealthy workloadState = iota
	workloadHealthy
	workloadNeutral
	// workloadSkipped is scaled to zero: idle on purpose and kept out of the
	// total, so it never shows as unhealthy.
	workloadSkipped
)

func summarizeWorkloads(l workloadLists) []WorkloadHealth {
	return []WorkloadHealth{
		tallyWorkloads("Pod", l.pods, func(p PodInfo) workloadState {
			// A finished pod reads as "Completed" (terminated-container reason)
			// far more often than the bare "Succeeded" phase; both mean it did
			// its job.
			if p.Status == "Succeeded" || p.Status == "Completed" {
				return workloadHealthy
			}
			if ready, total, ok := readyCounts(p.Ready); ok && p.Status == "Running" && total > 0 && ready == total {
				return workloadHealthy
			}
			return workloadUnhealthy
		}),
		tallyWorkloads("Deployment", l.deployments, func(d DeploymentInfo) workloadState { return readyColumnState(d.Ready) }),
		tallyWorkloads("StatefulSet", l.statefulSets, func(s StatefulSetInfo) workloadState { return readyColumnState(s.Ready) }),
		tallyWorkloads("DaemonSet", l.daemonSets, func(d DaemonSetInfo) workloadState { return replicaState(d.Desired, d.Ready) }),
		// Scaled-down ReplicaSets are kept around for rollback, not broken.
		tallyWorkloads("ReplicaSet", l.replicaSets, func(r ReplicaSetInfo) workloadState { return replicaState(r.Desired, r.Ready) }),
		tallyWorkloads("ReplicationController", l.replicationControllers, func(r ReplicationControllerInfo) workloadState {
			return replicaState(r.Desired, r.Ready)
		}),
		tallyWorkloads("Job", l.jobs, func(j JobInfo) workloadState {
			if j.Status == "Failed" {
				return workloadUnhealthy
			}
			return workloadHealthy
		}),
		tallyWorkloads("CronJob", l.cronJobs, func(c CronJobInfo) workloadState {
			if c.Suspend {
				return workloadNeutral
			}
			return workloadHealthy
		}),
	}
}

func tallyWorkloads[T any](kind string, items []T, classify func(T) workloadState) WorkloadHealth {
	h := WorkloadHealth{Kind: kind}
	for _, item := range items {
		switch classify(item) {
		case workloadSkipped:
			continue
		case workloadHealthy:
			h.Healthy++
		case workloadNeutral:
			h.Neutral++
		}
		h.Total++
	}
	return h
}

// readyColumnState classifies a "ready/desired" column, as Deployments and
// StatefulSets report it.
func readyColumnState(column string) workloadState {
	ready, total, ok := readyCounts(column)
	switch {
	case !ok:
		return workloadUnhealthy
	case total == 0:
		return workloadSkipped
	case ready == total:
		return workloadHealthy
	}
	return workloadUnhealthy
}

func replicaState(desired, ready int32) workloadState {
	switch {
	case desired == 0:
		return workloadSkipped
	case ready == desired:
		return workloadHealthy
	}
	return workloadUnhealthy
}

func readyCounts(column string) (ready, total int, ok bool) {
	r, t, found := strings.Cut(column, "/")
	if !found {
		return 0, 0, false
	}
	ready, err := strconv.Atoi(r)
	if err != nil {
		return 0, 0, false
	}
	total, err = strconv.Atoi(t)
	if err != nil {
		return 0, 0, false
	}
	return ready, total, true
}

func (m *ClientManager) GetClusterOverview(ctx context.Context, contextName string) (*ClusterOverview, error) {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return nil, errNoWatcher
	}

	overview := &ClusterOverview{
		CPU:    ClusterResource{Usage: -1},
		Memory: ClusterResource{Usage: -1},
	}

	var nodes []*corev1.Node
	if f := w.factoryFor("Node"); f != nil {
		nodes, _ = f.Core().V1().Nodes().Lister().List(labels.Everything())
	}
	for _, n := range nodes {
		if q, ok := n.Status.Capacity[corev1.ResourceCPU]; ok {
			overview.CPU.Capacity += q.MilliValue()
		}
		if q, ok := n.Status.Allocatable[corev1.ResourceCPU]; ok {
			overview.CPU.Allocatable += q.MilliValue()
		}
		if q, ok := n.Status.Capacity[corev1.ResourceMemory]; ok {
			overview.Memory.Capacity += q.Value()
		}
		if q, ok := n.Status.Allocatable[corev1.ResourceMemory]; ok {
			overview.Memory.Allocatable += q.Value()
		}
		if q, ok := n.Status.Capacity[corev1.ResourcePods]; ok {
			overview.Pods.Capacity += int(q.Value())
		}
		if q, ok := n.Status.Allocatable[corev1.ResourcePods]; ok {
			overview.Pods.Allocatable += int(q.Value())
		}
		overview.NodeCount++
	}

	var pods []*corev1.Pod
	if f := w.factoryFor("Pod"); f != nil {
		pods, _ = f.Core().V1().Pods().Lister().List(labels.Everything())
	}
	overview.PodCount = len(pods)
	for _, p := range pods {
		if p.Status.Phase == corev1.PodSucceeded || p.Status.Phase == corev1.PodFailed {
			continue
		}
		cpuReq, cpuLim, memReq, memLim := podResourceTotals(p)
		overview.CPU.Requests += cpuReq
		overview.CPU.Limits += cpuLim
		overview.Memory.Requests += memReq
		overview.Memory.Limits += memLim
		overview.Pods.Usage++
	}

	if f := w.factoryFor("Namespace"); f != nil {
		namespaces, _ := f.Core().V1().Namespaces().Lister().List(labels.Everything())
		overview.NamespaceCount = len(namespaces)
	}

	// Skip the (doomed, timeout-prone) cluster-wide metrics List during the
	// cooldown after a recent unavailable response, re-probing at most once a
	// minute instead of on every ~15s poll.
	if m.metrics.metricsUnavailable(contextName) {
		overview.MetricsError = "metrics.k8s.io API is not available"
		return overview, nil
	}
	mc, err := m.metricsClient(contextName)
	if err != nil {
		overview.MetricsError = err.Error()
		return overview, nil
	}
	list, err := m.clusterPodMetrics(ctx, mc, contextName)
	if err != nil {
		if apierrors.IsNotFound(err) || apierrors.IsServiceUnavailable(err) {
			m.metrics.setMetricsUnavailable(contextName)
			overview.MetricsError = "metrics.k8s.io API is not available"
		} else {
			overview.MetricsError = err.Error()
		}
		return overview, nil
	}
	m.metrics.clearMetricsUnavailable(contextName)

	var cpuUsage, memUsage int64
	for i := range list.Items {
		pm := &list.Items[i]
		for _, c := range pm.Containers {
			if q, ok := c.Usage["cpu"]; ok {
				cpuUsage += q.MilliValue()
			}
			if q, ok := c.Usage["memory"]; ok {
				memUsage += q.Value()
			}
		}
	}
	overview.CPU.Usage = cpuUsage
	overview.Memory.Usage = memUsage
	overview.MetricsAvailable = true
	return overview, nil
}
