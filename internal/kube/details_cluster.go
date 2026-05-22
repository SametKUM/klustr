package kube

import (
	"sort"
	"time"

	corev1 "k8s.io/api/core/v1"
)

type NodeTaintDetail struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Effect string `json:"effect"`
}

type NodeDetail struct {
	Name             string            `json:"name"`
	UID              string            `json:"uid"`
	Status           string            `json:"status"`
	Roles            string            `json:"roles"`
	Version          string            `json:"version"`
	OSImage          string            `json:"osImage"`
	KernelVersion    string            `json:"kernelVersion"`
	ContainerRuntime string            `json:"containerRuntime"`
	Architecture     string            `json:"architecture"`
	InternalIP       string            `json:"internalIP"`
	Hostname         string            `json:"hostname"`
	Capacity         map[string]string `json:"capacity"`
	Allocatable      map[string]string `json:"allocatable"`
	Taints           []NodeTaintDetail `json:"taints"`
	Labels           map[string]string `json:"labels"`
	Annotations      map[string]string `json:"annotations"`
	Conditions       []ConditionDetail `json:"conditions"`
	CreatedAt        string            `json:"createdAt"`
}

type NamespaceDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Phase       string            `json:"phase"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type LeaseDetail struct {
	Name                 string            `json:"name"`
	Namespace            string            `json:"namespace"`
	UID                  string            `json:"uid"`
	HolderIdentity       string            `json:"holderIdentity"`
	LeaseDurationSeconds int32             `json:"leaseDurationSeconds"`
	AcquireTime          string            `json:"acquireTime"`
	RenewTime            string            `json:"renewTime"`
	LeaseTransitions     int32             `json:"leaseTransitions"`
	Labels               map[string]string `json:"labels"`
	Annotations          map[string]string `json:"annotations"`
	CreatedAt            string            `json:"createdAt"`
}

type RuntimeClassDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Handler     string            `json:"handler"`
	Overhead    map[string]string `json:"overhead"`
	Scheduling  string            `json:"scheduling"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type PriorityClassDetail struct {
	Name             string            `json:"name"`
	UID              string            `json:"uid"`
	Value            int32             `json:"value"`
	GlobalDefault    bool              `json:"globalDefault"`
	Description      string            `json:"description"`
	PreemptionPolicy string            `json:"preemptionPolicy"`
	Labels           map[string]string `json:"labels"`
	Annotations      map[string]string `json:"annotations"`
	CreatedAt        string            `json:"createdAt"`
}

type IngressClassDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Controller  string            `json:"controller"`
	IsDefault   bool              `json:"isDefault"`
	Parameters  string            `json:"parameters"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type LimitRangeItem struct {
	Type                 string            `json:"type"`
	Max                  map[string]string `json:"max"`
	Min                  map[string]string `json:"min"`
	Default              map[string]string `json:"default"`
	DefaultRequest       map[string]string `json:"defaultRequest"`
	MaxLimitRequestRatio map[string]string `json:"maxLimitRequestRatio"`
}

type LimitRangeDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Limits      []LimitRangeItem  `json:"limits"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type ResourceQuotaEntry struct {
	Resource string `json:"resource"`
	Used     string `json:"used"`
	Hard     string `json:"hard"`
}

type ResourceQuotaDetail struct {
	Name        string               `json:"name"`
	Namespace   string               `json:"namespace"`
	UID         string               `json:"uid"`
	Scopes      []string             `json:"scopes"`
	Entries     []ResourceQuotaEntry `json:"entries"`
	Labels      map[string]string    `json:"labels"`
	Annotations map[string]string    `json:"annotations"`
	CreatedAt   string               `json:"createdAt"`
}

