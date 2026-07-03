package kube

import (
	"context"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	clienttesting "k8s.io/client-go/testing"
)

// pageRecentEvents must keep the most-recent N events by LastSeen (not the
// alphabetical prefix a server-side Limit returns) and apply nsFilter before
// the cap, across paginated responses.
func TestPageRecentEventsRetainsNewestAcrossPages(t *testing.T) {
	base := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	evt := func(ns, name string, minute int) corev1.Event {
		return corev1.Event{
			ObjectMeta:    metav1.ObjectMeta{Namespace: ns, Name: name},
			Type:          "Normal",
			LastTimestamp: metav1.NewTime(base.Add(time.Duration(minute) * time.Minute)),
		}
	}
	// zzz is late in the alphabet: a server-side Limit would drop it first. Its
	// newest events must still win over aaa (which nsFilter excludes anyway).
	page1 := []corev1.Event{
		evt("aaa", "a1", 100), // filtered out by nsFilter
		evt("zzz", "z-old", 1),
		evt("zzz", "z-mid", 5),
	}
	page2 := []corev1.Event{
		evt("aaa", "a2", 200), // filtered out
		evt("zzz", "z-new1", 9),
		evt("zzz", "z-new2", 7),
	}

	cs := fake.NewSimpleClientset()
	calls := 0
	cs.PrependReactor("list", "events", func(clienttesting.Action) (bool, runtime.Object, error) {
		calls++
		if calls == 1 {
			return true, &corev1.EventList{ListMeta: metav1.ListMeta{Continue: "next"}, Items: page1}, nil
		}
		return true, &corev1.EventList{Items: page2}, nil
	})

	onlyZZZ := func(ns string) bool { return ns == "zzz" }
	got, err := pageRecentEvents(context.Background(), cs, "", onlyZZZ, 3)
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Errorf("expected 2 pages consumed via Continue, got %d list calls", calls)
	}
	// The 3 newest zzz events by minute, sorted descending: 9, 7, 5. aaa's
	// larger minutes (100, 200) must be excluded by nsFilter, not retained.
	wantMinutes := []int{9, 7, 5}
	if len(got) != len(wantMinutes) {
		t.Fatalf("got %d events, want %d: %+v", len(got), len(wantMinutes), got)
	}
	for i, m := range wantMinutes {
		want := base.Add(time.Duration(m) * time.Minute)
		if !got[i].LastSeen.Equal(want) {
			t.Errorf("position %d: got LastSeen %v, want %v (full: %+v)", i, got[i].LastSeen, want, got)
		}
	}
}

func TestEventInfoFromUsesLastTimestamp(t *testing.T) {
	first := metav1.NewTime(time.Date(2026, 5, 1, 10, 0, 0, 0, time.UTC))
	last := metav1.NewTime(time.Date(2026, 5, 22, 12, 30, 0, 0, time.UTC))
	e := &corev1.Event{
		ObjectMeta:     metav1.ObjectMeta{Namespace: "ns", Name: "evt"},
		Type:           "Warning",
		Reason:         "FailedScheduling",
		Message:        "no nodes",
		Count:          5,
		FirstTimestamp: first,
		LastTimestamp:  last,
		Source:         corev1.EventSource{Component: "scheduler", Host: "node-1"},
		InvolvedObject: corev1.ObjectReference{Kind: "Pod", Name: "demo"},
	}
	got := eventInfoFrom(e)
	if !got.LastSeen.Equal(last.Time) {
		t.Errorf("LastSeen: got %v, want %v", got.LastSeen, last.Time)
	}
	if !got.FirstSeen.Equal(first.Time) {
		t.Errorf("FirstSeen: got %v, want %v", got.FirstSeen, first.Time)
	}
	if got.Source != "scheduler, node-1" {
		t.Errorf("Source: got %q", got.Source)
	}
	if got.Count != 5 {
		t.Errorf("Count: got %d", got.Count)
	}
	if got.ObjectKind != "Pod" || got.ObjectName != "demo" {
		t.Errorf("involved object: %+v", got)
	}
}

func TestEventInfoFromFallsBackToEventTime(t *testing.T) {
	when := time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
	e := &corev1.Event{
		EventTime:           metav1.NewMicroTime(when),
		ReportingController: "kubelet",
	}
	got := eventInfoFrom(e)
	if !got.LastSeen.Equal(when) {
		t.Errorf("LastSeen should fall back to EventTime, got %v", got.LastSeen)
	}
	if !got.FirstSeen.Equal(when) {
		t.Errorf("FirstSeen should fall back to LastSeen when missing, got %v", got.FirstSeen)
	}
	if got.Source != "kubelet" {
		t.Errorf("Source should fall back to ReportingController, got %q", got.Source)
	}
}

func TestEventInfoFromCountDefault(t *testing.T) {
	e := &corev1.Event{Count: 0, LastTimestamp: metav1.Now()}
	if got := eventInfoFrom(e); got.Count != 1 {
		t.Errorf("zero Count should default to 1, got %d", got.Count)
	}
}

func TestEventInfoFromSourceComponentOnly(t *testing.T) {
	e := &corev1.Event{
		LastTimestamp: metav1.Now(),
		Source:        corev1.EventSource{Component: "scheduler"},
	}
	if got := eventInfoFrom(e); got.Source != "scheduler" {
		t.Errorf("got %q, want scheduler", got.Source)
	}
}
