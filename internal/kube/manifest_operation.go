package kube

import (
	"context"
	"fmt"
	"slices"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
)

func (m *ClientManager) cancelManifests(contextName string) {
	m.manifestSchemas.invalidate(contextName)
	for _, s := range m.manifestSessionList(contextName) {
		s.mu.Lock()
		s.invalidated = true
		if s.cancel != nil {
			s.cancel()
		}
		s.mu.Unlock()
	}
}

// A preview is single-use. Concurrent clicks and repeated bridge calls observe
// the same operation instead of issuing a second set of create requests.
func (m *ClientManager) CreateManifest(ctx context.Context, id string, progress func(ManifestOperation)) (*ManifestOperation, error) {
	s, err := m.manifestSession(id)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.phase == "creating" || s.phase == "results" {
		result := s.snapshot()
		return &result, nil
	}
	if s.phase != "review" {
		return nil, fmt.Errorf("review the manifest before creating resources")
	}
	if s.invalidated {
		return nil, fmt.Errorf("the connection changed; review the remaining manifest again")
	}
	ready := 0
	for _, entry := range s.entries {
		if entry.Status == "failed" || entry.Status == "unknown" {
			return nil, fmt.Errorf("resolve failed or unknown resources before creating")
		}
		if entry.Status == "ready" {
			ready++
		}
	}
	if ready == 0 {
		return nil, fmt.Errorf("no resources are ready to create")
	}
	if err := m.assertWritable(s.contextName); err != nil {
		return nil, err
	}
	operationCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	s.cancel, s.phase = cancel, "creating"
	s.stopRequested = false
	s.revision++
	s.expires = time.Now().Add(manifestTTL)
	// Keep the reviewed endpoint and transport. Editing kubeconfig between
	// Review and Create must never redirect an approved write to another cluster.
	go m.runManifestCreate(operationCtx, s, s.client, progress)
	result := s.snapshot()
	return &result, nil
}

func (m *ClientManager) runManifestCreate(ctx context.Context, s *manifestSession, dyn dynamic.Interface, progress func(ManifestOperation)) {
	publish := func() {
		s.mu.Lock()
		s.revision++
		snapshot := s.snapshot()
		s.mu.Unlock()
		if progress != nil {
			progress(snapshot)
		}
	}
	defer func() {
		s.mu.Lock()
		if s.cancel != nil {
			s.cancel()
		}
		s.cancel = nil
		s.phase = "results"
		s.expires = time.Now().Add(manifestTTL)
		for i := range s.entries {
			if s.entries[i].Status == "ready" {
				s.entries[i].Status = "pending"
			}
		}
		s.mu.Unlock()
		publish()
	}()
	for i := range s.entries {
		s.mu.Lock()
		entry := &s.entries[i]
		if entry.Status != "ready" {
			s.mu.Unlock()
			continue
		}
		if ctx.Err() != nil || s.stopRequested || s.invalidated {
			s.mu.Unlock()
			return
		}
		if err := m.assertWritable(s.contextName); err != nil {
			entry.Status, entry.Error, entry.Reason = "failed", "Read-only mode is enabled. No further resources were created.", "ReadOnly"
			s.mu.Unlock()
			return
		}
		entry.Status = "creating"
		object := entry.object.DeepCopy()
		client := manifestResourceClient(dyn, entry)
		s.mu.Unlock()
		publish()
		requestCtx, warnings := manifestWarningContext(ctx)
		created, err := client.Create(requestCtx, object, metav1.CreateOptions{FieldManager: "klustr", FieldValidation: metav1.FieldValidationStrict})
		s.mu.Lock()
		for _, warning := range warnings.messages {
			if !slices.Contains(entry.Warnings, warning) {
				entry.Warnings = append(entry.Warnings, warning)
			}
		}
		if err != nil {
			entry.Error, entry.Reason = manifestError(err, true)
			entry.Status = "failed"
			if entry.Reason == "Unknown" {
				entry.Status = "unknown"
			}
			s.mu.Unlock()
			return
		}
		entry.Status, entry.Name, entry.predicted = "created", created.GetName(), created
		s.mu.Unlock()
		publish()
	}
}

func (m *ClientManager) CancelManifest(id string) error {
	s, err := m.manifestSession(id)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.phase == "creating" {
		s.stopRequested = true
	} else if s.cancel != nil {
		s.cancel()
	}
	return nil
}

func (m *ClientManager) ReleaseManifest(id string) error {
	s, err := m.manifestSession(id)
	if err != nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.phase == "creating" || s.phase == "reviewing" {
		return fmt.Errorf("wait for the active operation to finish")
	}
	s.phase = "expired"
	m.removeManifestSession(s)
	return nil
}

func (m *ClientManager) ReviewRemainingManifest(ctx context.Context, id string) (*ManifestOperation, error) {
	s, err := m.manifestSession(id)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	if s.phase != "review" && s.phase != "results" {
		s.mu.Unlock()
		return nil, fmt.Errorf("an operation is already running")
	}
	if s.invalidated {
		s.mu.Unlock()
		return nil, fmt.Errorf("the connection changed; edit and review the remaining manifest again")
	}
	if slices.ContainsFunc(s.entries, func(entry manifestEntry) bool { return entry.Status == "unknown" }) {
		s.mu.Unlock()
		return nil, fmt.Errorf("check resources with unknown outcomes before reviewing again")
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	working := &manifestSession{entries: cloneManifestEntries(s.entries)}
	dyn, d := s.client, s.discovery
	s.phase = "reviewing"
	s.cancel = cancel
	s.revision++
	s.mu.Unlock()
	complete := false
	defer func() {
		cancel()
		if complete {
			return
		}
		s.mu.Lock()
		if s.phase == "reviewing" {
			s.phase = "results"
			s.revision++
		}
		s.cancel = nil
		s.mu.Unlock()
	}()
	// Discovery can lag a newly established CRD. Retry only reads, bounded by
	// the caller's context; creating prerequisites always requires a new review.
	deadline := time.Now().Add(20 * time.Second)
	for {
		kinds, _, err := discoverManifestKinds(d)
		if err != nil {
			return nil, err
		}
		missing := false
		for i := range working.entries {
			entry := &working.entries[i]
			if entry.Status == "created" {
				continue
			}
			if mapping, found := findManifestKind(kinds, entry.APIVersion, entry.Kind); found {
				entry.mapping = mapping
				entry.Resource = mapping.Resource
			} else {
				missing = true
			}
		}
		if !missing || time.Now().After(deadline) {
			break
		}
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("API discovery timed out; review the remaining resources again")
		case <-time.After(time.Second):
		}
	}
	reviewManifestEntries(ctx, working, dyn)
	s.mu.Lock()
	if ctx.Err() != nil || s.invalidated {
		s.mu.Unlock()
		return nil, fmt.Errorf("review cancelled; review the remaining resources again")
	}
	s.entries, s.phase = working.entries, "review"
	s.cancel = nil
	s.revision++
	s.expires = time.Now().Add(manifestTTL)
	result := s.snapshot()
	complete = true
	s.mu.Unlock()
	return &result, nil
}
