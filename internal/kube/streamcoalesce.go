package kube

import (
	"sync"
	"time"
	"unicode/utf8"
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
// slow synchronous emit backpressures the writer. A UTF-8 sequence cut off at
// the end of the buffer waits for the next write: each emit crosses the bridge
// as a JSON string, and encoding/json would turn both halves of a split
// character into U+FFFD. Caller holds c.mu.
func (c *byteCoalescer) flushLocked() {
	c.emitLocked(len(c.buf) - partialRuneLen(c.buf))
}

// emitLocked emits the first n buffered bytes and keeps the rest.
func (c *byteCoalescer) emitLocked(n int) {
	if c.timer != nil {
		c.timer.Stop()
		c.timer = nil
	}
	if n == 0 {
		return
	}
	data := string(c.buf[:n])
	c.buf = append(c.buf[:0], c.buf[n:]...)
	c.onData(data)
}

// close emits everything left, a cut-off sequence included: no more bytes can
// complete it.
func (c *byteCoalescer) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.emitLocked(len(c.buf))
	c.closed = true
}

// partialRuneLen returns the length of the incomplete UTF-8 sequence that ends
// b, or 0 when b ends on a character boundary. Bytes that no later byte can
// complete count as complete, so invalid input is never held back.
func partialRuneLen(b []byte) int {
	for i := len(b) - 1; i >= 0 && i >= len(b)-utf8.UTFMax; i-- {
		if !utf8.RuneStart(b[i]) {
			continue
		}
		if utf8.FullRune(b[i:]) {
			return 0
		}
		return len(b) - i
	}
	return 0
}
