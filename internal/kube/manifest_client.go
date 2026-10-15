package kube

import (
	"context"
	"strings"
	"sync"

	"k8s.io/client-go/dynamic"
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
	warnings.messages = append(warnings.messages, summary)
	warnings.mu.Unlock()
}

func (m *ClientManager) manifestDynamicClient(contextName string) (dynamic.Interface, error) {
	if m.manifests.client != nil {
		return m.manifests.client(contextName)
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return nil, err
	}
	// The cloned REST client shares client-go's transport cache, but owns its
	// warning handler so manifest content cannot escape through global logging.
	cfg.WarningHandlerWithContext = manifestWarningHandler{}
	return dynamic.NewForConfig(cfg)
}

func manifestWarningContext(ctx context.Context) (context.Context, *manifestWarnings) {
	warnings := &manifestWarnings{messages: []string{}}
	return context.WithValue(ctx, manifestWarningKey{}, warnings), warnings
}
