package kube

import (
	"sync"
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/tools/cache"
)

// syncStub is a SharedIndexInformer whose HasSynced is controllable; every
// other method panics (unused by handleInformerEvent).
type syncStub struct {
	cache.SharedIndexInformer
	synced bool
}

func (s syncStub) HasSynced() bool { return s.synced }

// handleInformerEvent must drop the initial-LIST replay (Adds delivered before
// HasSynced) and record real events once the cache has synced.
func TestHandleInformerEventGatedOnSync(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	pod := podWithIP("ns", "p1", "1.2.3.4")

	w.handleInformerEvent(syncStub{synced: false}, "Pod", podBinding, DeltaUpsert, pod)
	drain(w)
	if got := captured(); len(got) != 0 {
		t.Fatalf("no delta should be emitted before the informer syncs, got %+v", got)
	}

	w.handleInformerEvent(syncStub{synced: true}, "Pod", podBinding, DeltaUpsert, pod)
	drain(w)
	got := captured()
	if len(got) != 1 || got[0].delta == nil || len(got[0].delta.Upserts) != 1 {
		t.Fatalf("expected one upsert delta after sync, got %+v", got)
	}
}

type capturedDelta struct {
	kind  string
	delta *KindDelta
}

func newDeltaTestWatcher() (*contextWatcher, func() []capturedDelta) {
	var mu sync.Mutex
	var got []capturedDelta
	w := &contextWatcher{
		pending: make(map[string]*pendingKind),
		gen:     make(map[string]uint64),
		onChange: func(kind string, d *KindDelta) {
			mu.Lock()
			got = append(got, capturedDelta{kind, d})
			mu.Unlock()
		},
	}
	return w, func() []capturedDelta {
		mu.Lock()
		defer mu.Unlock()
		out := make([]capturedDelta, len(got))
		copy(out, got)
		return out
	}
}

// drain stops the debounce timer (so its deferred fire can't double-flush mid
// test) and flushes synchronously.
func drain(w *contextWatcher) {
	w.mu.Lock()
	if w.timer != nil {
		w.timer.Stop()
		w.timer = nil
	}
	w.mu.Unlock()
	w.flush()
}

func podWithIP(ns, name, ip string) *corev1.Pod {
	p := makePod(0)
	p.Namespace = ns
	p.Name = name
	p.Status.PodIP = ip
	return p
}

var podBinding = kindBinding{project: projectPod}

func soleDelta(t *testing.T, got []capturedDelta) *KindDelta {
	t.Helper()
	if len(got) != 1 {
		t.Fatalf("expected exactly one emitted delta, got %d", len(got))
	}
	return got[0].delta
}

func TestDeltaAddThenDeleteNetsRemove(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	p := podWithIP("ns", "a", "1.1.1.1")
	w.record("Pod", podBinding, DeltaUpsert, p)
	w.record("Pod", podBinding, DeltaRemove, p)
	drain(w)

	d := soleDelta(t, captured())
	if len(d.Upserts) != 0 {
		t.Fatalf("expected no upserts, got %d", len(d.Upserts))
	}
	if len(d.Removed) != 1 || d.Removed[0] != "ns/a" {
		t.Fatalf("expected removal of ns/a, got %v", d.Removed)
	}
}

// A remove keeps only the key, so record() must derive it without running the
// (expensive) projector — the whole point of the delete-hot-path optimization.
func TestDeltaRemoveSkipsProjection(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	projected := false
	spy := kindBinding{project: func(obj any) (string, any, bool) {
		projected = true
		return projectPod(obj)
	}}
	w.record("Pod", spy, DeltaRemove, podWithIP("ns", "a", "1.1.1.1"))
	drain(w)

	if projected {
		t.Fatal("record() ran the projector on a remove; it should derive the key cheaply")
	}
	d := soleDelta(t, captured())
	if len(d.Removed) != 1 || d.Removed[0] != "ns/a" {
		t.Fatalf("expected removal of ns/a, got %v", d.Removed)
	}
}

