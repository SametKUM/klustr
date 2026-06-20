package kube

import "testing"

func isClosed(ch chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}

func (mgr *pfManager) addSessionForTest(id, contextName string) chan struct{} {
	stopCh := make(chan struct{})
	mgr.mu.Lock()
	mgr.sessions[id] = &pfSession{
		info:   PortForwardInfo{ID: id, Context: contextName, Status: "ready"},
		stopCh: stopCh,
	}
	mgr.mu.Unlock()
	return stopCh
}

func TestStopForContextClosesOnlyMatchingSessions(t *testing.T) {
	mgr := newPFManager()
	var notified int
	mgr.setOnChange(func() { notified++ })

	a1 := mgr.addSessionForTest("pf-1", "ctx-a")
	a2 := mgr.addSessionForTest("pf-2", "ctx-a")
	b1 := mgr.addSessionForTest("pf-3", "ctx-b")

	mgr.stopForContext("ctx-a")

	if !isClosed(a1) || !isClosed(a2) {
		t.Fatalf("expected ctx-a stop channels to be closed")
	}
	if isClosed(b1) {
		t.Fatalf("expected ctx-b stop channel to stay open")
	}
	if got := mgr.list(); len(got) != 1 || got[0].Context != "ctx-b" {
		t.Fatalf("expected only the ctx-b session to remain, got %+v", got)
	}
	if notified != 1 {
		t.Fatalf("expected exactly one change notification, got %d", notified)
	}
}

func TestStopForContextNoMatchDoesNotNotify(t *testing.T) {
	mgr := newPFManager()
	var notified int
	mgr.setOnChange(func() { notified++ })
	mgr.addSessionForTest("pf-1", "ctx-a")

	mgr.stopForContext("ctx-missing")

	if notified != 0 {
		t.Fatalf("expected no notification when nothing matched, got %d", notified)
	}
	if got := mgr.list(); len(got) != 1 {
		t.Fatalf("expected the unmatched session to remain, got %+v", got)
	}
}
