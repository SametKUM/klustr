package kube

import "fmt"

func (m *ClientManager) HorizontalPodAutoscalers(contextName, namespace string) []HorizontalPodAutoscalerInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []HorizontalPodAutoscalerInfo{}
	}
	return w.HorizontalPodAutoscalers(namespace)
}

func (m *ClientManager) HorizontalPodAutoscaler(contextName, namespace, name string) (*HorizontalPodAutoscalerDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.HorizontalPodAutoscaler(namespace, name)
}

func (m *ClientManager) PodDisruptionBudgets(contextName, namespace string) []PodDisruptionBudgetInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []PodDisruptionBudgetInfo{}
	}
	return w.PodDisruptionBudgets(namespace)
}

func (m *ClientManager) PodDisruptionBudget(contextName, namespace, name string) (*PodDisruptionBudgetDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PodDisruptionBudget(namespace, name)
}
