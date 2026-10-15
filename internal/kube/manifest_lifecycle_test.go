package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/discovery"
	discoveryfake "k8s.io/client-go/discovery/fake"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/rest"
	ktesting "k8s.io/client-go/testing"
)

func manifestDiscoveryFixture() *discoveryfake.FakeDiscovery {
	d := &discoveryfake.FakeDiscovery{Fake: &ktesting.Fake{}}
	d.Resources = []*metav1.APIResourceList{{GroupVersion: "v1", APIResources: []metav1.APIResource{
		{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: []string{"create"}},
		{Name: "namespaces", Kind: "Namespace", Verbs: []string{"create"}},
	}}}
	return d
}

func TestManifestStopFinishesCurrentRequestAndCanResume(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	var writes atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var obj map[string]any
		_ = json.NewDecoder(r.Body).Decode(&obj)
		if r.URL.Query().Get("dryRun") == "" && writes.Add(1) == 1 {
			close(started)
			select {
			case <-release:
			case <-r.Context().Done():
				t.Error("graceful stop aborted the active request")
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(obj)
	}))
	defer server.Close()
	dyn, _ := dynamic.NewForConfig(&rest.Config{Host: server.URL})
	m, s := manifestFixture(t, dyn, configMapManifest+"---\n"+strings.ReplaceAll(configMapManifest, "example", "second"))
	s.discovery = manifestDiscoveryFixture()
	done := make(chan ManifestOperation, 1)
	progress := func(op ManifestOperation) {
		if op.Phase == "results" {
			done <- op
		}
	}
	if _, err := m.CreateManifest(context.Background(), s.id, progress); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("write did not start")
	}
	if err := m.CancelManifest(s.id); err != nil {
		t.Fatal(err)
	}
	close(release)
	select {
	case op := <-done:
		if op.Resources[0].Status != "created" || op.Resources[1].Status != "pending" || writes.Load() != 1 {
			t.Fatalf("stop lost the current result or wrote the next resource: %+v", op)
		}
	case <-time.After(time.Second):
		t.Fatal("stop did not finish")
	}
	op, err := m.ReviewRemainingManifest(context.Background(), s.id)
	if err != nil || op.Resources[0].Status != "created" || op.Resources[1].Status != "ready" {
		t.Fatalf("cannot resume: %+v %v", op, err)
	}
	if _, err := m.CreateManifest(context.Background(), s.id, progress); err != nil {
		t.Fatal(err)
	}
	select {
	case op := <-done:
		if writes.Load() != 2 || op.Resources[1].Status != "created" {
			t.Fatalf("remaining resources not created: %+v", op)
		}
	case <-time.After(time.Second):
		t.Fatal("resume did not finish")
	}
}

func TestManifestRemainingReviewDoesNotBlockSessionsOrDisconnect(t *testing.T) {
	started := make(chan struct{})
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var obj map[string]any
		_ = json.NewDecoder(r.Body).Decode(&obj)
		if requests.Add(1) > 1 {
			close(started)
			<-r.Context().Done()
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(obj)
	}))
	defer server.Close()
	dyn, _ := dynamic.NewForConfig(&rest.Config{Host: server.URL})
	m, s := manifestFixture(t, dyn, configMapManifest)
	s.discovery = manifestDiscoveryFixture()
	other := &manifestSession{id: "other", contextName: "other", phase: "review", expires: time.Now().Add(time.Hour)}
	m.manifests.sessions[other.id] = other
	done := make(chan error, 1)
	go func() { _, err := m.ReviewRemainingManifest(context.Background(), s.id); done <- err }()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("review did not start")
	}
	defer m.cancelManifests("")
	available := make(chan error, 1)
	go func() { _, err := m.GetManifestOperation(s.id); available <- err }()
	select {
	case err := <-available:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("network review held the session lock")
	}
	other.mu.Lock()
	cancelled := make(chan struct{})
	go func() { m.cancelManifests("ctx"); close(cancelled) }()
	select {
	case <-cancelled:
	case <-time.After(time.Second):
		other.mu.Unlock()
		t.Fatal("disconnect waited on an unrelated session")
	}
	other.mu.Unlock()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("cancelled review was accepted")
		}
	case <-time.After(time.Second):
		t.Fatal("disconnect did not cancel review")
	}
	op, _ := m.GetManifestOperation(s.id)
	if op.Phase != "results" {
		t.Fatalf("review phase stuck: %+v", op)
	}
	if _, err := m.CreateManifest(context.Background(), s.id, nil); err != nil {
		t.Fatal("completed operation must remain idempotent", err)
	}
	if _, err := m.ReviewRemainingManifest(context.Background(), s.id); err == nil {
		t.Fatal("disconnected review reused its old client")
	}
}

