package kube

import (
	"strings"
	"sync"
	"testing"
)

func collector() (func(string), func() []string) {
	var mu sync.Mutex
	var got []string
	return func(s string) {
			mu.Lock()
			got = append(got, s)
			mu.Unlock()
		}, func() []string {
			mu.Lock()
			defer mu.Unlock()
			return append([]string{}, got...)
		}
}

// close() must flush the buffered tail, and the concatenation of all emits must
// equal the bytes written, in order — coalescing may not drop or reorder data.
func TestByteCoalescerPreservesContentAndFlushesTail(t *testing.T) {
	onData, calls := collector()
	c := newByteCoalescer(onData)
	c.Write([]byte("ab"))
	c.Write([]byte("cd"))
	c.Write([]byte("ef"))
	c.close()

	if joined := strings.Join(calls(), ""); joined != "abcdef" {
		t.Fatalf("expected all bytes preserved in order, got %q", joined)
	}
}

// A write exceeding the size cap must flush immediately, before close — that's
// the backpressure that keeps a firehose from buffering unbounded.
func TestByteCoalescerSizeCapFlushesImmediately(t *testing.T) {
	onData, calls := collector()
	c := newByteCoalescer(onData)
	c.Write(make([]byte, streamFlushMaxBytes+1))
	if len(calls()) == 0 {
		t.Fatal("expected an immediate flush once the buffer exceeded the size cap")
	}
	c.close()
}

// After close, further writes must be dropped, not emitted.
func TestByteCoalescerClosedDropsWrites(t *testing.T) {
	onData, calls := collector()
	c := newByteCoalescer(onData)
	c.close()
	c.Write([]byte("late"))
	if len(calls()) != 0 {
		t.Fatalf("expected no emits after close, got %v", calls())
	}
}
