package kube

import (
	"time"

	corev1 "k8s.io/api/core/v1"
)

type StorageClassDetail struct {
	Name              string            `json:"name"`
	UID               string            `json:"uid"`
	Provisioner       string            `json:"provisioner"`
	ReclaimPolicy     string            `json:"reclaimPolicy"`
	VolumeBindingMode string            `json:"volumeBindingMode"`
	AllowExpansion    bool              `json:"allowExpansion"`
	IsDefault         bool              `json:"isDefault"`
	Parameters        map[string]string `json:"parameters"`
	MountOptions      []string          `json:"mountOptions"`
	Labels            map[string]string `json:"labels"`
	Annotations       map[string]string `json:"annotations"`
	CreatedAt         string            `json:"createdAt"`
}

type PersistentVolumeDetail struct {
	Name          string            `json:"name"`
	UID           string            `json:"uid"`
	Status        string            `json:"status"`
	Capacity      string            `json:"capacity"`
	AccessModes   []string          `json:"accessModes"`
	ReclaimPolicy string            `json:"reclaimPolicy"`
	StorageClass  string            `json:"storageClass"`
	VolumeMode    string            `json:"volumeMode"`
	Claim         string            `json:"claim"`
	Source        string            `json:"source"`
	Message       string            `json:"message"`
	Reason        string            `json:"reason"`
	Labels        map[string]string `json:"labels"`
	Annotations   map[string]string `json:"annotations"`
	CreatedAt     string            `json:"createdAt"`
}

type PersistentVolumeClaimDetail struct {
	Name         string            `json:"name"`
	Namespace    string            `json:"namespace"`
	UID          string            `json:"uid"`
	Status       string            `json:"status"`
	Volume       string            `json:"volume"`
	StorageClass string            `json:"storageClass"`
	VolumeMode   string            `json:"volumeMode"`
	AccessModes  []string          `json:"accessModes"`
	Capacity     string            `json:"capacity"`
	Request      string            `json:"request"`
	Selector     map[string]string `json:"selector"`
	Conditions   []ConditionDetail `json:"conditions"`
	Labels       map[string]string `json:"labels"`
	Annotations  map[string]string `json:"annotations"`
	CreatedAt    string            `json:"createdAt"`
}

func (w *contextWatcher) StorageClass(name string) (*StorageClassDetail, error) {
	s, err := w.factory.Storage().V1().StorageClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	mode := ""
	if s.VolumeBindingMode != nil {
		mode = string(*s.VolumeBindingMode)
	}
	reclaim := ""
	if s.ReclaimPolicy != nil {
		reclaim = string(*s.ReclaimPolicy)
	}
	allow := false
	if s.AllowVolumeExpansion != nil {
		allow = *s.AllowVolumeExpansion
	}
	return &StorageClassDetail{
		Name:              s.Name,
		UID:               string(s.UID),
		Provisioner:       s.Provisioner,
		ReclaimPolicy:     reclaim,
		VolumeBindingMode: mode,
		AllowExpansion:    allow,
		IsDefault:         s.Annotations["storageclass.kubernetes.io/is-default-class"] == "true",
		Parameters:        s.Parameters,
		MountOptions:      append([]string(nil), s.MountOptions...),
		Labels:            s.Labels,
		Annotations:       s.Annotations,
		CreatedAt:         s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) PersistentVolume(name string) (*PersistentVolumeDetail, error) {
	p, err := w.factory.Core().V1().PersistentVolumes().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	modes := make([]string, 0, len(p.Spec.AccessModes))
	for _, m := range p.Spec.AccessModes {
		modes = append(modes, string(m))
	}
	cap := ""
	if q, ok := p.Spec.Capacity[corev1.ResourceStorage]; ok {
		cap = q.String()
	}
	vm := ""
	if p.Spec.VolumeMode != nil {
		vm = string(*p.Spec.VolumeMode)
	}
	claim := ""
	if p.Spec.ClaimRef != nil {
		claim = p.Spec.ClaimRef.Namespace + "/" + p.Spec.ClaimRef.Name
	}
	return &PersistentVolumeDetail{
		Name:          p.Name,
		UID:           string(p.UID),
		Status:        string(p.Status.Phase),
		Capacity:      cap,
		AccessModes:   modes,
		ReclaimPolicy: string(p.Spec.PersistentVolumeReclaimPolicy),
		StorageClass:  p.Spec.StorageClassName,
		VolumeMode:    vm,
		Claim:         claim,
		Source:        pvSource(p),
		Message:       p.Status.Message,
		Reason:        p.Status.Reason,
		Labels:        p.Labels,
		Annotations:   p.Annotations,
		CreatedAt:     p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func pvSource(p *corev1.PersistentVolume) string {
	s := p.Spec.PersistentVolumeSource
	switch {
	case s.HostPath != nil:
		return "HostPath:" + s.HostPath.Path
	case s.NFS != nil:
		return "NFS:" + s.NFS.Server + ":" + s.NFS.Path
	case s.CSI != nil:
		return "CSI:" + s.CSI.Driver
	case s.Local != nil:
		return "Local:" + s.Local.Path
	}
	return ""
}

func (w *contextWatcher) PersistentVolumeClaim(namespace, name string) (*PersistentVolumeClaimDetail, error) {
	p, err := w.factory.Core().V1().PersistentVolumeClaims().Lister().PersistentVolumeClaims(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	modes := make([]string, 0, len(p.Spec.AccessModes))
	for _, m := range p.Spec.AccessModes {
		modes = append(modes, string(m))
	}
	cap := ""
	if q, ok := p.Status.Capacity[corev1.ResourceStorage]; ok {
		cap = q.String()
	}
	req := ""
	if q, ok := p.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
		req = q.String()
	}
	sc := ""
	if p.Spec.StorageClassName != nil {
		sc = *p.Spec.StorageClassName
	}
	vm := ""
	if p.Spec.VolumeMode != nil {
		vm = string(*p.Spec.VolumeMode)
	}
	conds := make([]ConditionDetail, 0, len(p.Status.Conditions))
	for _, c := range p.Status.Conditions {
		conds = append(conds, ConditionDetail{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return &PersistentVolumeClaimDetail{
		Name:         p.Name,
		Namespace:    p.Namespace,
		UID:          string(p.UID),
		Status:       string(p.Status.Phase),
		Volume:       p.Spec.VolumeName,
		StorageClass: sc,
		VolumeMode:   vm,
		AccessModes:  modes,
		Capacity:     cap,
		Request:      req,
		Selector:     matchLabels(p.Spec.Selector),
		Conditions:   conds,
		Labels:       p.Labels,
		Annotations:  p.Annotations,
		CreatedAt:    p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}
