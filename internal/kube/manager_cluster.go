package kube

import "fmt"

func (m *ClientManager) Namespaces(contextName string) []NamespaceInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []NamespaceInfo{}
	}
	return w.Namespaces()
}

func (m *ClientManager) Namespace(contextName, name string) (*NamespaceDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Namespace(name)
}

func (m *ClientManager) Nodes(contextName string) []NodeInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []NodeInfo{}
	}
	return w.Nodes()
}

func (m *ClientManager) Node(contextName, name string) (*NodeDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Node(name)
}

func (m *ClientManager) Leases(contextName, namespace string) []LeaseInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []LeaseInfo{}
	}
	return w.Leases(namespace)
}

func (m *ClientManager) Lease(contextName, namespace, name string) (*LeaseDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Lease(namespace, name)
}

func (m *ClientManager) RuntimeClasses(contextName string) []RuntimeClassInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []RuntimeClassInfo{}
	}
	return w.RuntimeClasses()
}

func (m *ClientManager) RuntimeClass(contextName, name string) (*RuntimeClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.RuntimeClass(name)
}

func (m *ClientManager) PriorityClasses(contextName string) []PriorityClassInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []PriorityClassInfo{}
	}
	return w.PriorityClasses()
}

func (m *ClientManager) PriorityClass(contextName, name string) (*PriorityClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PriorityClass(name)
}

func (m *ClientManager) IngressClasses(contextName string) []IngressClassInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []IngressClassInfo{}
	}
	return w.IngressClasses()
}

func (m *ClientManager) IngressClass(contextName, name string) (*IngressClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.IngressClass(name)
}

func (m *ClientManager) LimitRanges(contextName, namespace string) []LimitRangeInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []LimitRangeInfo{}
	}
	return w.LimitRanges(namespace)
}

func (m *ClientManager) LimitRange(contextName, namespace, name string) (*LimitRangeDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.LimitRange(namespace, name)
}

func (m *ClientManager) ResourceQuotas(contextName, namespace string) []ResourceQuotaInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ResourceQuotaInfo{}
	}
	return w.ResourceQuotas(namespace)
}

func (m *ClientManager) ResourceQuota(contextName, namespace, name string) (*ResourceQuotaDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ResourceQuota(namespace, name)
}
