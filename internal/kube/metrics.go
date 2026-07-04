package kube

import (
	"context"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

// podMetricsTTL caches the cluster-wide pod-metrics list briefly so the Overview
// and the pod table (both ~15s polls) don't each hit metrics.k8s.io. Metrics are
// approximate and already 15s-polled, so this much staleness is noise.
// ponytail: only pays off when both views poll within the window; cheap + safe regardless.
const podMetricsTTL = 10 * time.Second

// metricsUnavailableCooldown is how long the overview skips its cluster-wide
// pod-metrics List after metrics.k8s.io answered NotFound/ServiceUnavailable,
// so a metrics-server-less cluster isn't probed (and timed out) every poll.
const metricsUnavailableCooldown = time.Minute

type PodMetrics struct {
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	CPUMC     int64  `json:"cpuMC"`
	MemB      int64  `json:"memB"`
}

type NodeMetrics struct {
	Name  string `json:"name"`
	CPUMC int64  `json:"cpuMC"`
	MemB  int64  `json:"memB"`
}

type cachedPodList struct {
	at   time.Time
	list *metricsv1beta1.PodMetricsList
}

type metricsCache struct {
	mu               sync.Mutex
	client           map[string]metricsclient.Interface
	unavailableUntil map[string]time.Time
	podList          map[string]cachedPodList
}

func newMetricsCache() *metricsCache {
	return &metricsCache{
		client:           make(map[string]metricsclient.Interface),
		unavailableUntil: make(map[string]time.Time),
		podList:          make(map[string]cachedPodList),
	}
}

// metricsUnavailable reports whether this context is within the cooldown after
// a recent metrics-API-unavailable response.
func (mc *metricsCache) metricsUnavailable(contextName string) bool {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	until, ok := mc.unavailableUntil[contextName]
	return ok && time.Now().Before(until)
}

func (mc *metricsCache) setMetricsUnavailable(contextName string) {
	mc.mu.Lock()
	mc.unavailableUntil[contextName] = time.Now().Add(metricsUnavailableCooldown)
	mc.mu.Unlock()
}

func (mc *metricsCache) clearMetricsUnavailable(contextName string) {
	mc.mu.Lock()
	delete(mc.unavailableUntil, contextName)
	mc.mu.Unlock()
}

func (m *ClientManager) ListPodMetrics(ctx context.Context, contextName, namespace string) ([]PodMetrics, error) {
	c, err := m.metricsClient(contextName)
	if err != nil {
		return nil, err
	}

	// A multi-namespace selection lists cluster-wide in one call and filters
	// locally — metrics.k8s.io has no watch/cache and N namespaced calls would
	// multiply apiserver round trips on every poll.
	ns := namespace
	nsFilter := namespaceFilter(namespace)
	if nsFilter != nil {
		ns = ""
	}
	var list *metricsv1beta1.PodMetricsList
	if ns == "" {
		list, err = m.clusterPodMetrics(ctx, c, contextName)
	} else {
		list, err = c.MetricsV1beta1().PodMetricses(ns).List(ctx, metav1.ListOptions{})
	}
	if err != nil {
		if apierrors.IsNotFound(err) || apierrors.IsServiceUnavailable(err) {
			// Deliberate nil (JSON null): "metrics API unavailable", distinct
			// from an empty non-nil slice meaning "API answered, no rows for
			// this selection". The only consumer is usePodMetricsPoll, which
			// branches on null — without this, a namespace selection that
			// currently runs no pods would read as metrics-server missing.
			return nil, nil
		}
		return nil, err
	}

	out := make([]PodMetrics, 0, len(list.Items))
	for i := range list.Items {
		pm := &list.Items[i]
		if nsFilter != nil && !nsFilter(pm.Namespace) {
			continue
		}
		var cpu, mem int64
		for _, c := range pm.Containers {
			if q, ok := c.Usage["cpu"]; ok {
				cpu += q.MilliValue()
			}
			if q, ok := c.Usage["memory"]; ok {
				mem += q.Value()
			}
		}
		out = append(out, PodMetrics{
			Namespace: pm.Namespace,
			Name:      pm.Name,
			CPUMC:     cpu,
			MemB:      mem,
		})
	}
	return out, nil
}

func (m *ClientManager) ListNodeMetrics(ctx context.Context, contextName string) ([]NodeMetrics, error) {
	c, err := m.metricsClient(contextName)
	if err != nil {
		return nil, err
	}

	list, err := c.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) || apierrors.IsServiceUnavailable(err) {
			// Deliberate nil (JSON null): "metrics API unavailable", same
			// protocol as ListPodMetrics — useNodeMetricsPoll branches on null
			// to flip the availability flag instead of painting every node 0%.
			return nil, nil
		}
		return nil, err
	}

	out := make([]NodeMetrics, 0, len(list.Items))
	for i := range list.Items {
		nm := &list.Items[i]
		var cpu, mem int64
		if q, ok := nm.Usage["cpu"]; ok {
			cpu = q.MilliValue()
		}
		if q, ok := nm.Usage["memory"]; ok {
			mem = q.Value()
		}
		out = append(out, NodeMetrics{Name: nm.Name, CPUMC: cpu, MemB: mem})
	}
	return out, nil
}

func (mc *metricsCache) invalidate(contextName string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	delete(mc.client, contextName)
	delete(mc.unavailableUntil, contextName)
	delete(mc.podList, contextName)
}

// clusterPodMetrics returns the cluster-wide pod-metrics list, served from a
// short TTL cache so overlapping Overview / pod-table polls share one List.
func (m *ClientManager) clusterPodMetrics(ctx context.Context, c metricsclient.Interface, contextName string) (*metricsv1beta1.PodMetricsList, error) {
	m.metrics.mu.Lock()
	if e, ok := m.metrics.podList[contextName]; ok && time.Since(e.at) < podMetricsTTL {
		m.metrics.mu.Unlock()
		return e.list, nil
	}
	m.metrics.mu.Unlock()

	list, err := c.MetricsV1beta1().PodMetricses("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	m.metrics.mu.Lock()
	m.metrics.podList[contextName] = cachedPodList{at: time.Now(), list: list}
	m.metrics.mu.Unlock()
	return list, nil
}

func (m *ClientManager) metricsClient(contextName string) (metricsclient.Interface, error) {
	// Hold the lock across the build: two overlapping polls would otherwise both
	// miss and each construct a client (new transport/conn pool), the second
	// clobbering the first. restConfig+NewForConfig is cheap and rarely runs.
	m.metrics.mu.Lock()
	defer m.metrics.mu.Unlock()
	if c, ok := m.metrics.client[contextName]; ok {
		return c, nil
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return nil, err
	}
	c, err := metricsclient.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}
	m.metrics.client[contextName] = c
	return c, nil
}