func TestDeltaAddThenUpdateNetsLatestUpsert(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	w.record("Pod", podBinding, DeltaUpsert, podWithIP("ns", "a", "1.1.1.1"))
	w.record("Pod", podBinding, DeltaUpsert, podWithIP("ns", "a", "2.2.2.2"))
	drain(w)

	d := soleDelta(t, captured())
	if len(d.Removed) != 0 {
		t.Fatalf("expected no removals, got %v", d.Removed)
	}
	if len(d.Upserts) != 1 {
		t.Fatalf("expected one upsert, got %d", len(d.Upserts))
	}
	info, ok := d.Upserts[0].(PodInfo)
	if !ok {
		t.Fatalf("upsert should be a PodInfo, got %T", d.Upserts[0])
	}
	if info.PodIP != "2.2.2.2" {
		t.Fatalf("expected the latest projection (2.2.2.2), got %s", info.PodIP)
	}
}

func TestDeltaUpdateThenDeleteNetsRemove(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	p := podWithIP("ns", "a", "1.1.1.1")
	w.record("Pod", podBinding, DeltaUpsert, p)
	w.record("Pod", podBinding, DeltaRemove, p)
	drain(w)
	d := soleDelta(t, captured())
	if len(d.Upserts) != 0 || len(d.Removed) != 1 {
		t.Fatalf("expected net remove, got upserts=%d removed=%v", len(d.Upserts), d.Removed)
	}
}

func TestDeltaDeleteThenAddNetsUpsert(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	p := podWithIP("ns", "a", "9.9.9.9")
	w.record("Pod", podBinding, DeltaRemove, p)
	w.record("Pod", podBinding, DeltaUpsert, p)
	drain(w)
	d := soleDelta(t, captured())
	if len(d.Removed) != 0 || len(d.Upserts) != 1 {
		t.Fatalf("expected net upsert, got upserts=%d removed=%v", len(d.Upserts), d.Removed)
	}
}

func TestDeltaTouchEmitsReset(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	w.touch("Pod")
	drain(w)
	d := soleDelta(t, captured())
	if !d.Reset {
		t.Fatal("a touch must flush as a Reset delta")
	}
}

func TestDeltaTouchSupersedesItems(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	w.record("Pod", podBinding, DeltaUpsert, podWithIP("ns", "a", "1.1.1.1"))
	w.touch("Pod") // e.g. a post-sync touch arrives in the same window
	drain(w)
	d := soleDelta(t, captured())
	if !d.Reset || len(d.Upserts) != 0 {
		t.Fatalf("touch must supersede buffered items, got reset=%v upserts=%d", d.Reset, len(d.Upserts))
	}
}

func TestDeltaGenerationIncrementsPerKind(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	w.record("Pod", podBinding, DeltaUpsert, podWithIP("ns", "a", "1.1.1.1"))
	drain(w)
	w.record("Pod", podBinding, DeltaUpsert, podWithIP("ns", "b", "1.1.1.2"))
	drain(w)

	got := captured()
	if len(got) != 2 {
		t.Fatalf("expected two flushes, got %d", len(got))
	}
	if got[0].delta.Gen != 1 || got[1].delta.Gen != 2 {
		t.Fatalf("gen must increment per kind, got %d then %d", got[0].delta.Gen, got[1].delta.Gen)
	}
}

func TestDeltaStoppedDropsEvents(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	w.stopped = true
	w.record("Pod", podBinding, DeltaUpsert, podWithIP("ns", "a", "1.1.1.1"))
	if len(w.pending) != 0 {
		t.Fatal("a stopped watcher must not buffer events")
	}
	w.flush()
	if len(captured()) != 0 {
		t.Fatal("a stopped watcher must not emit deltas")
	}
}

func TestRecordWithoutProjectorTouches(t *testing.T) {
	w, captured := newDeltaTestWatcher()
	bare := kindBinding{} // no project
	w.record("ConfigMap", bare, DeltaUpsert, podWithIP("ns", "a", "1.1.1.1"))
	drain(w)
	d := soleDelta(t, captured())
	if !d.Reset {
		t.Fatal("a kind without a projector must flush as Reset")
	}
}
