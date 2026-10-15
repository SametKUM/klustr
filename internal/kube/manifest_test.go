package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	discoveryfake "k8s.io/client-go/discovery/fake"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/rest"
	ktesting "k8s.io/client-go/testing"
)

const configMapManifest = "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: example\ndata:\n  message: hello\n"

var manifestTestKinds = []ManifestKind{
	{APIVersion: "v1", Kind: "ConfigMap", Resource: "configmaps", Namespaced: true},
	{APIVersion: "v1", Kind: "Secret", Resource: "secrets", Namespaced: true},
	{APIVersion: "v1", Kind: "Namespace", Resource: "namespaces"},
	{APIVersion: "apiextensions.k8s.io/v1", Kind: "CustomResourceDefinition", Resource: "customresourcedefinitions"},
}

func TestParseManifest(t *testing.T) {
	for _, tc := range []struct {
		name, source  string
		count         int
		errorContains string
	}{
		{"single", configMapManifest, 1, ""},
		{"null documents", "null\n---\n" + configMapManifest + "---\n~\n", 1, ""},
		{"multiple", "# comment\r\n---\r\n" + configMapManifest + "---\n" + strings.ReplaceAll(configMapManifest, "example", "second") + "---\n# tail\n", 2, ""},
		{"JSON", `{"apiVersion":"v1","kind":"Namespace","metadata":{"name":"team"}}`, 1, ""},
		{"List", "apiVersion: v1\nkind: List\nitems:\n  - apiVersion: v1\n    kind: Namespace\n    metadata:\n      name: team\n", 1, ""},
		{"generateName", "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  generateName: test-\n", 1, ""},
		{"block scalar separator", configMapManifest + "  script: |\n    ---\n    password\n", 1, ""},
		{"empty", "# comment\n---\n", 0, "no resources"},
		{"scalar", "password", 0, "expected a Kubernetes object"},
		{"sequence", "- value", 0, "expected a Kubernetes object"},
		{"duplicate", configMapManifest + "kind: Secret\n", 0, "duplicate object key"},
		{"duplicate nested", "apiVersion: v1\nkind: Secret\nmetadata:\n  name: x\nstringData:\n  password: first-secret\n  password: second-secret", 0, "duplicate object key"},
		{"no kind", "apiVersion: v1\nmetadata:\n  name: test", 0, "apiVersion and kind"},
		{"no name", "apiVersion: v1\nkind: Pod", 0, "metadata.name"},
		{"custom tag", "password: !vault secret", 0, "custom YAML tags"},
		{"syntax", "apiVersion: [unclosed-secret", 0, "invalid YAML"},
		{"bad list", "apiVersion: v1\nkind: List\nitems: password", 0, "List.items"},
		{"size limit", strings.Repeat("x", maxManifestBytes+1), 0, "2 MiB"},
		{"count limit", strings.Repeat(configMapManifest+"---\n", maxManifestItems+1), 0, "resource limit"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseManifest(tc.source)
			if tc.errorContains != "" {
				if err == nil || !strings.Contains(err.Error(), tc.errorContains) {
					t.Fatalf("error = %v; want %s", err, tc.errorContains)
				}
				for _, secret := range []string{"first-secret", "second-secret", "unclosed-secret"} {
					if strings.Contains(err.Error(), secret) {
						t.Fatal("parser diagnostic exposed a scalar")
					}
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != tc.count {
				t.Fatalf("count = %d, want %d", len(got), tc.count)
			}
		})
	}
}

func TestManifestNamespacesAndIdentity(t *testing.T) {
	for _, tc := range []struct{ name, source, namespace, wantNamespace, errorContains string }{
		{"default", configMapManifest, "team", "team", ""},
		{"explicit", strings.Replace(configMapManifest, "name: example", "name: example\n  namespace: explicit", 1), "team", "explicit", ""},
		{"missing", configMapManifest, "", "", "default namespace"},
		{"multiple namespace default", configMapManifest, "team-a,team-b", "", "single valid namespace"},
		{"wrong namespace type", strings.Replace(configMapManifest, "name: example", "name: example\n  namespace: 123", 1), "default", "", "must be a string"},
		{"cluster", "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: team", "default", "", ""},
		{"cluster namespace", "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: team\n  namespace: wrong", "default", "", "cluster-scoped"},
		{"duplicate", configMapManifest + "---\n" + configMapManifest, "default", "", "duplicate resource"},
		{"unsupported", strings.Replace(configMapManifest, "v1", "v9", 1), "default", "", "not a served"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			docs, err := parseManifest(tc.source)
			if err != nil {
				t.Fatal(err)
			}
			entries, err := prepareManifest(docs, manifestTestKinds, tc.namespace)
			if tc.errorContains != "" {
				if err == nil || !strings.Contains(err.Error(), tc.errorContains) {
					t.Fatalf("error = %v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if entries[0].Namespace != tc.wantNamespace {
				t.Fatalf("namespace = %q", entries[0].Namespace)
			}
			if docs[0].object.GetNamespace() != "" && tc.name != "explicit" {
				t.Fatal("input mutated")
			}
		})
	}
}

func TestManifestDependencyStages(t *testing.T) {
	source := configMapManifest + "---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: team\n"
	docs, _ := parseManifest(source)
	entries, err := prepareManifest(docs, manifestTestKinds, "team")
	if err != nil {
		t.Fatal(err)
	}
	s := &manifestSession{entries: entries}
	dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
	reviewManifestEntries(context.Background(), s, dyn)
	if s.entries[0].Status != "blocked" || s.entries[1].Status != "ready" {
		t.Fatalf("unexpected stages: %+v", s.snapshot())
	}
	if len(dyn.Actions()) != 1 || dyn.Actions()[0].GetResource().Resource != "namespaces" {
		t.Fatal("dependent resource was dry-run before its prerequisite existed")
	}
	s.entries[1].Status = "created"
	reviewManifestEntries(context.Background(), s, dyn)
	if s.entries[0].Status != "ready" {
		t.Fatal("dependent resource did not become ready")
	}
}

func TestManifestCRDDependencyAndServedVersions(t *testing.T) {
	source := "apiVersion: example.com/v1\nkind: Widget\nmetadata:\n  name: test\n---\napiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: widgets.example.com\nspec:\n  group: example.com\n  names:\n    kind: Widget\n    plural: widgets\n  scope: Namespaced\n  versions:\n    - name: v1\n      served: true\n    - name: v2\n      served: false\n"
	docs, err := parseManifest(source)
	if err != nil {
		t.Fatal(err)
	}
	entries, err := prepareManifest(docs, manifestTestKinds, "team")
	if err != nil {
		t.Fatal(err)
	}
	if entries[0].Resource != "widgets" || len(entries[0].Dependencies) != 1 || entries[0].Dependencies[0] != 1 {
		t.Fatal("CRD mapping/dependency missing")
	}
	docs[0].object.SetAPIVersion("example.com/v2")
	if _, err := prepareManifest(docs, manifestTestKinds, "team"); err == nil {
		t.Fatal("unserved CRD version accepted")
	}
}

func TestManifestDiscoveryFiltersSubresources(t *testing.T) {
	d := &discoveryfake.FakeDiscovery{Fake: &ktesting.Fake{}}
	d.Resources = []*metav1.APIResourceList{{GroupVersion: "v1", APIResources: []metav1.APIResource{
		{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: []string{"create"}},
		{Name: "pods/exec", Kind: "Pod", Verbs: []string{"create"}},
		{Name: "nodes", Kind: "Node", Verbs: []string{"list"}},
	}}}
	kinds, _, err := discoverManifestKinds(d)
	if err != nil {
		t.Fatal(err)
	}
	if len(kinds) != 1 || kinds[0].Resource != "configmaps" {
		t.Fatalf("unexpected kinds: %+v", kinds)
	}
}

func manifestFixture(t *testing.T, dyn dynamic.Interface, source string) (*ClientManager, *manifestSession) {
	t.Helper()
	if fake, ok := dyn.(*dynamicfake.FakeDynamicClient); ok {
		fake.PrependReactor("create", "*", func(action ktesting.Action) (bool, runtime.Object, error) {
			create := action.(ktesting.CreateActionImpl)
			if len(create.GetCreateOptions().DryRun) > 0 {
				return true, create.GetObject().DeepCopyObject(), nil
			}
			return false, nil, nil
		})
	}
	docs, err := parseManifest(source)
	if err != nil {
		t.Fatal(err)
	}
	entries, err := prepareManifest(docs, manifestTestKinds, "team")
	if err != nil {
		t.Fatal(err)
	}
	s := &manifestSession{id: "preview", contextName: "ctx", entries: entries, phase: "review", expires: time.Now().Add(time.Hour), warnings: []string{}}
	reviewManifestEntries(context.Background(), s, dyn)
	m := &ClientManager{watchers: map[string]*contextWatcher{"ctx": {dyn: dyn}}, readOnly: make(map[string]bool)}
	m.manifests.sessions = map[string]*manifestSession{s.id: s}
	s.client = dyn
	return m, s
}

func TestManifestCreateUsesPostStrictAndDryRunWithoutGet(t *testing.T) {
	var mu sync.Mutex
	requests := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		requests = append(requests, r.Method+" "+r.URL.RequestURI())
		mu.Unlock()
		if r.Method != http.MethodPost {
			t.Error("create-only must not require get/list/patch permissions")
		}
		if r.URL.Query().Get("fieldValidation") != "Strict" {
			t.Error("strict validation missing")
		}
		if r.URL.Path != "/api/v1/namespaces/team/configmaps" {
			t.Errorf("wrong target %s", r.URL.Path)
		}
		var obj map[string]any
		if err := json.NewDecoder(r.Body).Decode(&obj); err != nil {
			t.Error(err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(obj)
	}))
	defer server.Close()
	dyn, err := dynamic.NewForConfig(&rest.Config{Host: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	m, s := manifestFixture(t, dyn, configMapManifest)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan ManifestOperation, 1)
	if _, err := m.CreateManifest(ctx, s.id, func(op ManifestOperation) {
		if op.Phase == "results" {
			done <- op
		}
	}); err != nil {
		t.Fatal(err)
	}
	select {
	case op := <-done:
		if op.Resources[0].Status != "created" {
			t.Fatalf("unexpected result %+v", op)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("create did not finish")
	}
	if _, err := m.CreateManifest(ctx, s.id, nil); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(requests) != 2 || !strings.Contains(requests[0], "dryRun=All") || strings.Contains(requests[1], "dryRun") {
		t.Fatalf("requests = %v", requests)
	}
}

func TestManifestCreateStopsAfterErrorAndRespectsReadOnly(t *testing.T) {
	for _, readOnly := range []bool{false, true} {
		t.Run(fmt.Sprint(readOnly), func(t *testing.T) {
			dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
			m, s := manifestFixture(t, dyn, configMapManifest+"---\n"+strings.ReplaceAll(configMapManifest, "example", "second"))
			writes := 0
			dyn.PrependReactor("create", "*", func(action ktesting.Action) (bool, runtime.Object, error) {
				writes++
				return true, nil, apierrors.NewAlreadyExists(schema.GroupResource{Resource: "configmaps"}, "example")
			})
			m.SetReadOnly("ctx", readOnly)
			done := make(chan ManifestOperation, 1)
			_, err := m.CreateManifest(context.Background(), s.id, func(op ManifestOperation) {
				if op.Phase == "results" {
					done <- op
				}
			})
			if readOnly {
				if err == nil || writes != 0 {
					t.Fatal("read-only mutation allowed")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			select {
			case op := <-done:
				if writes != 1 || op.Resources[0].Status != "failed" || op.Resources[1].Status != "pending" {
					t.Fatalf("unexpected result %+v; writes %d", op, writes)
				}
			case <-time.After(time.Second):
				t.Fatal("operation did not complete")
			}
		})
	}
}

func TestManifestPreviewPreservesOwnerReferencesAndRedactsSecrets(t *testing.T) {
	source := "apiVersion: v1\nkind: Secret\nmetadata:\n  name: credentials\n  ownerReferences:\n    - apiVersion: v1\n      kind: ConfigMap\n      name: owner\n      uid: abc\nstringData:\n  password: do-not-expose\n"
	m, s := manifestFixture(t, dynamicfake.NewSimpleDynamicClient(runtime.NewScheme()), source)
	preview, err := m.GetManifestPreview(s.id, 0, false)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(preview.Before+preview.After, "do-not-expose") {
		t.Fatal("secret exposed in default preview")
	}
	if !strings.Contains(preview.Before, "ownerReferences") {
		t.Fatal("owner references were removed")
	}
	revealed, _ := m.GetManifestPreview(s.id, 0, true)
	if !strings.Contains(revealed.Before, "do-not-expose") {
		t.Fatal("explicit reveal did not work")
	}
	data, _ := json.Marshal(s.snapshot())
	if strings.Contains(string(data), "do-not-expose") {
		t.Fatal("progress payload contains manifest data")
	}
}

func TestManifestErrorsDoNotExposeServerValues(t *testing.T) {
	err := apierrors.NewInvalid(schema.GroupKind{Kind: "Secret"}, "credentials", nil)
	err.ErrStatus.Message = "rejected password=do-not-expose"
	message, _ := manifestError(err, false)
	if strings.Contains(message, "do-not-expose") {
		t.Fatal("server values exposed")
	}
	_, reason := manifestError(context.DeadlineExceeded, true)
	if reason != "Unknown" {
		t.Fatal("uncertain write may be retried unsafely")
	}
	message, _ = manifestError(apierrors.NewBadRequest(`strict decoding error: unknown field "spec.replica"; password=do-not-expose`), false)
	if !strings.Contains(message, "spec.replica") || strings.Contains(message, "do-not-expose") {
		t.Fatal("field diagnostic was lost or leaked server values")
	}
}

func TestManifestDuplicateIdentityAcrossVersions(t *testing.T) {
	docs, _ := parseManifest("apiVersion: example.com/v1\nkind: Widget\nmetadata:\n  name: x\n---\napiVersion: example.com/v2\nkind: Widget\nmetadata:\n  name: x\n")
	kinds := []ManifestKind{{APIVersion: "example.com/v1", Kind: "Widget", Resource: "widgets"}, {APIVersion: "example.com/v2", Kind: "Widget", Resource: "widgets"}}
	if _, err := prepareManifest(docs, kinds, ""); err == nil {
		t.Fatal("same object accepted twice through different API versions")
	}
}

func TestManifestExpiredPreviewCannotCreate(t *testing.T) {
	m, s := manifestFixture(t, dynamicfake.NewSimpleDynamicClient(runtime.NewScheme()), configMapManifest)
	s.expires = time.Now().Add(-time.Second)
	if _, err := m.CreateManifest(context.Background(), s.id, nil); err == nil {
		t.Fatal("expired preview accepted")
	}
}

func TestManifestReadOnlyEnabledBetweenResources(t *testing.T) {
	dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
	m, s := manifestFixture(t, dyn, configMapManifest+"---\n"+strings.ReplaceAll(configMapManifest, "example", "second"))
	done := make(chan ManifestOperation, 1)
	_, err := m.CreateManifest(context.Background(), s.id, func(op ManifestOperation) {
		if op.Resources[0].Status == "created" {
			m.SetReadOnly("ctx", true)
		}
		if op.Phase == "results" {
			done <- op
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	select {
	case op := <-done:
		if op.Resources[1].Reason != "ReadOnly" {
			t.Fatalf("second write allowed: %+v", op)
		}
	case <-time.After(time.Second):
		t.Fatal("operation did not complete")
	}
}

func TestManifestGeneratedNameUsesActualResponse(t *testing.T) {
	dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
	m, s := manifestFixture(t, dyn, strings.ReplaceAll(configMapManifest, "name: example", "generateName: example-"))
	dyn.PrependReactor("create", "*", func(action ktesting.Action) (bool, runtime.Object, error) {
		obj := action.(ktesting.CreateAction).GetObject().(*unstructured.Unstructured).DeepCopy()
		obj.SetName("example-generated")
		return true, obj, nil
	})
	done := make(chan ManifestOperation, 1)
	_, err := m.CreateManifest(context.Background(), s.id, func(op ManifestOperation) {
		if op.Phase == "results" {
			done <- op
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	select {
	case op := <-done:
		if op.Resources[0].Name != "example-generated" {
			t.Fatal("generated name was not recorded")
		}
	case <-time.After(time.Second):
		t.Fatal("operation did not complete")
	}
}

func TestManifestRemainingOmitsCreatedAndRefusesUnknown(t *testing.T) {
	m, s := manifestFixture(t, dynamicfake.NewSimpleDynamicClient(runtime.NewScheme()), configMapManifest+"---\n"+strings.ReplaceAll(configMapManifest, "example", "second"))
	s.entries[0].Status = "created"
	remaining, err := m.GetRemainingManifest(s.id)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(remaining, "example") || !strings.Contains(remaining, "second") {
		t.Fatal("successful resources would be replayed")
	}
	s.entries[1].Status = "unknown"
	if _, err := m.GetRemainingManifest(s.id); err == nil {
		t.Fatal("unknown write could be repeated")
	}
}

func TestManifestConcurrentCreateIsSingleUse(t *testing.T) {
	dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
	m, s := manifestFixture(t, dyn, configMapManifest)
	started, release := make(chan struct{}), make(chan struct{})
	defer close(release)
	dyn.PrependReactor("create", "*", func(action ktesting.Action) (bool, runtime.Object, error) {
		close(started)
		<-release
		return true, action.(ktesting.CreateAction).GetObject(), nil
	})
	done := make(chan ManifestOperation, 1)
	if _, err := m.CreateManifest(context.Background(), s.id, func(op ManifestOperation) {
		if op.Phase == "results" {
			done <- op
		}
	}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("write not started")
	}
	for range 5 {
		if op, err := m.CreateManifest(context.Background(), s.id, nil); err != nil || op.Phase != "creating" {
			t.Fatalf("duplicate create: %+v %v", op, err)
		}
	}
	release <- struct{}{}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("operation did not finish")
	}
}

func TestManifestReviewPinsEndpointAndInput(t *testing.T) {
	first, second := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme()), dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
	first.PrependReactor("create", "*", func(action ktesting.Action) (bool, runtime.Object, error) {
		create := action.(ktesting.CreateActionImpl)
		if len(create.CreateOptions.DryRun) > 0 {
			return true, create.Object.DeepCopyObject(), nil
		}
		return false, nil, nil
	})
	disco := &discoveryfake.FakeDiscovery{Fake: &ktesting.Fake{}}
	disco.Resources = []*metav1.APIResourceList{{GroupVersion: "v1", APIResources: []metav1.APIResource{{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: []string{"create"}}}}}
	m := &ClientManager{}
	m.manifests.clients = func(string) (dynamic.Interface, discovery.DiscoveryInterface, error) { return first, disco, nil }
	operation, err := m.ReviewManifest(context.Background(), "ctx", "team", configMapManifest)
	if err != nil {
		t.Fatal(err)
	}
	if operation.Resources[0].Status != "ready" {
		t.Fatalf("review failed: %+v", operation)
	}
	m.manifests.clients = func(string) (dynamic.Interface, discovery.DiscoveryInterface, error) { return second, disco, nil }
	done := make(chan ManifestOperation, 1)
	_, err = m.CreateManifest(context.Background(), operation.ID, func(op ManifestOperation) {
		if op.Phase == "results" {
			done <- op
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("operation did not finish")
	}
	if len(second.Actions()) != 0 {
		t.Fatal("reviewed operation was redirected to a new endpoint")
	}
	if len(first.Actions()) != 2 {
		t.Fatalf("expected one dry-run and one create, got %d actions", len(first.Actions()))
	}
	created := first.Actions()[1].(ktesting.CreateAction).GetObject().(*unstructured.Unstructured)
	if created.GetName() != "example" || created.GetNamespace() != "team" {
		t.Fatal("reviewed identity was not preserved")
	}
}

func TestManifestCancelTracksUncertainWrite(t *testing.T) {
	started := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var obj map[string]any
		_ = json.NewDecoder(r.Body).Decode(&obj)
		if r.URL.Query().Get("dryRun") != "" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(obj)
			return
		}
		close(started)
		<-r.Context().Done()
	}))
	defer server.Close()
	dyn, _ := dynamic.NewForConfig(&rest.Config{Host: server.URL})
	m, s := manifestFixture(t, dyn, configMapManifest)
	done := make(chan ManifestOperation, 1)
	_, err := m.CreateManifest(context.Background(), s.id, func(op ManifestOperation) {
		if op.Phase == "results" {
			done <- op
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("write not started")
	}
	if err := m.CancelManifest(s.id); err != nil {
		t.Fatal(err)
	}
	select {
	case op := <-done:
		if op.Resources[0].Status != "unknown" {
			t.Fatalf("uncertain request marked safe to retry: %+v", op)
		}
	case <-time.After(time.Second):
		t.Fatal("cancel did not stop the request")
	}
}

func TestManifestWarningHandlerDoesNotEchoAdmissionValues(t *testing.T) {
	ctx, sink := manifestWarningContext(context.Background())
	handler := manifestWarningHandler{}
	handler.HandleWarningHeaderWithContext(ctx, 299, "server", "admission warning password=do-not-expose")
	handler.HandleWarningHeaderWithContext(ctx, 299, "server", "this API is deprecated")
	if len(sink.messages) != 2 || strings.Contains(strings.Join(sink.messages, " "), "do-not-expose") {
		t.Fatal("warning contents escaped")
	}
	if !strings.Contains(sink.messages[1], "deprecated") {
		t.Fatal("deprecation warning lost")
	}
}

func TestManifestSchemaUsesClusterOpenAPIAndV2Fallback(t *testing.T) {
	for _, v3 := range []bool{true, false} {
		t.Run(fmt.Sprint(v3), func(t *testing.T) {
			requests := []string{}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests = append(requests, r.URL.Path)
				w.Header().Set("Content-Type", "application/json")
				switch r.URL.Path {
				case "/openapi/v3":
					if !v3 {
						http.Error(w, "unavailable", http.StatusNotFound)
						return
					}
					_, _ = w.Write([]byte(`{"paths":{"api/v1":{"serverRelativeURL":"/openapi/v3/api/v1?hash=local"}}}`))
				case "/openapi/v3/api/v1":
					_, _ = w.Write([]byte(`{"openapi":"3.0.0","components":{"schemas":{}}}`))
				case "/openapi/v2":
					_, _ = w.Write([]byte(`{"swagger":"2.0","definitions":{}}`))
				default:
					t.Errorf("unexpected schema request: %s", r.URL.Path)
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			defer server.Close()
			d, _ := discovery.NewDiscoveryClientForConfig(&rest.Config{Host: server.URL})
			m := &ClientManager{watchers: map[string]*contextWatcher{"ctx": {disco: d}}}
			body, err := m.ManifestSchema(context.Background(), "ctx", "v1")
			if err != nil {
				t.Fatal(err)
			}
			if v3 && !strings.Contains(body, "components") {
				t.Fatal("v3 schema missing")
			}
			if !v3 && !strings.Contains(body, "definitions") {
				t.Fatal("v2 fallback missing")
			}
			count := len(requests)
			if _, err := m.ManifestSchema(context.Background(), "ctx", "../../secrets"); err == nil {
				t.Fatal("invalid apiVersion accepted")
			}
			if len(requests) != count {
				t.Fatal("invalid apiVersion caused a network request")
			}
		})
	}
}
