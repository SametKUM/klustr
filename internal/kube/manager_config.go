package kube

import "fmt"

func (m *ClientManager) ConfigMaps(contextName, namespace string) []ConfigMapInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ConfigMapInfo{}
	}
	return w.ConfigMaps(namespace)
}

func (m *ClientManager) ConfigMap(contextName, namespace, name string) (*ConfigMapDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ConfigMap(namespace, name)
}

func (m *ClientManager) Secrets(contextName, namespace string) []SecretInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []SecretInfo{}
	}
	return w.Secrets(namespace)
}

func (m *ClientManager) Secret(contextName, namespace, name string) (*SecretDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Secret(namespace, name)
}

func (m *ClientManager) SecretValue(contextName, namespace, name, key string) (string, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return "", fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.SecretValue(namespace, name, key)
}
