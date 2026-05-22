package kube

import (
	"context"
	"errors"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	NamespaceCount   int             `json:"namespaceCount"`
	MetricsAvailable bool            `json:"metricsAvailable"`
	MetricsError     string          `json:"metricsError,omitempty"`
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

	mc, err := m.metricsClient(contextName)
	if err != nil {
		overview.MetricsError = err.Error()
		return overview, nil
	}
	list, err := mc.MetricsV1beta1().PodMetricses("").List(ctx, metav1.ListOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) || apierrors.IsServiceUnavailable(err) {
			overview.MetricsError = "metrics.k8s.io API is not available"
		} else {
			overview.MetricsError = err.Error()
		}
		return overview, nil
	}

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
