package kube

import (
	"sort"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type StorageClassInfo struct {
	Name              string `json:"name"`
	Provisioner       string `json:"provisioner"`
	ReclaimPolicy     string `json:"reclaimPolicy"`
	VolumeBindingMode string `json:"volumeBindingMode"`
	AllowExpansion    bool   `json:"allowExpansion"`
	IsDefault         bool   `json:"isDefault"`
	CreatedAt         string `json:"createdAt"`
}

type PersistentVolumeInfo struct {
	Name          string `json:"name"`
	Capacity      string `json:"capacity"`
	AccessModes   string `json:"accessModes"`
	ReclaimPolicy string `json:"reclaimPolicy"`
	Status        string `json:"status"`
	Claim         string `json:"claim"`
	StorageClass  string `json:"storageClass"`
	CreatedAt     string `json:"createdAt"`
}

type PersistentVolumeClaimInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Status       string `json:"status"`
	Volume       string `json:"volume"`
	Capacity     string `json:"capacity"`
	AccessModes  string `json:"accessModes"`
	StorageClass string `json:"storageClass"`
	CreatedAt    string `json:"createdAt"`
}

func (w *contextWatcher) StorageClasses() []StorageClassInfo {
	f := w.factoryFor("StorageClass")
	if f == nil {
		return []StorageClassInfo{}
	}
	scs, err := f.Storage().V1().StorageClasses().Lister().List(labels.Everything())
	if err != nil {
		return []StorageClassInfo{}
	}
	out := make([]StorageClassInfo, 0, len(scs))
	for _, s := range scs {
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
		isDefault := s.Annotations["storageclass.kubernetes.io/is-default-class"] == "true"
		out = append(out, StorageClassInfo{
			Name:              s.Name,
			Provisioner:       s.Provisioner,
			ReclaimPolicy:     reclaim,
			VolumeBindingMode: mode,
			AllowExpansion:    allow,
			IsDefault:         isDefault,
			CreatedAt:         s.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) PersistentVolumes() []PersistentVolumeInfo {
	f := w.factoryFor("PersistentVolume")
	if f == nil {
		return []PersistentVolumeInfo{}
	}
	pvs, err := f.Core().V1().PersistentVolumes().Lister().List(labels.Everything())
	if err != nil {
		return []PersistentVolumeInfo{}
	}
	out := make([]PersistentVolumeInfo, 0, len(pvs))
	for _, p := range pvs {
		cap := ""
		if q, ok := p.Spec.Capacity[corev1.ResourceStorage]; ok {
			cap = q.String()
		}
		modes := make([]string, 0, len(p.Spec.AccessModes))
		for _, m := range p.Spec.AccessModes {
			modes = append(modes, string(m))
		}
		claim := ""
		if p.Spec.ClaimRef != nil {
			claim = p.Spec.ClaimRef.Namespace + "/" + p.Spec.ClaimRef.Name
		}
		out = append(out, PersistentVolumeInfo{
			Name:          p.Name,
			Capacity:      cap,
			AccessModes:   strings.Join(modes, ","),
			ReclaimPolicy: string(p.Spec.PersistentVolumeReclaimPolicy),
			Status:        string(p.Status.Phase),
			Claim:         claim,
			StorageClass:  p.Spec.StorageClassName,
			CreatedAt:     p.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) PersistentVolumeClaims(namespace string) []PersistentVolumeClaimInfo {
	f := w.factoryFor("PersistentVolumeClaim")
	if f == nil {
		return []PersistentVolumeClaimInfo{}
	}
	lister := f.Core().V1().PersistentVolumeClaims().Lister()
	var (
		pvcs []*corev1.PersistentVolumeClaim
		err  error
	)
	if namespace == "" {
		pvcs, err = lister.List(labels.Everything())
	} else {
		pvcs, err = lister.PersistentVolumeClaims(namespace).List(labels.Everything())
	}
	if err != nil {
		return []PersistentVolumeClaimInfo{}
	}
	out := make([]PersistentVolumeClaimInfo, 0, len(pvcs))
	for _, p := range pvcs {
		cap := ""
		if q, ok := p.Status.Capacity[corev1.ResourceStorage]; ok {
			cap = q.String()
		} else if q, ok := p.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
			cap = q.String()
		}
		modes := make([]string, 0, len(p.Spec.AccessModes))
		for _, m := range p.Spec.AccessModes {
			modes = append(modes, string(m))
		}
		sc := ""
		if p.Spec.StorageClassName != nil {
			sc = *p.Spec.StorageClassName
		}
		out = append(out, PersistentVolumeClaimInfo{
			Name:         p.Name,
			Namespace:    p.Namespace,
			Status:       string(p.Status.Phase),
			Volume:       p.Spec.VolumeName,
			Capacity:     cap,
			AccessModes:  strings.Join(modes, ","),
			StorageClass: sc,
			CreatedAt:    p.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}
