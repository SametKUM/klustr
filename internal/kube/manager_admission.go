package kube

import "fmt"

func (m *ClientManager) ValidatingWebhookConfigurations(contextName string) []WebhookConfigurationInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []WebhookConfigurationInfo{}
	}
	return w.ValidatingWebhookConfigurations()
}

func (m *ClientManager) ValidatingWebhookConfiguration(contextName, name string) (*WebhookConfigurationDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ValidatingWebhookConfiguration(name)
}

func (m *ClientManager) MutatingWebhookConfigurations(contextName string) []WebhookConfigurationInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []WebhookConfigurationInfo{}
	}
	return w.MutatingWebhookConfigurations()
}

func (m *ClientManager) MutatingWebhookConfiguration(contextName, name string) (*WebhookConfigurationDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.MutatingWebhookConfiguration(name)
}
