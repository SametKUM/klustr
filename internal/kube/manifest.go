package kube

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"sigs.k8s.io/yaml"
)

const manifestTTL = 30 * time.Minute

var manifestUnknownFieldPattern = regexp.MustCompile(`unknown field "([a-zA-Z0-9_.\[\]-]+)"`)

type ManifestResource struct {
	Index        int      `json:"index"`
	Document     int      `json:"document"`
	Line         int      `json:"line"`
	APIVersion   string   `json:"apiVersion"`
	Kind         string   `json:"kind"`
	Resource     string   `json:"resource"`
	Namespace    string   `json:"namespace"`
	Name         string   `json:"name"`
	GenerateName string   `json:"generateName"`
	Status       string   `json:"status"`
	Error        string   `json:"error"`
	Reason       string   `json:"reason"`
	Warnings     []string `json:"warnings"`
	Dependencies []int    `json:"dependencies"`
	Sensitive    bool     `json:"sensitive"`
}

type ManifestOperation struct {
	Revision    int                `json:"revision"`
	ID          string             `json:"id"`
	ContextName string             `json:"contextName"`
	Phase       string             `json:"phase"`
	Resources   []ManifestResource `json:"resources"`
	Warnings    []string           `json:"warnings"`
}

type ManifestPreview struct {
	Before string `json:"before"`
	After  string `json:"after"`
}

type manifestEntry struct {
	ManifestResource
	object    *unstructured.Unstructured
	predicted *unstructured.Unstructured
	mapping   ManifestKind
}

type manifestSession struct {
	client        dynamic.Interface
	discovery     discovery.DiscoveryInterface
	revision      int
	mu            sync.Mutex
	id            string
	contextName   string
	phase         string
	entries       []manifestEntry
	warnings      []string
	expires       time.Time
	cancel        context.CancelFunc
	stopRequested bool
	invalidated   bool
}

type manifestSessions struct {
	clients  func(string) (dynamic.Interface, discovery.DiscoveryInterface, error)
	mu       sync.Mutex
	sessions map[string]*manifestSession
}

func (s *manifestSession) snapshot() ManifestOperation {
	resources := make([]ManifestResource, 0, len(s.entries))
	for _, entry := range s.entries {
		item := entry.ManifestResource
		item.Dependencies = append([]int{}, item.Dependencies...)
		item.Warnings = append([]string{}, item.Warnings...)
		resources = append(resources, item)
	}
	return ManifestOperation{Revision: s.revision, ID: s.id, ContextName: s.contextName, Phase: s.phase, Resources: resources, Warnings: append([]string{}, s.warnings...)}
}

// Outcomes cannot be reconstructed from the original YAML, especially for
// generateName resources. Keep them until the editor explicitly releases them.
// The registry's session cap still bounds retained drafts in memory.
func (s *manifestSession) shouldExpire(now time.Time) bool {
	if s.phase == "expired" {
		return true
	}
	if s.phase == "creating" || s.phase == "reviewing" {
		return false
	}
	for _, entry := range s.entries {
		if entry.Status == "created" || entry.Status == "unknown" {
			return false
		}
	}
	return now.After(s.expires)
}

