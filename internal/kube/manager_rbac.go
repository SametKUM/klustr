package kube

import "fmt"

func (m *ClientManager) ServiceAccounts(contextName, namespace string) []ServiceAccountInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ServiceAccountInfo{}
	}
	return w.ServiceAccounts(namespace)
}

func (m *ClientManager) ServiceAccount(contextName, namespace, name string) (*ServiceAccountDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ServiceAccount(namespace, name)
}

func (m *ClientManager) Roles(contextName, namespace string) []RoleInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []RoleInfo{}
	}
	return w.Roles(namespace)
}

func (m *ClientManager) Role(contextName, namespace, name string) (*RoleDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Role(namespace, name)
}

func (m *ClientManager) RoleBindings(contextName, namespace string) []RoleBindingInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []RoleBindingInfo{}
	}
	return w.RoleBindings(namespace)
}

func (m *ClientManager) RoleBinding(contextName, namespace, name string) (*RoleBindingDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.RoleBinding(namespace, name)
}

func (m *ClientManager) ClusterRoles(contextName string) []ClusterRoleInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ClusterRoleInfo{}
	}
	return w.ClusterRoles()
}

func (m *ClientManager) ClusterRole(contextName, name string) (*ClusterRoleDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ClusterRole(name)
}

func (m *ClientManager) ClusterRoleBindings(contextName string) []ClusterRoleBindingInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ClusterRoleBindingInfo{}
	}
	return w.ClusterRoleBindings()
}

func (m *ClientManager) ClusterRoleBinding(contextName, name string) (*ClusterRoleBindingDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ClusterRoleBinding(name)
}
