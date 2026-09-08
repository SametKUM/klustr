package kube

import (
	"context"
	"path/filepath"
	"sync"
	"testing"
	"time"

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
			for _, ctx := range []string{"refreshed", "other"} {
				m.metrics.unavailableUntil[ctx] = now.Add(time.Minute)
				m.metrics.podList[ctx] = cachedPodList{at: now, list: list}
				m.metrics.warnEvents[ctx] = cachedWarnEvents{at: now, limit: 10}
			}

			m.onCredentialsRefreshed("refreshed")

			if _, ok := m.metrics.client["refreshed"]; ok {
				t.Fatal("credential refresh retained the old metrics client")
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
