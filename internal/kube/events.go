package kube

import (
	"container/heap"
	"context"
	"sort"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/client-go/kubernetes"
)

// eventMinHeap keeps the most-recent N events while paging a large warning set:
// the root is the oldest kept event, so a newer one evicts it. Less orders by
// LastSeen ascending (min at root).
type eventMinHeap []EventInfo

func (h eventMinHeap) Len() int           { return len(h) }
func (h eventMinHeap) Less(i, j int) bool { return h[i].LastSeen.Before(h[j].LastSeen) }
func (h eventMinHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *eventMinHeap) Push(x any)        { *h = append(*h, x.(EventInfo)) }
func (h *eventMinHeap) Pop() any {
	old := *h
	n := len(old)
	item := old[n-1]
	*h = old[:n-1]
	return item
}

// eventLastSeen mirrors the LastSeen fallback in eventInfoFrom without building
// the full struct, so the warning-event scan can compare recency before
// deciding whether an event makes the top-N cut.
func eventLastSeen(e *corev1.Event) time.Time {
	last := e.LastTimestamp.Time
	if last.IsZero() {
		last = e.EventTime.Time
	}
	if last.IsZero() {
		last = e.CreationTimestamp.Time
	}
	return last
}

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

// maxWarningEventsScan bounds how many warning events one overview refresh
// pulls from a pathologically noisy cluster before sorting.
const maxWarningEventsScan = 5000

// maxEventsRetain is how many most-recent events the namespace-wide Events view
// keeps while paging.
const maxEventsRetain = 200

func (m *ClientManager) ListClusterWarningEvents(ctx context.Context, contextName string, limit int) ([]EventInfo, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 50
	}

	// Page through the full warning set before sorting: a server-side Limit
	// truncates in etcd key order (alphabetical by namespace/name), which on a
	// busy cluster can drop every recent warning before the recency sort runs.
	opts := metav1.ListOptions{
		FieldSelector: fields.OneTermEqualSelector("type", "Warning").String(),
		Limit:         500,
	}
	// Keep only the most-recent `limit` events in a min-heap while paging, so a
	// noisy cluster costs O(scanned·log limit) and `limit` retained EventInfo
	// instead of allocating + full-sorting the entire warning set.
	h := &eventMinHeap{}
	scanned := 0
	for {
		list, err := cs.CoreV1().Events("").List(ctx, opts)
		if err != nil {
			return nil, err
		}
		for i := range list.Items {
			if h.Len() < limit {
				heap.Push(h, eventInfoFrom(&list.Items[i]))
			} else if eventLastSeen(&list.Items[i]).After((*h)[0].LastSeen) {
				heap.Pop(h)
				heap.Push(h, eventInfoFrom(&list.Items[i]))
			}
		}
		scanned += len(list.Items)
		if list.Continue == "" || scanned >= maxWarningEventsScan {
			break
		}
		opts.Continue = list.Continue
	}
	out := []EventInfo(*h)
	sort.Slice(out, func(i, j int) bool { return out[i].LastSeen.After(out[j].LastSeen) })
	return out, nil
}

func (m *ClientManager) ListEvents(ctx context.Context, contextName, namespace, kind, name string) ([]EventInfo, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return nil, err
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

	// Detail Events tab: field-selected to one object, which rarely has 200+
	// events, so a single truncated list is fine.
	if kind != "" && name != "" {
		opts := metav1.ListOptions{
			Limit: 200,
			FieldSelector: fields.AndSelectors(
				fields.OneTermEqualSelector("involvedObject.name", name),
				fields.OneTermEqualSelector("involvedObject.kind", kind),
			).String(),
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

	// Namespace-wide list view: page the full set and keep the most-recent N.
	return pageRecentEvents(ctx, cs, ns, nsFilter, maxEventsRetain)
}

// pageRecentEvents pages every event in ns and keeps the most-recent `retain`
// in a min-heap. A server-side Limit truncates in etcd key order (alphabetical
// by namespace/name), which would drop recent events before the recency sort
// and can starve later-alphabet namespaces to zero. nsFilter is applied before
// insertion so the cap counts only matching events.
func pageRecentEvents(ctx context.Context, cs kubernetes.Interface, ns string, nsFilter func(string) bool, retain int) ([]EventInfo, error) {
	opts := metav1.ListOptions{Limit: 500}
	h := &eventMinHeap{}
	scanned := 0
	for {
		list, err := cs.CoreV1().Events(ns).List(ctx, opts)
		if err != nil {
			return nil, err
		}
		for i := range list.Items {
			if nsFilter != nil && !nsFilter(list.Items[i].Namespace) {
				continue
			}
			if h.Len() < retain {
				heap.Push(h, eventInfoFrom(&list.Items[i]))
			} else if eventLastSeen(&list.Items[i]).After((*h)[0].LastSeen) {
				heap.Pop(h)
				heap.Push(h, eventInfoFrom(&list.Items[i]))
			}
		}
		scanned += len(list.Items)
		if list.Continue == "" || scanned >= maxWarningEventsScan {
			break
		}
		opts.Continue = list.Continue
	}
	out := []EventInfo(*h)
	sort.Slice(out, func(i, j int) bool { return out[i].LastSeen.After(out[j].LastSeen) })
	return out, nil
}

func eventInfoFrom(e *corev1.Event) EventInfo {
	first := e.FirstTimestamp.Time
	// last falls back EventTime → CreationTimestamp (some controllers set only
	// one); otherwise LastSeen would be the year-1 zero value, which renders as
	// an absurd age and poisons the recency sort.
	last := eventLastSeen(e)
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
