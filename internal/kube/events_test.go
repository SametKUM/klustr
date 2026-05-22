package kube

import (
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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
