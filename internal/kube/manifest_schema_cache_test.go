package kube

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"k8s.io/client-go/discovery"
	"k8s.io/client-go/rest"
)

func TestManifestSchemaSkipsUnservedVersionsAndSharesV2(t *testing.T) {
	for _, v3 := range []bool{false, true} {
		t.Run(fmt.Sprint(v3), func(t *testing.T) {
			var downloads atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				switch r.URL.Path {
				case "/openapi/v3":
					if v3 {
						_, _ = w.Write([]byte(`{"paths":{}}`))
					} else {
						w.WriteHeader(http.StatusNotFound)
					}
				case "/api/v1", "/apis/apps/v1":
					_, _ = w.Write([]byte(`{"kind":"APIResourceList","apiVersion":"v1","resources":[]}`))
				case "/openapi/v2":
					downloads.Add(1)
					_, _ = w.Write([]byte(`{"swagger":"2.0","definitions":{}}`))
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			defer server.Close()
			d, _ := discovery.NewDiscoveryClientForConfig(&rest.Config{Host: server.URL})
			m := &ClientManager{watchers: map[string]*contextWatcher{"ctx": {disco: d}}}
			if _, err := m.ManifestSchema(context.Background(), "ctx", "example.com/v99"); err == nil {
				t.Fatal("unserved version had a schema")
			}
			if downloads.Load() != 0 {
				t.Fatal("unserved version downloaded v2")
			}
			for _, version := range []string{"v1", "apps/v1"} {
				body, err := m.ManifestSchema(context.Background(), "ctx", version)
				if v3 {
					if err == nil {
						t.Fatal("missing v3 path fell back to v2")
					}
				} else if err != nil || !strings.Contains(body, "swagger") {
					t.Fatalf("v2 unavailable: %s %v", body, err)
				}
			}
			if !v3 && downloads.Load() != 1 {
				t.Fatal("group-versions did not share v2")
			}
			m.cancelManifests("ctx")
			if !v3 {
				if _, err := m.ManifestSchema(context.Background(), "ctx", "v1"); err != nil {
					t.Fatal(err)
				}
				if downloads.Load() != 2 {
					t.Fatal("disconnect retained stale schema")
				}
			}
		})
	}
}

func TestManifestSchemaCacheCancellationExpiryAndFailures(t *testing.T) {
	cache := &manifestSchemaCache{}
	started, release := make(chan struct{}), make(chan struct{})
	done := make(chan struct{})
	go func() {
		_, _ = cache.load(context.Background(), "ctx", func() (string, error) { close(started); <-release; return "schema", nil })
		close(done)
	}()
	<-started
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := cache.load(ctx, "ctx", func() (string, error) { t.Error("duplicate download"); return "", nil }); err == nil {
		t.Fatal("waiter ignored cancellation")
	}
	cache.invalidate("ctx")
	close(release)
	<-done
	if len(cache.entries) != 0 {
		t.Fatal("late response repopulated cache")
	}
	calls := 0
	fetch := func() (string, error) {
		calls++
		if calls == 1 {
			return "", fmt.Errorf("unavailable")
		}
		return "schema", nil
	}
	_, _ = cache.load(context.Background(), "ctx", fetch)
	if body, err := cache.load(context.Background(), "ctx", fetch); err != nil || body != "schema" || calls != 2 {
		t.Fatal("failed request poisoned cache")
	}
	cache.entries["ctx"].expires = time.Now().Add(-time.Second)
	_, _ = cache.load(context.Background(), "ctx", fetch)
	if calls != 3 {
		t.Fatal("expired schema reused")
	}
	for i := range 20 {
		_, _ = cache.load(context.Background(), fmt.Sprint(i), fetch)
	}
	if len(cache.entries) > 8 {
		t.Fatal("schema cache is unbounded")
	}
}

func TestManifestScalarKeysUseKubernetesConversionAndRejectCollisions(t *testing.T) {
	for _, key := range []string{"9000", "0x10", "true", "yes"} {
		docs, err := parseManifest(configMapManifest + "  " + key + ": service\n")
		if err != nil {
			t.Fatalf("valid scalar key %s: %v", key, err)
		}
		if docs[0].object.Object["data"] == nil {
			t.Fatal("data lost")
		}
	}
	for _, keys := range []string{"9000: first\n  \"9000\": second", "0x10: first\n  \"16\": second", "true: first\n  \"true\": second", "yes: first\n  \"true\": second"} {
		if _, err := parseManifest(configMapManifest + "  " + keys + "\n"); err == nil {
			t.Fatalf("canonical key collision accepted: %s", keys)
		}
	}
	if _, err := parseManifest(configMapManifest + "  ? [private, key]\n  : value\n"); err == nil || strings.Contains(err.Error(), "private") {
		t.Fatal("complex key accepted or leaked")
	}
}