func (m *ClientManager) manifestSession(id string) (*manifestSession, error) {
	m.manifests.mu.Lock()
	s := m.manifests.sessions[id]
	m.manifests.mu.Unlock()
	if s == nil {
		return nil, fmt.Errorf("preview expired; review the manifest again")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.shouldExpire(time.Now()) {
		s.phase = "expired"
		m.removeManifestSession(s)
		return nil, fmt.Errorf("preview expired; review the manifest again")
	}
	return s, nil
}

func (m *ClientManager) ReviewManifest(ctx context.Context, contextName, defaultNamespace, source string) (*ManifestOperation, error) {
	if contextName == "" {
		return nil, fmt.Errorf("select a target context")
	}
	docs, err := parseManifest(source)
	if err != nil {
		return nil, err
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	s := &manifestSession{id: hex.EncodeToString(id[:]), contextName: contextName, phase: "reviewing", expires: time.Now().Add(manifestTTL), cancel: cancel}
	if err := m.registerManifestSession(s); err != nil {
		return nil, err
	}
	complete := false
	defer func() {
		if !complete {
			m.removeManifestSession(s)
		}
	}()
	dyn, d, err := m.manifestClients(contextName)
	if err != nil {
		return nil, err
	}
	kinds, warnings, err := discoverManifestKinds(d)
	if err != nil {
		return nil, err
	}
	entries, err := prepareManifest(docs, kinds, defaultNamespace)
	if err != nil {
		return nil, err
	}
	working := &manifestSession{entries: entries, warnings: warnings}
	reviewManifestEntries(ctx, working, dyn)
	s.mu.Lock()
	defer s.mu.Unlock()
	if ctx.Err() != nil || s.invalidated {
		return nil, fmt.Errorf("review cancelled; reconnect and review the manifest again")
	}
	s.client, s.discovery = dyn, d
	s.entries, s.warnings = working.entries, working.warnings
	s.phase, s.cancel = "review", nil
	s.revision++
	s.expires = time.Now().Add(manifestTTL)
	complete = true
	result := s.snapshot()
	return &result, nil
}

// Registry locks never cover session locks or network calls. Session pointers
// are immutable; operations claim their phase under the session's own lock.
func (m *ClientManager) manifestSessionList(contextName string) []*manifestSession {
	m.manifests.mu.Lock()
	defer m.manifests.mu.Unlock()
	sessions := make([]*manifestSession, 0, len(m.manifests.sessions))
	for _, s := range m.manifests.sessions {
		if contextName == "" || s.contextName == contextName {
			sessions = append(sessions, s)
		}
	}
	return sessions
}

func (m *ClientManager) removeManifestSession(s *manifestSession) {
	m.manifests.mu.Lock()
	defer m.manifests.mu.Unlock()
	if m.manifests.sessions[s.id] == s {
		delete(m.manifests.sessions, s.id)
	}
}

func (m *ClientManager) registerManifestSession(s *manifestSession) error {
	for _, old := range m.manifestSessionList("") {
		old.mu.Lock()
		if old.shouldExpire(time.Now()) {
			old.phase = "expired"
			m.removeManifestSession(old)
		}
		old.mu.Unlock()
	}
	m.manifests.mu.Lock()
	defer m.manifests.mu.Unlock()
	if len(m.manifests.sessions) >= 16 {
		return fmt.Errorf("too many open previews; close an earlier editor session")
	}
	if m.manifests.sessions == nil {
		m.manifests.sessions = make(map[string]*manifestSession)
	}
	m.manifests.sessions[s.id] = s
	return nil
}

func cloneManifestEntries(entries []manifestEntry) []manifestEntry {
	cloned := append([]manifestEntry{}, entries...)
	for i := range cloned {
		entry := &cloned[i]
		entry.Dependencies = append([]int{}, entry.Dependencies...)
		entry.Warnings = append([]string{}, entry.Warnings...)
		entry.object = entry.object.DeepCopy()
		entry.predicted = entry.predicted.DeepCopy()
	}
	return cloned
}

func prepareManifest(docs []manifestDocument, kinds []ManifestKind, defaultNamespace string) ([]manifestEntry, error) {
	entries := make([]manifestEntry, 0, len(docs))
	namespaces := make(map[string]int)
	crds := make(map[string]int)
	for i, doc := range docs {
		obj := doc.object
		if obj.GetAPIVersion() == "v1" && obj.GetKind() == "Namespace" {
			namespaces[obj.GetName()] = i
		}
		if obj.GetAPIVersion() == "apiextensions.k8s.io/v1" && obj.GetKind() == "CustomResourceDefinition" {
			group, _, _ := unstructured.NestedString(obj.Object, "spec", "group")
			kind, _, _ := unstructured.NestedString(obj.Object, "spec", "names", "kind")
			versions, _, _ := unstructured.NestedSlice(obj.Object, "spec", "versions")
			for _, version := range versions {
				v, ok := version.(map[string]any)
				if ok && v["served"] == true {
					crds[fmt.Sprintf("%s/%v/%s", group, v["name"], kind)] = i
				}
			}
		}
	}
	seen := make(map[string]bool)
	for i, doc := range docs {
		obj := doc.object.DeepCopy()
		mapping, found := findManifestKind(kinds, obj.GetAPIVersion(), obj.GetKind())
		deps := []int{}
		if parent, ok := crds[obj.GetAPIVersion()+"/"+obj.GetKind()]; ok {
			deps = append(deps, parent)
			if !found {
				definition := docs[parent].object
				resource, _, _ := unstructured.NestedString(definition.Object, "spec", "names", "plural")
				scope, _, _ := unstructured.NestedString(definition.Object, "spec", "scope")
				mapping = ManifestKind{APIVersion: obj.GetAPIVersion(), Kind: obj.GetKind(), Resource: resource, Namespaced: scope == "Namespaced"}
				found = resource != "" && (scope == "Namespaced" || scope == "Cluster")
			}
		}
		if !found {
			return nil, fmt.Errorf("document %d, line %d: %s (%s) is not a served, creatable resource", doc.document, doc.line, obj.GetKind(), obj.GetAPIVersion())
		}
		if mapping.Namespaced {
			if _, _, err := unstructured.NestedString(obj.Object, "metadata", "namespace"); err != nil {
				return nil, fmt.Errorf("document %d: metadata.namespace must be a string", doc.document)
			}
			if obj.GetNamespace() == "" {
				obj.SetNamespace(defaultNamespace)
			}
			if obj.GetNamespace() == "" {
				return nil, fmt.Errorf("document %d: select a default namespace or set metadata.namespace", doc.document)
			}
			if len(validation.IsDNS1123Label(obj.GetNamespace())) != 0 {
				return nil, fmt.Errorf("document %d: metadata.namespace must be a single valid namespace name", doc.document)
			}
			if parent, ok := namespaces[obj.GetNamespace()]; ok {
				deps = append(deps, parent)
			}
		} else if obj.GetNamespace() != "" {
			return nil, fmt.Errorf("document %d: %s is cluster-scoped; remove metadata.namespace", doc.document, obj.GetKind())
		}
		gv, _ := schema.ParseGroupVersion(mapping.APIVersion)
		identity := strings.Join([]string{gv.Group, mapping.Resource, obj.GetNamespace(), obj.GetName()}, "/")
		if obj.GetName() != "" && seen[identity] {
			return nil, fmt.Errorf("document %d: duplicate resource identity", doc.document)
		}
		seen[identity] = true
		entries = append(entries, manifestEntry{ManifestResource: ManifestResource{Index: i, Document: doc.document, Line: doc.line, APIVersion: obj.GetAPIVersion(), Kind: obj.GetKind(), Resource: mapping.Resource, Namespace: obj.GetNamespace(), Name: obj.GetName(), GenerateName: obj.GetGenerateName(), Status: "pending", Dependencies: deps, Warnings: []string{}, Sensitive: obj.GetKind() == "Secret" && gv.Group == ""}, object: obj, mapping: mapping})
	}
	return entries, nil
}

func findManifestKind(kinds []ManifestKind, apiVersion, kind string) (ManifestKind, bool) {
	for _, mapping := range kinds {
		if mapping.APIVersion == apiVersion && mapping.Kind == kind {
			return mapping, true
		}
	}
	return ManifestKind{}, false
}

func manifestResourceClient(dyn dynamic.Interface, entry *manifestEntry) dynamic.ResourceInterface {
	gv, _ := schema.ParseGroupVersion(entry.APIVersion)
	return resourceFor(dyn, schema.GroupVersionResource{Group: gv.Group, Version: gv.Version, Resource: entry.Resource}, entry.Namespace)
}

func reviewManifestEntries(ctx context.Context, s *manifestSession, dyn dynamic.Interface) {
	for i := range s.entries {
		entry := &s.entries[i]
		if entry.Status == "created" || entry.Status == "unknown" {
			continue
		}
		entry.predicted = nil
		entry.Error, entry.Reason = "", ""
		blocked := slices.ContainsFunc(entry.Dependencies, func(parent int) bool { return s.entries[parent].Status != "created" })
		if blocked {
			entry.Status = "blocked"
			continue
		}
		requestCtx, warnings := manifestWarningContext(ctx)
		predicted, err := manifestResourceClient(dyn, entry).Create(requestCtx, entry.object.DeepCopy(), metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}, FieldManager: "klustr", FieldValidation: metav1.FieldValidationStrict})
		entry.Warnings = warnings.messages
		if err != nil {
			entry.Status = "failed"
			entry.Error, entry.Reason = manifestError(err, false)
			continue
		}
		entry.predicted, entry.Status = predicted, "ready"
	}
	s.phase = "review"
	s.revision++
}

