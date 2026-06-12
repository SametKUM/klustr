package kube

import "fmt"

func (m *ClientManager) DeviceClasses(contextName string) []DeviceClassInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []DeviceClassInfo{}
	}
	return w.DeviceClasses()
}

func (m *ClientManager) DeviceClass(contextName, name string) (*DeviceClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.DeviceClass(name)
}

func (m *ClientManager) ResourceSlices(contextName string) []ResourceSliceInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ResourceSliceInfo{}
	}
	return w.ResourceSlices()
}

func (m *ClientManager) ResourceSlice(contextName, name string) (*ResourceSliceDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ResourceSlice(name)
}

func (m *ClientManager) ResourceClaims(contextName, namespace string) []ResourceClaimInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ResourceClaimInfo{}
	}
	return listAcrossNamespaces(namespace, w.ResourceClaims)
}

func (m *ClientManager) ResourceClaim(contextName, namespace, name string) (*ResourceClaimDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ResourceClaim(namespace, name)
}

func (m *ClientManager) ResourceClaimTemplates(contextName, namespace string) []ResourceClaimTemplateInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ResourceClaimTemplateInfo{}
	}
	return listAcrossNamespaces(namespace, w.ResourceClaimTemplates)
}

func (m *ClientManager) ResourceClaimTemplate(contextName, namespace, name string) (*ResourceClaimTemplateDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ResourceClaimTemplate(namespace, name)
}
