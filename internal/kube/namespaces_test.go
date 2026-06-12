package kube

import (
	"reflect"
	"testing"
)

func TestSplitNamespaces(t *testing.T) {
	if got := splitNamespaces(""); got != nil {
		t.Fatalf("all-namespaces query should return nil, got %v", got)
	}
	if got := splitNamespaces("default"); got != nil {
		t.Fatalf("single namespace should return nil, got %v", got)
	}
	got := splitNamespaces("kube-system,default,argocd")
	want := []string{"argocd", "default", "kube-system"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestListAcrossNamespaces(t *testing.T) {
	byNS := map[string][]string{
		"":     {"everything"},
		"a":    {"a1", "a2"},
		"b":    {"b1"},
		"zero": {},
	}
	list := func(ns string) []string { return byNS[ns] }

	if got := listAcrossNamespaces("", list); !reflect.DeepEqual(got, []string{"everything"}) {
		t.Fatalf("all-namespaces passthrough broken: %v", got)
	}
	if got := listAcrossNamespaces("a", list); !reflect.DeepEqual(got, []string{"a1", "a2"}) {
		t.Fatalf("single-namespace passthrough broken: %v", got)
	}
	got := listAcrossNamespaces("b,a", list)
	want := []string{"a1", "a2", "b1"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("multi-namespace list got %v, want %v", got, want)
	}
	if got := listAcrossNamespaces("zero,unknown", list); len(got) != 0 || got == nil {
		t.Fatalf("empty result must be a non-nil empty slice, got %#v", got)
	}
}

func TestNamespaceFilter(t *testing.T) {
	if namespaceFilter("") != nil {
		t.Fatal("all-namespaces query should not filter")
	}
	if namespaceFilter("default") != nil {
		t.Fatal("single namespace should not filter")
	}
	f := namespaceFilter("a,b")
	if !f("a") || !f("b") || f("c") {
		t.Fatal("filter does not match the namespace set")
	}
}
