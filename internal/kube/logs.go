package kube

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"sync"
	"sync/atomic"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
)

const logScannerMaxLine = 1024 * 1024 // 1 MiB per line cap

type LogLineFunc func(line string)
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
	onLine LogLineFunc,
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
		}()

		scanner := bufio.NewScanner(stream)
		scanner.Buffer(make([]byte, 64*1024), logScannerMaxLine)
		for scanner.Scan() {
			if ctx.Err() != nil {
				if onClose != nil {
					onClose(nil)
				}
				return
			}
			onLine(scanner.Text())
		}
		err := scanner.Err()
		if err != nil && !errors.Is(err, io.EOF) && ctx.Err() == nil {
			if onClose != nil {
				onClose(err)
			}
			return
		}
		if onClose != nil {
			onClose(nil)
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
