package kube

import (
	"context"
	"testing"
)

// stopForContext must cancel (and drop) only the sessions bound to the given
// context, so disconnecting one context can't tear down another's log streams.
// exec/terminal managers share this exact pattern.
func TestLogStopForContext(t *testing.T) {
	mgr := newLogSessionManager()
	ctxA, cancelA := context.WithCancel(context.Background())
	ctxB, cancelB := context.WithCancel(context.Background())
	mgr.sessions["a"] = &logSession{id: "a", context: "ctx-a", cancel: cancelA}
	mgr.sessions["b"] = &logSession{id: "b", context: "ctx-b", cancel: cancelB}

	mgr.stopForContext("ctx-a")

	if ctxA.Err() == nil {
		t.Error("ctx-a session should have been cancelled")
	}
	if ctxB.Err() != nil {
		t.Error("ctx-b session must not be cancelled")
	}
	if _, ok := mgr.sessions["a"]; ok {
		t.Error("ctx-a session should have been removed")
	}
	if _, ok := mgr.sessions["b"]; !ok {
		t.Error("ctx-b session must remain")
	}
	cancelB()
}
