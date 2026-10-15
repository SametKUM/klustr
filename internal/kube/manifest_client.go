package kube

import (
	"context"
	"slices"
	"strings"
	"sync"

	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

type manifestWarningKey struct{}
type manifestWarnings struct {
	mu       sync.Mutex
	messages []string
}
type manifestWarningHandler struct{}

func (manifestWarningHandler) HandleWarningHeaderWithContext(ctx context.Context, code int, _ string, message string) {
	if code != 299 {
		return
	}
	warnings, ok := ctx.Value(manifestWarningKey{}).(*manifestWarnings)
	if !ok {
		return
	}
	// Admission warnings are arbitrary text and can echo Secret values. Keep
	// them out of client-go's default logger as well as progress payloads.
	summary := "The API server returned an admission warning. Review the resource's admission and security requirements."
	if strings.Contains(message, "deprecated") {
		summary = "This API version is deprecated. Use a newer served version when possible."
	}
	warnings.mu.Lock()
	if !slices.Contains(warnings.messages, summary) {
		warnings.messages = append(warnings.messages, summary)
	}
	warnings.mu.Unlock()
}

func (m *ClientManager) manifestClients(contextName string) (dynamic.Interface, discovery.DiscoveryInterface, error) {
	if m.manifests.clients != nil {
		return m.manifests.clients(contextName)
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return nil, nil, err
	}
	// The cloned REST client shares client-go's transport cache, but owns its
	// warning handler so manifest content cannot escape through global logging.
	cfg.WarningHandlerWithContext = manifestWarningHandler{}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, nil, err
	}
	discoveryConfig := rest.CopyConfig(cfg)
	discoveryConfig.Timeout = discoveryTimeout
	disco, err := discovery.NewDiscoveryClientForConfig(discoveryConfig)
	return dyn, disco, err
}

func manifestWarningContext(ctx context.Context) (context.Context, *manifestWarnings) {
	warnings := &manifestWarnings{messages: []string{}}
	return context.WithValue(ctx, manifestWarningKey{}, warnings), warnings
}
