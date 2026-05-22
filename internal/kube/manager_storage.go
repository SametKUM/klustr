package kube

import "fmt"

func (m *ClientManager) StorageClasses(contextName string) []StorageClassInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []StorageClassInfo{}
	}
	return w.StorageClasses()
}

func (m *ClientManager) StorageClass(contextName, name string) (*StorageClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.StorageClass(name)
}

func (m *ClientManager) PersistentVolumes(contextName string) []PersistentVolumeInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []PersistentVolumeInfo{}
	}
	return w.PersistentVolumes()
}

func (m *ClientManager) PersistentVolume(contextName, name string) (*PersistentVolumeDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PersistentVolume(name)
}

func (m *ClientManager) PersistentVolumeClaims(contextName, namespace string) []PersistentVolumeClaimInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []PersistentVolumeClaimInfo{}
	}
	return w.PersistentVolumeClaims(namespace)
}

func (m *ClientManager) PersistentVolumeClaim(contextName, namespace, name string) (*PersistentVolumeClaimDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PersistentVolumeClaim(namespace, name)
}