// Full server errors may contain the rejected object or admission-supplied
// values. Return structural information and field paths, never those values.
func manifestError(err error, write bool) (string, string) {
	switch {
	case apierrors.IsAlreadyExists(err):
		return "A resource with this name already exists. Open it to edit, or choose another name.", "AlreadyExists"
	case apierrors.IsForbidden(err):
		return "The server denied this request. Check create permissions and admission policies.", "Forbidden"
	case apierrors.IsUnauthorized(err):
		return "Authentication failed. Reconnect the context and review again.", "Unauthorized"
	case apierrors.IsNotFound(err):
		return "The namespace or API endpoint is not available yet. Review again after its prerequisite is ready.", "NotFound"
	case apierrors.IsInvalid(err), apierrors.IsBadRequest(err):
		fields := []string{}
		var status apierrors.APIStatus
		if errors.As(err, &status) && status.Status().Details != nil {
			for _, cause := range status.Status().Details.Causes {
				if cause.Field != "" {
					fields = append(fields, cause.Field)
				}
			}
		}
		for _, match := range manifestUnknownFieldPattern.FindAllStringSubmatch(err.Error(), -1) {
			fields = append(fields, match[1])
		}
		if len(fields) > 0 {
			return "The server rejected these fields: " + strings.Join(fields, ", "), "Invalid"
		}
		return "The server rejected this manifest. Check field names, types, required values and admission rules.", "Invalid"
	case apierrors.IsConflict(err):
		return "The resource changed or conflicts with another operation. Review again.", "Conflict"
	case apierrors.IsTooManyRequests(err):
		return "The server is busy. Wait, then review again.", "TooManyRequests"
	}
	if write {
		return "The request outcome is unknown. Check the cluster before creating this resource again.", "Unknown"
	}
	return "The server could not complete the request. Check connectivity and admission webhook health, then review again.", "ServerError"
}