func TestManifestSessionsExpireAndEnforceCapacityBeforeDiscovery(t *testing.T) {
	m := &ClientManager{}
	for i := range 16 {
		if err := m.registerManifestSession(&manifestSession{id: fmt.Sprint(i), phase: "review", expires: time.Now().Add(time.Hour)}); err != nil {
			t.Fatal(err)
		}
	}
	m.manifests.clients = func(string) (dynamic.Interface, discovery.DiscoveryInterface, error) {
		t.Error("session limit must be checked before network discovery")
		return nil, nil, fmt.Errorf("unexpected discovery")
	}
	if _, err := m.ReviewManifest(context.Background(), "ctx", "team", configMapManifest); err == nil || !strings.Contains(err.Error(), "too many") {
		t.Fatalf("capacity not enforced: %v", err)
	}
	old := m.manifests.sessions["0"]
	old.expires = time.Now().Add(-time.Second)
	if err := m.registerManifestSession(&manifestSession{id: "new", phase: "review", expires: time.Now().Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.manifestSession("0"); err == nil {
		t.Fatal("expired session survived sweep")
	}
	if old.phase != "expired" || len(m.manifests.sessions) != 16 {
		t.Fatal("expired session was not replaced safely")
	}
}

func TestManifestOutcomesSurviveExpiryAndSweepUntilReleased(t *testing.T) {
	for _, status := range []string{"created", "unknown"} {
		t.Run(status, func(t *testing.T) {
			dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
			m, s := manifestFixture(t, dyn, configMapManifest+"---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: remaining\n")
			s.phase = "results"
			s.entries[0].Status = status
			s.entries[1].Status = "failed"
			s.expires = time.Now().Add(-2 * manifestTTL)
			if err := m.registerManifestSession(&manifestSession{id: "other", phase: "review", expires: time.Now().Add(time.Hour)}); err != nil {
				t.Fatal(err)
			}
			op, err := m.GetManifestOperation(s.id)
			if err != nil || op.Resources[0].Status != status {
				t.Fatalf("outcome expired during sweep or lookup: %v, %+v", err, op)
			}
			if _, err := m.GetManifestPreview(s.id, 0, false); err != nil {
				t.Fatal("result preview expired", err)
			}
			remaining, err := m.GetRemainingManifest(s.id)
			if status == "unknown" {
				if err == nil || !strings.Contains(err.Error(), "unknown outcomes") {
					t.Fatal("unknown outcome guard lost", err)
				}
			} else {
				docs, parseErr := parseManifest(remaining)
				if err != nil || parseErr != nil || len(docs) != 1 || docs[0].object.GetName() != "remaining" {
					t.Fatalf("remainder unavailable: %v, %v, %s", err, parseErr, remaining)
				}
				s.discovery = manifestDiscoveryFixture()
				op, err = m.ReviewRemainingManifest(context.Background(), s.id)
				if err != nil || op.Resources[0].Status != "created" || op.Resources[1].Status != "ready" {
					t.Fatalf("cannot resume after TTL: %v, %+v", err, op)
				}
				s.expires = time.Now().Add(-2 * manifestTTL)
				if _, err := m.GetRemainingManifest(s.id); err != nil {
					t.Fatal("created entries expired in review phase", err)
				}
			}
			if err := m.ReleaseManifest(s.id); err != nil {
				t.Fatal(err)
			}
			if _, err := m.GetManifestOperation(s.id); err == nil {
				t.Fatal("explicit release retained outcomes")
			}
		})
	}
}

func TestManifestRemainingReviewPreservesCreatedPrerequisites(t *testing.T) {
	dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
	m, s := manifestFixture(t, dyn, configMapManifest+"---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: team\n")
	s.discovery = manifestDiscoveryFixture()
	s.entries[1].Status = "created"
	op, err := m.ReviewRemainingManifest(context.Background(), s.id)
	if err != nil {
		t.Fatal(err)
	}
	if op.Resources[0].Status != "ready" || op.Resources[1].Status != "created" {
		t.Fatalf("prerequisite lost: %+v", op)
	}
	for _, action := range dyn.Actions()[1:] {
		if action.GetResource().Resource != "configmaps" {
			t.Fatal("created prerequisite was reviewed again")
		}
	}
	s.entries[0].Status = "unknown"
	if _, err := m.ReviewRemainingManifest(context.Background(), s.id); err == nil {
		t.Fatal("uncertain write reviewed again")
	}
}

type manifestDiscoveryOverride struct {
	discovery.DiscoveryInterface
	list func() ([]*metav1.APIGroup, []*metav1.APIResourceList, error)
}

func (d manifestDiscoveryOverride) ServerGroupsAndResources() ([]*metav1.APIGroup, []*metav1.APIResourceList, error) {
	return d.list()
}

func TestManifestRemainingDiscoveryFailureRestoresPhaseAndCanRetry(t *testing.T) {
	m, s := manifestFixture(t, dynamicfake.NewSimpleDynamicClient(runtime.NewScheme()), configMapManifest)
	s.discovery = manifestDiscoveryOverride{list: func() ([]*metav1.APIGroup, []*metav1.APIResourceList, error) {
		return nil, nil, fmt.Errorf("unavailable")
	}}
	if _, err := m.ReviewRemainingManifest(context.Background(), s.id); err == nil {
		t.Fatal("discovery error ignored")
	}
	if s.phase != "results" || s.cancel != nil {
		t.Fatal("failed review retained an active phase")
	}
	s.discovery = manifestDiscoveryFixture()
	if op, err := m.ReviewRemainingManifest(context.Background(), s.id); err != nil || op.Phase != "review" {
		t.Fatalf("retry failed: %+v %v", op, err)
	}
}

func TestManifestRemainingRetriesDiscoveryWithoutRecreatingResources(t *testing.T) {
	dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
	m, s := manifestFixture(t, dyn, configMapManifest)
	disco := manifestDiscoveryFixture()
	calls := 0
	s.discovery = manifestDiscoveryOverride{list: func() ([]*metav1.APIGroup, []*metav1.APIResourceList, error) {
		calls++
		if calls == 1 {
			return nil, []*metav1.APIResourceList{}, nil
		}
		return disco.ServerGroupsAndResources()
	}}
	op, err := m.ReviewRemainingManifest(context.Background(), s.id)
	if err != nil || calls != 2 || op.Resources[0].Status != "ready" {
		t.Fatalf("discovery retry failed: %+v %v (%d calls)", op, err, calls)
	}
	for _, action := range dyn.Actions() {
		if len(action.(ktesting.CreateActionImpl).CreateOptions.DryRun) == 0 {
			t.Fatal("discovery retry performed an actual create")
		}
	}
}

func TestManifestInitialReviewIsCancelledWithoutOrphaningSession(t *testing.T) {
	started := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		close(started)
		<-r.Context().Done()
	}))
	defer server.Close()
	dyn, _ := dynamic.NewForConfig(&rest.Config{Host: server.URL})
	m := &ClientManager{}
	m.manifests.clients = func(string) (dynamic.Interface, discovery.DiscoveryInterface, error) {
		return dyn, manifestDiscoveryFixture(), nil
	}
	done := make(chan error, 1)
	go func() {
		_, err := m.ReviewManifest(context.Background(), "ctx", "team", configMapManifest)
		done <- err
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("review did not start")
	}
	m.cancelManifests("ctx")
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("cancelled initial review accepted")
		}
	case <-time.After(time.Second):
		t.Fatal("initial review did not cancel")
	}
	if len(m.manifestSessionList("")) != 0 {
		t.Fatal("cancelled review leaked a session")
	}
}
