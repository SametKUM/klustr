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
	m.manifests.mu.Lock()
	defer m.manifests.mu.Unlock()
	for _, s := range m.manifests.sessions {
		s.mu.Lock()
		if contextName == "" || s.contextName == contextName {
			if s.cancel != nil {
				s.cancel()
			}
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
		if progress != nil {
			s.mu.Lock()
			s.revision++
			snapshot := s.snapshot()
			s.mu.Unlock()
			progress(snapshot)
		}
	}
	defer func() {
		s.mu.Lock()
		s.cancel()
		s.cancel = nil
		s.phase = "results"
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
		if err := ctx.Err(); err != nil {
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
	if s.cancel != nil {
		s.cancel()
	}
	return nil
}

func (m *ClientManager) ReleaseManifest(id string) error {
	m.manifests.mu.Lock()
	defer m.manifests.mu.Unlock()
	s := m.manifests.sessions[id]
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.phase == "creating" || s.phase == "reviewing" {
		return fmt.Errorf("wait for the active operation to finish")
	}
	delete(m.manifests.sessions, id)
	return nil
}

func (m *ClientManager) ReviewRemainingManifest(ctx context.Context, id string) (*ManifestOperation, error) {
	s, err := m.manifestSession(id)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	if s.phase == "creating" || s.phase == "reviewing" {
		s.mu.Unlock()
		return nil, fmt.Errorf("an operation is already running")
	}
	s.phase = "reviewing"
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		if s.phase == "reviewing" {
			s.phase = "results"
		}
		s.mu.Unlock()
	}()
	dyn, d := s.client, s.discovery
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	// Discovery can lag a newly established CRD. Retry only reads, bounded by
	// the caller's context; creating prerequisites always requires a new review.
	deadline := time.Now().Add(20 * time.Second)
	for {
		kinds, _, err := discoverManifestKinds(d)
		if err != nil {
			return nil, err
		}
		s.mu.Lock()
		missing := false
		for i := range s.entries {
			entry := &s.entries[i]
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
		s.mu.Unlock()
		if !missing || time.Now().After(deadline) {
			break
		}
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("API discovery timed out; review the remaining resources again")
		case <-time.After(time.Second):
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	reviewManifestEntries(ctx, s, dyn)
	s.expires = time.Now().Add(manifestTTL)
	result := s.snapshot()
	return &result, nil
}
