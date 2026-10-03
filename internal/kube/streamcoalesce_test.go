package kube

import (
	"encoding/json"
	"math/rand/v2"
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

// bridged mirrors the Wails event bridge, which JSON-encodes every emit:
// encoding/json turns invalid UTF-8, such as half of a split character, into
// U+FFFD.
func bridged(t *testing.T, emits []string) string {
	t.Helper()
	var b strings.Builder
	for _, s := range emits {
		raw, err := json.Marshal(s)
		if err != nil {
			t.Fatal(err)
		}
		var decoded string
		if err := json.Unmarshal(raw, &decoded); err != nil {
			t.Fatal(err)
		}
		b.WriteString(decoded)
	}
	return b.String()
}

// A flush between the bytes of one character must hold the partial character
// back, or it crosses the bridge as U+FFFD.
func TestByteCoalescerKeepsSplitCharactersWhole(t *testing.T) {
	for _, char := range []string{"ç", "─", "🚀"} {
		for cut := 1; cut < len(char); cut++ {
			onData, calls := collector()
			c := newByteCoalescer(onData)
			c.Write([]byte("a" + char[:cut]))
			c.flush() // the 16 ms timer firing mid-character
			c.Write([]byte(char[cut:] + "b"))
			c.close()

			want := "a" + char + "b"
			if got := bridged(t, calls()); got != want {
				t.Fatalf("%q cut at %d: got %q, want %q (emits %q)", char, cut, got, want, calls())
			}
		}
	}
}

// The size-cap flush must not split a character either.
func TestByteCoalescerSizeCapKeepsCharactersWhole(t *testing.T) {
	onData, calls := collector()
	c := newByteCoalescer(onData)
	head := strings.Repeat("x", streamFlushMaxBytes-1)
	c.Write([]byte(head + "─"[:1]))
	if len(calls()) == 0 {
		t.Fatal("expected the size cap to flush")
	}
	c.Write([]byte("─"[1:]))
	c.close()

	if got := bridged(t, calls()); got != head+"─" {
		runes := []rune(got)
		t.Fatalf("size-cap flush split a character: tail %q", string(runes[max(0, len(runes)-3):]))
	}
}

// Bytes that can never complete a character are not held back, and close()
// emits a truncated tail rather than dropping it.
func TestByteCoalescerEmitsInvalidAndTruncatedBytes(t *testing.T) {
	onData, calls := collector()
	c := newByteCoalescer(onData)
	c.Write([]byte("\xff\x80"))
	c.flush()
	if got := calls(); len(got) != 1 || got[0] != "\xff\x80" {
		t.Fatalf("expected invalid bytes emitted at once, got %q", got)
	}
	c.Write([]byte("z\xf0\x9f"))
	c.close()
	if joined := strings.Join(calls(), ""); joined != "\xff\x80z\xf0\x9f" {
		t.Fatalf("expected every byte emitted by close, got %q", joined)
	}
}

// Random UTF-8 text in random write sizes with random flushes in between must
// cross the bridge unchanged.
func TestByteCoalescerRandomSplitsCrossBridgeIntact(t *testing.T) {
	alphabet := []rune("aZ09 \n\tçğışöüİ─│┌┐└┘═🚀🙂")
	rng := rand.New(rand.NewPCG(1, 2))
	for round := range 200 {
		var text strings.Builder
		for range 1 + rng.IntN(400) {
			text.WriteRune(alphabet[rng.IntN(len(alphabet))])
		}
		input := []byte(text.String())

		onData, calls := collector()
		c := newByteCoalescer(onData)
		for len(input) > 0 {
			n := min(1+rng.IntN(9), len(input))
			c.Write(input[:n])
			input = input[n:]
			if rng.IntN(2) == 0 {
				c.flush()
			}
		}
		c.close()

		if got := bridged(t, calls()); got != text.String() {
			t.Fatalf("round %d: got %q, want %q", round, got, text.String())
		}
	}
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
