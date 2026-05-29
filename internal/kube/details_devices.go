package kube

import (
	"fmt"
	"strings"
	"time"

	resourcev1 "k8s.io/api/resource/v1"
)

type DeviceSelectorDetail struct {
	Expression string `json:"expression"`
}

type DeviceClassDetail struct {
	Name        string                 `json:"name"`
	UID         string                 `json:"uid"`
	Selectors   []DeviceSelectorDetail `json:"selectors"`
	Config      int                    `json:"config"`
	Labels      map[string]string      `json:"labels"`
	Annotations map[string]string      `json:"annotations"`
	CreatedAt   string                 `json:"createdAt"`
}

type ResourceSliceDeviceDetail struct {
	Name        string   `json:"name"`
	Attributes  []string `json:"attributes"`
	Capacities  []string `json:"capacities"`
	BindsToNode bool     `json:"bindsToNode"`
	Taints      int      `json:"taints"`
}

type ResourceSliceDetail struct {
	Name        string                      `json:"name"`
	UID         string                      `json:"uid"`
	Driver      string                      `json:"driver"`
	PoolName    string                      `json:"poolName"`
	NodeName    string                      `json:"nodeName"`
	AllNodes    bool                        `json:"allNodes"`
	Devices     []ResourceSliceDeviceDetail `json:"devices"`
	Labels      map[string]string           `json:"labels"`
	Annotations map[string]string           `json:"annotations"`
	CreatedAt   string                      `json:"createdAt"`
}

type DeviceRequestDetail struct {
	Name            string   `json:"name"`
	DeviceClassName string   `json:"deviceClassName"`
	AllocationMode  string   `json:"allocationMode"`
	Count           int64    `json:"count"`
	Selectors       []string `json:"selectors"`
	AdminAccess     bool     `json:"adminAccess"`
	FirstAvailable  int      `json:"firstAvailable"`
}

type AllocatedDeviceDetail struct {
	Request string `json:"request"`
	Driver  string `json:"driver"`
	Pool    string `json:"pool"`
	Device  string `json:"device"`
}

type ResourceClaimDetail struct {
	Name             string                  `json:"name"`
	Namespace        string                  `json:"namespace"`
	UID              string                  `json:"uid"`
	Status           string                  `json:"status"`
	Requests         []DeviceRequestDetail   `json:"requests"`
	AllocatedDevices []AllocatedDeviceDetail `json:"allocatedDevices"`
	ReservedFor      []string                `json:"reservedFor"`
	Labels           map[string]string       `json:"labels"`
	Annotations      map[string]string       `json:"annotations"`
	CreatedAt        string                  `json:"createdAt"`
}

type ResourceClaimTemplateDetail struct {
	Name        string                `json:"name"`
	Namespace   string                `json:"namespace"`
	UID         string                `json:"uid"`
	Requests    []DeviceRequestDetail `json:"requests"`
	Labels      map[string]string     `json:"labels"`
	Annotations map[string]string     `json:"annotations"`
	CreatedAt   string                `json:"createdAt"`
}

func selectorsForDevice(sels []resourcev1.DeviceSelector) []DeviceSelectorDetail {
	out := make([]DeviceSelectorDetail, 0, len(sels))
	for _, s := range sels {
		expr := ""
		if s.CEL != nil {
			expr = s.CEL.Expression
		}
		out = append(out, DeviceSelectorDetail{Expression: expr})
	}
	return out
}

func selectorsAsStrings(sels []resourcev1.DeviceSelector) []string {
	out := make([]string, 0, len(sels))
	for _, s := range sels {
		if s.CEL != nil {
			out = append(out, s.CEL.Expression)
		}
	}
	return out
}

func requestsForDeviceClaim(c resourcev1.DeviceClaim) []DeviceRequestDetail {
	out := make([]DeviceRequestDetail, 0, len(c.Requests))
	for _, r := range c.Requests {
		d := DeviceRequestDetail{Name: r.Name}
		if r.Exactly != nil {
			d.DeviceClassName = r.Exactly.DeviceClassName
			d.AllocationMode = string(r.Exactly.AllocationMode)
			d.Count = r.Exactly.Count
			d.Selectors = selectorsAsStrings(r.Exactly.Selectors)
			if r.Exactly.AdminAccess != nil {
				d.AdminAccess = *r.Exactly.AdminAccess
			}
		}
		d.FirstAvailable = len(r.FirstAvailable)
		out = append(out, d)
	}
	return out
}

