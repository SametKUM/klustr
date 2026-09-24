package kube

import (
	"sync"
	"time"
)

// Exec/PTY bytes are coalesced before crossing the Wails bridge: every emit is
// a synchronous marshal + main-thread ExecJS, so emitting per read lets output
// like `cat` of a big file jank the UI. Flush on whichever limit hits first;
// 16 ms (one frame) keeps interactive echo imperceptible.
const (
	streamFlushInterval = 16 * time.Millisecond
	streamFlushMaxBytes = 64 * 1024
)

// byteCoalescer batches raw byte writes and flushes them as one string on a
// small time/size window. Its Write satisfies io.Writer (exec's SPDY sink);
// close() flushes the tail. Safe for concurrent Write/close.
type byteCoalescer struct {
	onData func(string)
	mu     sync.Mutex
	buf    []byte
	timer  *time.Timer
	closed bool
}

func newByteCoalescer(onData func(string)) *byteCoalescer {
	return &byteCoalescer{onData: onData}
}

func (c *byteCoalescer) Write(p []byte) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return len(p), nil
	}
	c.buf = append(c.buf, p...)
	if len(c.buf) >= streamFlushMaxBytes {
		c.flushLocked()
	} else if c.timer == nil {
		c.timer = time.AfterFunc(streamFlushInterval, c.flush)
	}
	return len(p), nil
}

func (c *byteCoalescer) flush() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.flushLocked()
}

// flushLocked emits the buffered bytes under c.mu so flushes stay ordered and a
// slow synchronous emit backpressures the writer. Caller holds c.mu.
func (c *byteCoalescer) flushLocked() {
	if c.timer != nil {
		c.timer.Stop()
		c.timer = nil
	}
	if len(c.buf) == 0 {
		return
	}
	data := string(c.buf)
	c.buf = c.buf[:0]
	c.onData(data)
}

func (c *byteCoalescer) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.flushLocked()
	c.closed = true
}
