package kube

import (
	"fmt"
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

type CSIDriverDetail struct {
	Name                 string            `json:"name"`
	UID                  string            `json:"uid"`
	AttachRequired       bool              `json:"attachRequired"`
	PodInfoOnMount       bool              `json:"podInfoOnMount"`
	StorageCapacity      bool              `json:"storageCapacity"`
	RequiresRepublish    bool              `json:"requiresRepublish"`
	SELinuxMount         bool              `json:"seLinuxMount"`
	FSGroupPolicy        string            `json:"fsGroupPolicy"`
	VolumeLifecycleModes []string          `json:"volumeLifecycleModes"`
	TokenRequests        []string          `json:"tokenRequests"`
	Labels               map[string]string `json:"labels"`
	Annotations          map[string]string `json:"annotations"`
	CreatedAt            string            `json:"createdAt"`
}

type CSINodeDriverDetail struct {
	Name          string   `json:"name"`
	NodeID        string   `json:"nodeID"`
	TopologyKeys  []string `json:"topologyKeys"`
	AllocatableMax int32   `json:"allocatableMax"`
}

type CSINodeDetail struct {
	Name        string                `json:"name"`
	UID         string                `json:"uid"`
	Drivers     []CSINodeDriverDetail `json:"drivers"`
	Labels      map[string]string     `json:"labels"`
	Annotations map[string]string     `json:"annotations"`
	CreatedAt   string                `json:"createdAt"`
}

type VolumeAttachmentDetail struct {
	Name           string            `json:"name"`
	UID            string            `json:"uid"`
	Attacher       string            `json:"attacher"`
	Node           string            `json:"node"`
	PV             string            `json:"pv"`
	Attached       bool              `json:"attached"`
	AttachError    string            `json:"attachError"`
	DetachError    string            `json:"detachError"`
	AttachMetadata map[string]string `json:"attachMetadata"`
	Labels         map[string]string `json:"labels"`
	Annotations    map[string]string `json:"annotations"`
	CreatedAt      string            `json:"createdAt"`
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
	f := w.factoryFor("StorageClass")
	if f == nil {
		return nil, errKindNoAccess("StorageClass")
	}
	s, err := f.Storage().V1().StorageClasses().Lister().Get(name)
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
	f := w.factoryFor("PersistentVolume")
	if f == nil {
		return nil, errKindNoAccess("PersistentVolume")
	}
	p, err := f.Core().V1().PersistentVolumes().Lister().Get(name)
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

func (w *contextWatcher) CSIDriver(name string) (*CSIDriverDetail, error) {
	f := w.factoryFor("CSIDriver")
	if f == nil {
		return nil, errKindNoAccess("CSIDriver")
	}
	d, err := f.Storage().V1().CSIDrivers().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	attach := true
	if d.Spec.AttachRequired != nil {
		attach = *d.Spec.AttachRequired
	}
	podInfo := false
	if d.Spec.PodInfoOnMount != nil {
		podInfo = *d.Spec.PodInfoOnMount
	}
	cap := false
	if d.Spec.StorageCapacity != nil {
		cap = *d.Spec.StorageCapacity
	}
	republish := false
	if d.Spec.RequiresRepublish != nil {
		republish = *d.Spec.RequiresRepublish
	}
	selinux := false
	if d.Spec.SELinuxMount != nil {
		selinux = *d.Spec.SELinuxMount
	}
	fsGroup := ""
	if d.Spec.FSGroupPolicy != nil {
		fsGroup = string(*d.Spec.FSGroupPolicy)
	}
	modes := make([]string, 0, len(d.Spec.VolumeLifecycleModes))
	for _, m := range d.Spec.VolumeLifecycleModes {
		modes = append(modes, string(m))
	}
	tokens := make([]string, 0, len(d.Spec.TokenRequests))
	for _, t := range d.Spec.TokenRequests {
		if t.ExpirationSeconds != nil {
			tokens = append(tokens, fmt.Sprintf("%s (exp=%ds)", t.Audience, *t.ExpirationSeconds))
		} else {
			tokens = append(tokens, t.Audience)
		}
	}
	return &CSIDriverDetail{
		Name:                 d.Name,
		UID:                  string(d.UID),
		AttachRequired:       attach,
		PodInfoOnMount:       podInfo,
		StorageCapacity:      cap,
		RequiresRepublish:    republish,
		SELinuxMount:         selinux,
		FSGroupPolicy:        fsGroup,
		VolumeLifecycleModes: modes,
		TokenRequests:        tokens,
		Labels:               d.Labels,
		Annotations:          d.Annotations,
		CreatedAt:            d.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) CSINode(name string) (*CSINodeDetail, error) {
	f := w.factoryFor("CSINode")
	if f == nil {
		return nil, errKindNoAccess("CSINode")
	}
	n, err := f.Storage().V1().CSINodes().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	drivers := make([]CSINodeDriverDetail, 0, len(n.Spec.Drivers))
	for _, dr := range n.Spec.Drivers {
		var maxV int32
		if dr.Allocatable != nil && dr.Allocatable.Count != nil {
			maxV = *dr.Allocatable.Count
		}
		drivers = append(drivers, CSINodeDriverDetail{
			Name:           dr.Name,
			NodeID:         dr.NodeID,
			TopologyKeys:   append([]string{}, dr.TopologyKeys...),
			AllocatableMax: maxV,
		})
	}
	return &CSINodeDetail{
		Name:        n.Name,
		UID:         string(n.UID),
		Drivers:     drivers,
		Labels:      n.Labels,
		Annotations: n.Annotations,
		CreatedAt:   n.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) VolumeAttachment(name string) (*VolumeAttachmentDetail, error) {
	f := w.factoryFor("VolumeAttachment")
	if f == nil {
		return nil, errKindNoAccess("VolumeAttachment")
	}
	a, err := f.Storage().V1().VolumeAttachments().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	pv := ""
	if a.Spec.Source.PersistentVolumeName != nil {
		pv = *a.Spec.Source.PersistentVolumeName
	}
	attachErr := ""
	if a.Status.AttachError != nil {
		attachErr = a.Status.AttachError.Message
	}
	detachErr := ""
	if a.Status.DetachError != nil {
		detachErr = a.Status.DetachError.Message
	}
	return &VolumeAttachmentDetail{
		Name:           a.Name,
		UID:            string(a.UID),
		Attacher:       a.Spec.Attacher,
		Node:           a.Spec.NodeName,
		PV:             pv,
		Attached:       a.Status.Attached,
		AttachError:    attachErr,
		DetachError:    detachErr,
		AttachMetadata: a.Status.AttachmentMetadata,
		Labels:         a.Labels,
		Annotations:    a.Annotations,
		CreatedAt:      a.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) PersistentVolumeClaim(namespace, name string) (*PersistentVolumeClaimDetail, error) {
	f := w.factoryFor("PersistentVolumeClaim")
	if f == nil {
		return nil, errKindNoAccess("PersistentVolumeClaim")
	}
	p, err := f.Core().V1().PersistentVolumeClaims().Lister().PersistentVolumeClaims(namespace).Get(name)
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
