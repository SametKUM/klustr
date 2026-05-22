package kube

import "fmt"

func (m *ClientManager) Gateways(contextName, namespace string) []GatewayInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []GatewayInfo{}
	}
	return w.Gateways(namespace)
}

func (m *ClientManager) Gateway(contextName, namespace, name string) (*GatewayDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Gateway(namespace, name)
}

func (m *ClientManager) HTTPRoutes(contextName, namespace string) []HTTPRouteInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []HTTPRouteInfo{}
	}
	return w.HTTPRoutes(namespace)
}

func (m *ClientManager) HTTPRoute(contextName, namespace, name string) (*HTTPRouteDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.HTTPRoute(namespace, name)
}

func (m *ClientManager) GRPCRoutes(contextName, namespace string) []GRPCRouteInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []GRPCRouteInfo{}
	}
	return w.GRPCRoutes(namespace)
}

func (m *ClientManager) GRPCRoute(contextName, namespace, name string) (*GRPCRouteDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.GRPCRoute(namespace, name)
}

func (m *ClientManager) GatewayClasses(contextName string) []GatewayClassInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []GatewayClassInfo{}
	}
	return w.GatewayClasses()
}

func (m *ClientManager) GatewayClass(contextName, name string) (*GatewayClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.GatewayClass(name)
}

func (m *ClientManager) ReferenceGrants(contextName, namespace string) []ReferenceGrantInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ReferenceGrantInfo{}
	}
	return w.ReferenceGrants(namespace)
}

func (m *ClientManager) ReferenceGrant(contextName, namespace, name string) (*ReferenceGrantDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ReferenceGrant(namespace, name)
}
