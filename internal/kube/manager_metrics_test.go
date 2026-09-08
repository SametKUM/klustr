package kube

import (
	"context"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
)

func TestCredentialRefreshInvalidatesMetricsForOnlyItsContext(t *testing.T) {
	for _, tc := range []struct {
		name   string
		appCtx context.Context
	}{
		{name: "before watch startup"},
		{name: "after watch startup", appCtx: context.Background()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			config := clientcmdapi.Config{
				Clusters: map[string]*clientcmdapi.Cluster{
					"cluster": {Server: "https://metrics.example.invalid"},
				},
				Contexts: map[string]*clientcmdapi.Context{
					"refreshed": {Cluster: "cluster"},
					"other":     {Cluster: "cluster"},
				},
			}
			path := filepath.Join(t.TempDir(), "config")
			if err := clientcmd.WriteToFile(config, path); err != nil {
				t.Fatal(err)
			}
			m := &ClientManager{
				rules:      &clientcmd.ClientConfigLoadingRules{ExplicitPath: path},
				metrics:    newMetricsCache(),
				watchLocks: make(map[string]*sync.Mutex),
				appCtx:     tc.appCtx,
			}
			oldClient, err := m.metricsClient("refreshed")
			if err != nil {
				t.Fatal(err)
			}
			otherClient, err := m.metricsClient("other")
			if err != nil {
				t.Fatal(err)
			}
			now := time.Now()
			list := &metricsv1beta1.PodMetricsList{}
			m.metrics.mu.Lock()
			for _, ctx := range []string{"refreshed", "other"} {
				m.metrics.unavailableUntil[ctx] = now.Add(time.Minute)
				m.metrics.podList[ctx] = cachedPodList{at: now, list: list}
				m.metrics.warnEvents[ctx] = cachedWarnEvents{at: now, limit: 10}
			}

			m.metrics.mu.Unlock()
			m.onCredentialsRefreshed("refreshed")

			m.metrics.mu.Lock()
			if _, ok := m.metrics.client["refreshed"]; ok {
				t.Error("credential refresh retained the old metrics client")
			}
			if _, ok := m.metrics.unavailableUntil["refreshed"]; ok {
				t.Error("credential refresh retained the metrics cooldown")
			}
			if _, ok := m.metrics.podList["refreshed"]; ok {
				t.Error("credential refresh retained cached pod metrics")
			}
			if _, ok := m.metrics.warnEvents["refreshed"]; ok {
				t.Error("credential refresh retained cached warning events")
			}
			if m.metrics.client["other"] != otherClient ||
				m.metrics.unavailableUntil["other"] != now.Add(time.Minute) ||
				m.metrics.podList["other"].list != list ||
				m.metrics.warnEvents["other"].at != now {
				t.Error("credential refresh changed another context's metrics cache")
			}
			m.metrics.mu.Unlock()
			freshClient, err := m.metricsClient("refreshed")
			if err != nil {
				t.Fatal(err)
			}
			if freshClient == oldClient {
				t.Error("next metrics lookup reused the old client")
			}
			reusedClient, err := m.metricsClient("refreshed")
			if err != nil {
				t.Fatal(err)
			}
			if reusedClient != freshClient {
				t.Error("next metrics lookup did not cache the rebuilt client")
			}
		})
	}
}

func TestMetricsExecCredentialHelper(t *testing.T) {
	if os.Getenv("KLUSTR_TEST_METRICS_EXEC") != "1" {
		return
	}
	_ = json.NewEncoder(os.Stdout).Encode(map[string]any{
		"apiVersion": "client.authentication.k8s.io/v1beta1", "kind": "ExecCredential",
		"status": map[string]string{"token": os.Getenv("KLUSTR_TEST_METRICS_TOKEN")},
	})
	os.Exit(0)
}

func TestMetricsClientUsesRefreshedExecCredentials(t *testing.T) {
	auth := make(chan string, 2)
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth <- r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"apiVersion":"metrics.k8s.io/v1beta1","kind":"PodMetricsList","items":[]}`))
	}))
	defer server.Close()
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	config := clientcmdapi.Config{
		Clusters: map[string]*clientcmdapi.Cluster{"cluster": {
			Server:                   server.URL,
			CertificateAuthorityData: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw}),
		}},
		Contexts: map[string]*clientcmdapi.Context{"refreshed": {Cluster: "cluster", AuthInfo: "user"}},
		AuthInfos: map[string]*clientcmdapi.AuthInfo{"user": {Exec: &clientcmdapi.ExecConfig{
			Command: executable, Args: []string{"-test.run=^TestMetricsExecCredentialHelper$"},
			APIVersion: "client.authentication.k8s.io/v1beta1", InteractiveMode: clientcmdapi.NeverExecInteractiveMode,
			Env: []clientcmdapi.ExecEnvVar{{Name: "KLUSTR_TEST_METRICS_EXEC", Value: "1"}},
		}}},
	}
	path := filepath.Join(t.TempDir(), "config")
	if err := clientcmd.WriteToFile(config, path); err != nil {
		t.Fatal(err)
	}
	c := testCredManager(t, &fakeProvider{name: "fake"})
	defer c.stopAll()
	m := &ClientManager{rules: &clientcmd.ClientConfigLoadingRules{ExplicitPath: path}, metrics: newMetricsCache(), creds: c}
	for _, token := range []string{"before-refresh", "after-refresh"} {
		c.mu.Lock()
		c.captured["refreshed"] = CapturedCredentials{env: map[string]string{"KLUSTR_TEST_METRICS_TOKEN": token}}
		c.mu.Unlock()
		if token == "after-refresh" {
			m.onCredentialsRefreshed("refreshed")
		}
		client, err := m.metricsClient("refreshed")
		if err != nil {
			t.Fatal(err)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_, err = client.MetricsV1beta1().PodMetricses("").List(ctx, metav1.ListOptions{})
		cancel()
		if err != nil {
			t.Fatal(err)
		}
		if got := <-auth; got != "Bearer "+token {
			t.Fatalf("request used %q, want refreshed test token", got)
		}
	}
}

func TestCredentialRewatchRetriesOnceThenReportsFailure(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c := testCredManager(t, &fakeProvider{name: "fake"})
		defer c.stopAll()
		m := &ClientManager{
			rules:   &clientcmd.ClientConfigLoadingRules{ExplicitPath: filepath.Join(t.TempDir(), "missing-config")},
			metrics: newMetricsCache(), creds: c, appCtx: context.Background(),
			watchLocks: make(map[string]*sync.Mutex), watchers: map[string]*contextWatcher{"ctx": {}},
		}
		var failures atomic.Int32
		c.setOnEvent(func(status CredentialStatus) {
			if status.Error != "" {
				failures.Add(1)
			}
		})
		m.onCredentialsRefreshed("ctx")
		if failures.Load() != 0 {
			t.Fatal("reported failure before the retry")
		}
		time.Sleep(rewatchRetryDelay)
		synctest.Wait()
		c.mu.Lock()
		message := c.lastErr["ctx"]
		c.mu.Unlock()
		if failures.Load() != 1 || !strings.Contains(message, "reconnect after credential refresh failed") {
			t.Fatalf("failures=%d, error=%q", failures.Load(), message)
		}
		time.Sleep(2 * rewatchRetryDelay)
		synctest.Wait()
		if failures.Load() != 1 {
			t.Fatal("reconnection retried more than once")
		}
	})
}
