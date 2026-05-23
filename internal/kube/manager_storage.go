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

func (m *ClientManager) CSIDrivers(contextName string) []CSIDriverInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []CSIDriverInfo{}
	}
	return w.CSIDrivers()
}

func (m *ClientManager) CSIDriver(contextName, name string) (*CSIDriverDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.CSIDriver(name)
}

func (m *ClientManager) CSINodes(contextName string) []CSINodeInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []CSINodeInfo{}
	}
	return w.CSINodes()
}

func (m *ClientManager) CSINode(contextName, name string) (*CSINodeDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.CSINode(name)
}

func (m *ClientManager) VolumeAttachments(contextName string) []VolumeAttachmentInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []VolumeAttachmentInfo{}
	}
	return w.VolumeAttachments()
}

func (m *ClientManager) VolumeAttachment(contextName, name string) (*VolumeAttachmentDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.VolumeAttachment(name)
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
