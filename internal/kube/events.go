package kube

import (
	"context"
	"sort"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
)

type EventInfo struct {
	Namespace  string    `json:"namespace"`
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	Reason     string    `json:"reason"`
	Message    string    `json:"message"`
	Count      int32     `json:"count"`
	Source     string    `json:"source"`
	FirstSeen  time.Time `json:"firstSeen"`
	LastSeen   time.Time `json:"lastSeen"`
	ObjectKind string    `json:"objectKind"`
	ObjectName string    `json:"objectName"`
}

func (m *ClientManager) ListClusterWarningEvents(ctx context.Context, contextName string, limit int) ([]EventInfo, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 50
	}

	opts := metav1.ListOptions{
		FieldSelector: fields.OneTermEqualSelector("type", "Warning").String(),
		Limit:         int64(limit),
	}
	list, err := cs.CoreV1().Events("").List(ctx, opts)
	if err != nil {
		return nil, err
	}

	out := make([]EventInfo, 0, len(list.Items))
	for i := range list.Items {
		out = append(out, eventInfoFrom(&list.Items[i]))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].LastSeen.After(out[j].LastSeen) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (m *ClientManager) ListEvents(ctx context.Context, contextName, namespace, kind, name string) ([]EventInfo, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return nil, err
	}

	opts := metav1.ListOptions{Limit: 200}
	if kind != "" && name != "" {
		selector := fields.AndSelectors(
			fields.OneTermEqualSelector("involvedObject.name", name),
			fields.OneTermEqualSelector("involvedObject.kind", kind),
		)
		opts.FieldSelector = selector.String()
	}

	// A multi-namespace selection lists cluster-wide in one call and filters
	// locally — Events have no informer here and N namespaced calls would
	// multiply apiserver round trips.
	ns := namespace
	nsFilter := namespaceFilter(namespace)
	if nsFilter != nil {
		ns = ""
	}
	if kind == "Node" || kind == "Namespace" {
		ns = ""
		nsFilter = nil
	}

	list, err := cs.CoreV1().Events(ns).List(ctx, opts)
	if err != nil {
		return nil, err
	}

	out := make([]EventInfo, 0, len(list.Items))
	for i := range list.Items {
		if nsFilter != nil && !nsFilter(list.Items[i].Namespace) {
			continue
		}
		out = append(out, eventInfoFrom(&list.Items[i]))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].LastSeen.After(out[j].LastSeen) })
	return out, nil
}

func eventInfoFrom(e *corev1.Event) EventInfo {
	first := e.FirstTimestamp.Time
	last := e.LastTimestamp.Time
	if last.IsZero() {
		last = e.EventTime.Time
	}
	if first.IsZero() {
		first = last
	}
	src := e.Source.Component
	if src != "" && e.Source.Host != "" {
		src = src + ", " + e.Source.Host
	} else if src == "" {
		src = e.ReportingController
	}
	count := e.Count
	if count == 0 {
		count = 1
	}
	return EventInfo{
		Namespace:  e.Namespace,
		Name:       e.Name,
		Type:       e.Type,
		Reason:     e.Reason,
		Message:    e.Message,
		Count:      count,
		Source:     src,
		FirstSeen:  first,
		LastSeen:   last,
		ObjectKind: e.InvolvedObject.Kind,
		ObjectName: e.InvolvedObject.Name,
	}
}
