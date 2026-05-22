package kube

import "fmt"

func (m *ClientManager) Pods(contextName, namespace string) []PodInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []PodInfo{}
	}
	return w.Pods(namespace)
}

func (m *ClientManager) PodsForOwner(contextName, kind, namespace, name string) ([]PodInfo, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PodsForOwner(kind, namespace, name)
}

func (m *ClientManager) PodLogTargets(contextName, namespace string, selector map[string]string) []PodLogTarget {
	w, ok := m.watcher(contextName)
	if !ok {
		return []PodLogTarget{}
	}
	return w.PodLogTargets(namespace, selector)
}

func (m *ClientManager) Pod(contextName, namespace, name string) (*PodDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Pod(namespace, name)
}