func (m *ClientManager) GetManifestOperation(id string) (*ManifestOperation, error) {
	s, err := m.manifestSession(id)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	result := s.snapshot()
	return &result, nil
}

func (m *ClientManager) GetManifestPreview(id string, index int, reveal bool) (*ManifestPreview, error) {
	s, err := m.manifestSession(id)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if index < 0 || index >= len(s.entries) {
		return nil, fmt.Errorf("resource not found")
	}
	entry := &s.entries[index]
	before, err := manifestPreviewYAML(entry.object, entry.Sensitive && !reveal)
	if err != nil {
		return nil, err
	}
	after, err := manifestPreviewYAML(entry.predicted, entry.Sensitive && !reveal)
	if err != nil {
		return nil, err
	}
	return &ManifestPreview{Before: before, After: after}, nil
}

func (m *ClientManager) GetRemainingManifest(id string) (string, error) {
	s, err := m.manifestSession(id)
	if err != nil {
		return "", err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.phase == "creating" || s.phase == "reviewing" {
		return "", fmt.Errorf("wait for the active operation to finish")
	}
	parts := []string{}
	for _, entry := range s.entries {
		if entry.Status == "unknown" {
			return "", fmt.Errorf("check resources with unknown outcomes in the cluster before starting another creation attempt")
		}
		if entry.Status == "created" {
			continue
		}
		body, err := manifestPreviewYAML(entry.object, false)
		if err != nil {
			return "", err
		}
		parts = append(parts, body)
	}
	return strings.Join(parts, "---\n"), nil
}

func manifestPreviewYAML(obj *unstructured.Unstructured, redact bool) (string, error) {
	if obj == nil {
		return "", nil
	}
	obj = obj.DeepCopy()
	for _, key := range []string{"managedFields", "creationTimestamp", "generation", "resourceVersion", "uid", "selfLink"} {
		unstructured.RemoveNestedField(obj.Object, "metadata", key)
	}
	if redact {
		for _, field := range []string{"data", "stringData"} {
			if values, ok, _ := unstructured.NestedMap(obj.Object, field); ok {
				for key := range values {
					values[key] = "<hidden>"
				}
				_ = unstructured.SetNestedMap(obj.Object, values, field)
			}
		}
	}
	data, err := yaml.Marshal(obj.Object)
	return string(data), err
}
