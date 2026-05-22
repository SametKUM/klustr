package kube

import "fmt"

func (m *ClientManager) Services(contextName, namespace string) []ServiceInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ServiceInfo{}
	}
	return w.Services(namespace)
}

func (m *ClientManager) Service(contextName, namespace, name string) (*ServiceDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Service(namespace, name)
}

func (m *ClientManager) EndpointsList(contextName, namespace string) []EndpointsInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []EndpointsInfo{}
	}
	return w.ListEndpoints(namespace)
}

func (m *ClientManager) Endpoints(contextName, namespace, name string) (*EndpointsDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Endpoints(namespace, name)
}

func (m *ClientManager) EndpointSlices(contextName, namespace string) []EndpointSliceInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []EndpointSliceInfo{}
	}
	return w.EndpointSlices(namespace)
}

func (m *ClientManager) EndpointSlice(contextName, namespace, name string) (*EndpointSliceDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.EndpointSlice(namespace, name)
}

func (m *ClientManager) Ingresses(contextName, namespace string) []IngressInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []IngressInfo{}
	}
	return w.Ingresses(namespace)
}

func (m *ClientManager) Ingress(contextName, namespace, name string) (*IngressDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Ingress(namespace, name)
}

func (m *ClientManager) NetworkPolicies(contextName, namespace string) []NetworkPolicyInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []NetworkPolicyInfo{}
	}
	return w.NetworkPolicies(namespace)
}

func (m *ClientManager) NetworkPolicy(contextName, namespace, name string) (*NetworkPolicyDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.NetworkPolicy(namespace, name)
}
