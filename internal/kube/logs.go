package kube

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"sync"
	"sync/atomic"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
)

const (
	logScannerMaxLine = 1024 * 1024 // 1 MiB per line cap
	// Scanned lines are coalesced into batches before crossing the Wails bridge
	// (one EventsEmit per flush instead of per line) so a chatty stream can't
	// saturate the bridge / renderer. Flush on whichever comes first.
	logFlushInterval = 60 * time.Millisecond
	logFlushMaxLines = 256
)

type LogBatchFunc func(lines []string)
type LogCloseFunc func(err error)

type logSession struct {
	id     string
	cancel context.CancelFunc
}

type logSessionManager struct {
	mu       sync.Mutex
	sessions map[string]*logSession
	counter  uint64
}

func newLogSessionManager() *logSessionManager {
	return &logSessionManager{sessions: make(map[string]*logSession)}
}

func (mgr *logSessionManager) start(
	parent context.Context,
	cs *kubernetes.Clientset,
	namespace, podName, container string,
	follow bool,
	tailLines int64,
	onBatch LogBatchFunc,
	onClose LogCloseFunc,
) (string, error) {
	ctx, cancel := context.WithCancel(parent)
	opts := &corev1.PodLogOptions{
		Container: container,
		Follow:    follow,
	}
	if tailLines > 0 {
		opts.TailLines = &tailLines
	}

	stream, err := cs.CoreV1().Pods(namespace).GetLogs(podName, opts).Stream(ctx)
	if err != nil {
		cancel()
		return "", err
	}

	id := fmt.Sprintf("log-%d", atomic.AddUint64(&mgr.counter, 1))
	sess := &logSession{id: id, cancel: cancel}

	mgr.mu.Lock()
	mgr.sessions[id] = sess
	mgr.mu.Unlock()

	go func() {
		defer func() {
			_ = stream.Close()
			mgr.mu.Lock()
			delete(mgr.sessions, id)
			mgr.mu.Unlock()
			cancel()
		}()

		// Producer: scan lines onto a channel. scanErr is set before lineCh is
		// closed (deferred), and read by the consumer only after the channel
		// closes, so the handoff is race-free.
		lineCh := make(chan string, logFlushMaxLines)
		var scanErr error
		go func() {
			defer close(lineCh)
			scanner := bufio.NewScanner(stream)
			scanner.Buffer(make([]byte, 64*1024), logScannerMaxLine)
			for scanner.Scan() {
				select {
				case lineCh <- scanner.Text():
				case <-ctx.Done():
					return
				}
			}
			if err := scanner.Err(); err != nil && !errors.Is(err, io.EOF) && ctx.Err() == nil {
				scanErr = err
			}
		}()

		// Consumer: coalesce into time/size-bounded batches.
		ticker := time.NewTicker(logFlushInterval)
		defer ticker.Stop()
		batch := make([]string, 0, 64)
		flush := func() {
			if len(batch) == 0 {
				return
			}
			onBatch(batch)
			batch = make([]string, 0, 64)
		}
		for {
			select {
			case line, ok := <-lineCh:
				if !ok {
					// Drop any buffered lines on user/shutdown cancel; otherwise
					// flush them before the close marker.
					if ctx.Err() == nil {
						flush()
					}
					if onClose != nil {
						if ctx.Err() != nil {
							onClose(nil)
						} else {
							onClose(scanErr)
						}
					}
					return
				}
				batch = append(batch, line)
				if len(batch) >= logFlushMaxLines {
					flush()
				}
			case <-ticker.C:
				flush()
			}
		}
	}()

	return id, nil
}

func (mgr *logSessionManager) stop(id string) {
	mgr.mu.Lock()
	sess, ok := mgr.sessions[id]
	if ok {
		delete(mgr.sessions, id)
	}
	mgr.mu.Unlock()
	if ok {
		sess.cancel()
	}
}

// stopAll cancels every live log stream. Called from ClientManager.Shutdown
// so the apiserver-side watch goroutines unwind before the process exits
// instead of leaking until the kubelet times out their TCP connection.
func (mgr *logSessionManager) stopAll() {
	mgr.mu.Lock()
	sessions := make([]*logSession, 0, len(mgr.sessions))
	for _, s := range mgr.sessions {
		sessions = append(sessions, s)
	}
	mgr.sessions = make(map[string]*logSession)
	mgr.mu.Unlock()
	for _, s := range sessions {
		s.cancel()
	}
}
