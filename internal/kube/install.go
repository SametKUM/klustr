package kube

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const metricsServerManifestURL = "https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml"

const (
	MetricsServerManagedByLabel = "klustr/managed-by"
	MetricsServerManagedByValue = "metrics-server-installer"
)

// IsMetricsServerKlustrManaged returns true if a metrics-server Deployment
// exists in kube-system AND carries the Klustr management label. Anything
// installed via Helm, Argo, kubectl or a cloud provider is treated as not
// Klustr-managed so we don't offer to uninstall it.
func (m *ClientManager) IsMetricsServerKlustrManaged(ctx context.Context, contextName string) (bool, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return false, err
	}
	dep, err := cs.AppsV1().Deployments("kube-system").Get(ctx, "metrics-server", metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	// Only the installer's label proves the install is ours; anything looser
	// would offer to uninstall a Helm/cloud metrics-server the user merely
	// scaled through Klustr.
	return metricsServerKlustrManaged(dep.Labels), nil
}

// metricsServerKlustrManaged reports whether the klustr/managed-by installer
// label is present. It deliberately ignores managedFields: the "klustr"
// FieldManager is written by any Klustr mutation, not just the install.
func metricsServerKlustrManaged(labels map[string]string) bool {
	return labels[MetricsServerManagedByLabel] == MetricsServerManagedByValue
}

// kubeletInsecureProviders lists node providerID prefixes that ship a
// self-signed kubelet serving certificate the apiserver cannot verify, so
// metrics-server needs the --kubelet-insecure-tls flag to work.
var kubeletInsecureProviders = []string{"kind://", "minikube://"}

// RecommendInsecureKubeletTLS guesses whether metrics-server needs
// `--kubelet-insecure-tls`: a TLS verification error on the apiserver → kubelet
// proxy path (metrics-server's own route) says yes, with kind/minikube
// providerIDs as the fallback signal. Callers still let the user choose.
func (m *ClientManager) RecommendInsecureKubeletTLS(ctx context.Context, contextName string) (bool, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return false, err
	}
	nodes, err := cs.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return false, err
	}
	if len(nodes.Items) == 0 {
		return false, nil
	}

	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	probeErr := cs.CoreV1().RESTClient().Get().
		Resource("nodes").
		Name(nodes.Items[0].Name).
		SubResource("proxy", "healthz").
		Do(probeCtx).Error()
	if probeErr != nil {
		msg := strings.ToLower(probeErr.Error())
		if strings.Contains(msg, "x509") ||
			strings.Contains(msg, "certificate signed by unknown authority") ||
			strings.Contains(msg, "tls: ") ||
			strings.Contains(msg, "tls handshake") {
			return true, nil
		}
	}

	for i := range nodes.Items {
		pid := nodes.Items[i].Spec.ProviderID
		for _, prefix := range kubeletInsecureProviders {
			if strings.HasPrefix(pid, prefix) {
				return true, nil
			}
		}
	}
	return false, nil
}

func FetchMetricsServerManifest(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, metricsServerManifestURL, nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("download manifest: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("download manifest: HTTP %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read manifest: %w", err)
	}
	return string(body), nil
}
