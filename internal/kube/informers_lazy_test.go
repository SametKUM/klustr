package kube

import (
	"sync"
	"testing"
	"time"

	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
)

func newLazyTestWatcher(t *testing.T) (*contextWatcher, *fake.Clientset, func(string) bool) {
	t.Helper()
	cs := fake.NewClientset()
	stopCh := make(chan struct{})
	t.Cleanup(func() { close(stopCh) })

	var mu sync.Mutex
	touched := make(map[string]bool)
	w := &contextWatcher{
		cs:      cs,
		factory: informers.NewSharedInformerFactory(cs, 0),
		stopCh:  stopCh,
		started: make(map[string]bool),
		pending: make(map[string]struct{}),
		onChange: func(kind string) {
			mu.Lock()
			touched[kind] = true
			mu.Unlock()
		},
	}
	w.bindings = kindBindings(w)
	wasTouched := func(kind string) bool {
		mu.Lock()
		defer mu.Unlock()
		return touched[kind]
	}
	return w, cs, wasTouched
}

func listedResources(cs *fake.Clientset) map[string]bool {
	out := make(map[string]bool)
	for _, a := range cs.Actions() {
		if a.GetVerb() == "list" {
			out[a.GetResource().Resource] = true
		}
	}
	return out
}

func waitTouched(t *testing.T, wasTouched func(string) bool, kind string) {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for !wasTouched(kind) {
		select {
		case <-deadline:
			t.Fatalf("%s was never touched", kind)
		case <-time.After(20 * time.Millisecond):
		}
	}
}

func TestEnsureKindStartsInformersLazily(t *testing.T) {
	w, cs, wasTouched := newLazyTestWatcher(t)

	if listed := listedResources(cs); len(listed) != 0 {
		t.Fatalf("no informer should run before first use, got lists for %v", listed)
	}

	w.Secrets("")
	waitTouched(t, wasTouched, "Secret")

	listed := listedResources(cs)
	if !listed["secrets"] {
		t.Fatal("using the Secret lister should have started its informer")
	}
	if listed["pods"] || listed["configmaps"] {
		t.Fatalf("unused kinds must stay cold, got lists for %v", listed)
	}
	if wasTouched("Pod") {
		t.Fatal("Pod must not be touched before anything uses it")
	}
}

func TestEnsureKindIsIdempotent(t *testing.T) {
	w, cs, wasTouched := newLazyTestWatcher(t)

	w.ensureKind("ConfigMap")
	w.ensureKind("ConfigMap")
	w.ConfigMaps("")
	waitTouched(t, wasTouched, "ConfigMap")

	count := 0
	for _, a := range cs.Actions() {
		if a.GetVerb() == "list" && a.GetResource().Resource == "configmaps" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("expected exactly one initial list for configmaps, got %d", count)
	}
}

func TestEnsureKindTouchesDeniedKindsImmediately(t *testing.T) {
	w, _, wasTouched := newLazyTestWatcher(t)
	w.access = &contextAccess{kinds: map[string]KindAccess{
		"Secret": {Mode: AccessDenied},
	}}

	if got := w.Secrets(""); len(got) != 0 {
		t.Fatalf("denied kind must list empty, got %d items", len(got))
	}
	// The touch is debounced (~100ms), but no informer sync is needed.
	waitTouched(t, wasTouched, "Secret")
}
