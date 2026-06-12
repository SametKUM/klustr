package kube

import "fmt"

func (m *ClientManager) Services(contextName, namespace string) []ServiceInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ServiceInfo{}
	}
	return listAcrossNamespaces(namespace, w.Services)
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
	return listAcrossNamespaces(namespace, w.ListEndpoints)
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
	return listAcrossNamespaces(namespace, w.EndpointSlices)
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
	return listAcrossNamespaces(namespace, w.Ingresses)
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
	return listAcrossNamespaces(namespace, w.NetworkPolicies)
}

func (m *ClientManager) NetworkPolicy(contextName, namespace, name string) (*NetworkPolicyDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.NetworkPolicy(namespace, name)
}

func (m *ClientManager) ServiceCIDRs(contextName string) []ServiceCIDRInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ServiceCIDRInfo{}
	}
	return w.ServiceCIDRs()
}

func (m *ClientManager) ServiceCIDR(contextName, name string) (*ServiceCIDRDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ServiceCIDR(name)
}

func (m *ClientManager) IPAddresses(contextName string) []IPAddressInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []IPAddressInfo{}
	}
	return w.IPAddresses()
}

func (m *ClientManager) IPAddress(contextName, name string) (*IPAddressDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.IPAddress(name)
}