func (w *contextWatcher) DeviceClass(name string) (*DeviceClassDetail, error) {
	f := w.factoryFor("DeviceClass")
	if f == nil {
		return nil, errKindNoAccess("DeviceClass")
	}
	c, err := f.Resource().V1().DeviceClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	return &DeviceClassDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Selectors:   selectorsForDevice(c.Spec.Selectors),
		Config:      len(c.Spec.Config),
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ResourceSlice(name string) (*ResourceSliceDetail, error) {
	f := w.factoryFor("ResourceSlice")
	if f == nil {
		return nil, errKindNoAccess("ResourceSlice")
	}
	s, err := f.Resource().V1().ResourceSlices().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	node := ""
	if s.Spec.NodeName != nil {
		node = *s.Spec.NodeName
	}
	all := false
	if s.Spec.AllNodes != nil {
		all = *s.Spec.AllNodes
	}
	devices := make([]ResourceSliceDeviceDetail, 0, len(s.Spec.Devices))
	for _, d := range s.Spec.Devices {
		attrs := make([]string, 0, len(d.Attributes))
		for k, v := range d.Attributes {
			val := ""
			switch {
			case v.StringValue != nil:
				val = *v.StringValue
			case v.IntValue != nil:
				val = fmt.Sprintf("%d", *v.IntValue)
			case v.BoolValue != nil:
				val = fmt.Sprintf("%v", *v.BoolValue)
			case v.VersionValue != nil:
				val = *v.VersionValue
			}
			attrs = append(attrs, fmt.Sprintf("%s=%s", string(k), val))
		}
		caps := make([]string, 0, len(d.Capacity))
		for k, v := range d.Capacity {
			caps = append(caps, fmt.Sprintf("%s=%s", string(k), v.Value.String()))
		}
		binds := false
		if d.BindsToNode != nil {
			binds = *d.BindsToNode
		}
		devices = append(devices, ResourceSliceDeviceDetail{
			Name:        d.Name,
			Attributes:  attrs,
			Capacities:  caps,
			BindsToNode: binds,
			Taints:      len(d.Taints),
		})
	}
	return &ResourceSliceDetail{
		Name:        s.Name,
		UID:         string(s.UID),
		Driver:      s.Spec.Driver,
		PoolName:    s.Spec.Pool.Name,
		NodeName:    node,
		AllNodes:    all,
		Devices:     devices,
		Labels:      s.Labels,
		Annotations: s.Annotations,
		CreatedAt:   s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ResourceClaim(namespace, name string) (*ResourceClaimDetail, error) {
	f := w.factoryFor("ResourceClaim")
	if f == nil {
		return nil, errKindNoAccess("ResourceClaim")
	}
	c, err := f.Resource().V1().ResourceClaims().Lister().ResourceClaims(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	allocated := make([]AllocatedDeviceDetail, 0)
	if c.Status.Allocation != nil {
		for _, d := range c.Status.Allocation.Devices.Results {
			allocated = append(allocated, AllocatedDeviceDetail{
				Request: d.Request,
				Driver:  d.Driver,
				Pool:    d.Pool,
				Device:  d.Device,
			})
		}
	}
	reservedFor := make([]string, 0, len(c.Status.ReservedFor))
	for _, r := range c.Status.ReservedFor {
		reservedFor = append(reservedFor, strings.TrimSpace(r.Resource+"/"+r.Name))
	}
	return &ResourceClaimDetail{
		Name:             c.Name,
		Namespace:        c.Namespace,
		UID:              string(c.UID),
		Status:           resourceClaimStatusString(c),
		Requests:         requestsForDeviceClaim(c.Spec.Devices),
		AllocatedDevices: allocated,
		ReservedFor:      reservedFor,
		Labels:           c.Labels,
		Annotations:      c.Annotations,
		CreatedAt:        c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ResourceClaimTemplate(namespace, name string) (*ResourceClaimTemplateDetail, error) {
	f := w.factoryFor("ResourceClaimTemplate")
	if f == nil {
		return nil, errKindNoAccess("ResourceClaimTemplate")
	}
	t, err := f.Resource().V1().ResourceClaimTemplates().Lister().ResourceClaimTemplates(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	return &ResourceClaimTemplateDetail{
		Name:        t.Name,
		Namespace:   t.Namespace,
		UID:         string(t.UID),
		Requests:    requestsForDeviceClaim(t.Spec.Spec.Devices),
		Labels:      t.Labels,
		Annotations: t.Annotations,
		CreatedAt:   t.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}
