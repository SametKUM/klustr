package kube

import (
	"sync"
	"time"
)

// Raw stdout/PTY bytes are coalesced before crossing the Wails bridge: each
// emit is a synchronous json.Marshal + JSEscape + main-thread ExecJS dispatch,
// so emitting per SPDY frame / per PTY read lets a firehose (cat a big file,
// tail -f, a verbose build) saturate the renderer and jank the UI. logs.go
// solved this for line streams; this is the byte-stream equivalent. Flush on
// whichever comes first. 16 ms (~one frame) stays well under perceptible
// latency for interactive echo while collapsing a firehose to ~60 emits/s.
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