func (w *contextWatcher) Node(name string) (*NodeDetail, error) {
	n, err := w.factory.Core().V1().Nodes().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	capacity := quantitiesToStrings(n.Status.Capacity)
	allocatable := quantitiesToStrings(n.Status.Allocatable)
	taints := make([]NodeTaintDetail, 0, len(n.Spec.Taints))
	for _, t := range n.Spec.Taints {
		taints = append(taints, NodeTaintDetail{Key: t.Key, Value: t.Value, Effect: string(t.Effect)})
	}
	hostname := ""
	for _, a := range n.Status.Addresses {
		if a.Type == corev1.NodeHostName {
			hostname = a.Address
			break
		}
	}
	return &NodeDetail{
		Name:             n.Name,
		UID:              string(n.UID),
		Status:           nodeStatus(n),
		Roles:            nodeRoles(n),
		Version:          n.Status.NodeInfo.KubeletVersion,
		OSImage:          n.Status.NodeInfo.OSImage,
		KernelVersion:    n.Status.NodeInfo.KernelVersion,
		ContainerRuntime: n.Status.NodeInfo.ContainerRuntimeVersion,
		Architecture:     n.Status.NodeInfo.Architecture,
		InternalIP:       nodeInternalIP(n),
		Hostname:         hostname,
		Capacity:         capacity,
		Allocatable:      allocatable,
		Taints:           taints,
		Labels:           n.Labels,
		Annotations:      n.Annotations,
		Conditions:       nodeConditions(n.Status.Conditions),
		CreatedAt:        n.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Namespace(name string) (*NamespaceDetail, error) {
	n, err := w.factory.Core().V1().Namespaces().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	return &NamespaceDetail{
		Name:        n.Name,
		UID:         string(n.UID),
		Phase:       string(n.Status.Phase),
		Labels:      n.Labels,
		Annotations: n.Annotations,
		CreatedAt:   n.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Lease(namespace, name string) (*LeaseDetail, error) {
	l, err := w.factory.Coordination().V1().Leases().Lister().Leases(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	holder := ""
	if l.Spec.HolderIdentity != nil {
		holder = *l.Spec.HolderIdentity
	}
	var dur int32 = 0
	if l.Spec.LeaseDurationSeconds != nil {
		dur = *l.Spec.LeaseDurationSeconds
	}
	acquire := ""
	if l.Spec.AcquireTime != nil {
		acquire = l.Spec.AcquireTime.UTC().Format(time.RFC3339)
	}
	renew := ""
	if l.Spec.RenewTime != nil {
		renew = l.Spec.RenewTime.UTC().Format(time.RFC3339)
	}
	var trans int32 = 0
	if l.Spec.LeaseTransitions != nil {
		trans = *l.Spec.LeaseTransitions
	}
	return &LeaseDetail{
		Name:                 l.Name,
		Namespace:            l.Namespace,
		UID:                  string(l.UID),
		HolderIdentity:       holder,
		LeaseDurationSeconds: dur,
		AcquireTime:          acquire,
		RenewTime:            renew,
		LeaseTransitions:     trans,
		Labels:               l.Labels,
		Annotations:          l.Annotations,
		CreatedAt:            l.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) RuntimeClass(name string) (*RuntimeClassDetail, error) {
	r, err := w.factory.Node().V1().RuntimeClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	overhead := map[string]string{}
	if r.Overhead != nil {
		for k, v := range r.Overhead.PodFixed {
			overhead[string(k)] = v.String()
		}
	}
	sched := ""
	if r.Scheduling != nil && len(r.Scheduling.NodeSelector) > 0 {
		sched = formatNodeSelector(r.Scheduling.NodeSelector)
	}
	return &RuntimeClassDetail{
		Name:        r.Name,
		UID:         string(r.UID),
		Handler:     r.Handler,
		Overhead:    overhead,
		Scheduling:  sched,
		Labels:      r.Labels,
		Annotations: r.Annotations,
		CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) PriorityClass(name string) (*PriorityClassDetail, error) {
	p, err := w.factory.Scheduling().V1().PriorityClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	pp := ""
	if p.PreemptionPolicy != nil {
		pp = string(*p.PreemptionPolicy)
	}
	return &PriorityClassDetail{
		Name:             p.Name,
		UID:              string(p.UID),
		Value:            p.Value,
		GlobalDefault:    p.GlobalDefault,
		Description:      p.Description,
		PreemptionPolicy: pp,
		Labels:           p.Labels,
		Annotations:      p.Annotations,
		CreatedAt:        p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) IngressClass(name string) (*IngressClassDetail, error) {
	c, err := w.factory.Networking().V1().IngressClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	params := ""
	if c.Spec.Parameters != nil {
		params = c.Spec.Parameters.Kind + "/" + c.Spec.Parameters.Name
	}
	return &IngressClassDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Controller:  c.Spec.Controller,
		IsDefault:   c.Annotations["ingressclass.kubernetes.io/is-default-class"] == "true",
		Parameters:  params,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) LimitRange(namespace, name string) (*LimitRangeDetail, error) {
	l, err := w.factory.Core().V1().LimitRanges().Lister().LimitRanges(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	items := make([]LimitRangeItem, 0, len(l.Spec.Limits))
	for _, li := range l.Spec.Limits {
		items = append(items, LimitRangeItem{
			Type:                 string(li.Type),
			Max:                  quantitiesToStrings(li.Max),
			Min:                  quantitiesToStrings(li.Min),
			Default:              quantitiesToStrings(li.Default),
			DefaultRequest:       quantitiesToStrings(li.DefaultRequest),
			MaxLimitRequestRatio: quantitiesToStrings(li.MaxLimitRequestRatio),
		})
	}
	return &LimitRangeDetail{
		Name:        l.Name,
		Namespace:   l.Namespace,
		UID:         string(l.UID),
		Limits:      items,
		Labels:      l.Labels,
		Annotations: l.Annotations,
		CreatedAt:   l.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ResourceQuota(namespace, name string) (*ResourceQuotaDetail, error) {
	q, err := w.factory.Core().V1().ResourceQuotas().Lister().ResourceQuotas(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	scopes := make([]string, 0, len(q.Spec.Scopes))
	for _, s := range q.Spec.Scopes {
		scopes = append(scopes, string(s))
	}
	keys := make([]string, 0, len(q.Status.Hard))
	for k := range q.Status.Hard {
		keys = append(keys, string(k))
	}
	sort.Strings(keys)
	entries := make([]ResourceQuotaEntry, 0, len(keys))
	for _, k := range keys {
		used := ""
		if u, ok := q.Status.Used[corev1.ResourceName(k)]; ok {
			used = u.String()
		}
		hard := ""
		if h, ok := q.Status.Hard[corev1.ResourceName(k)]; ok {
			hard = h.String()
		}
		entries = append(entries, ResourceQuotaEntry{Resource: k, Used: used, Hard: hard})
	}
	return &ResourceQuotaDetail{
		Name:        q.Name,
		Namespace:   q.Namespace,
		UID:         string(q.UID),
		Scopes:      scopes,
		Entries:     entries,
		Labels:      q.Labels,
		Annotations: q.Annotations,
		CreatedAt:   q.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}
