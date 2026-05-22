package kube

import (
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
)

type ServicePortDetail struct {
	Name       string `json:"name"`
	Protocol   string `json:"protocol"`
	Port       int32  `json:"port"`
	TargetPort string `json:"targetPort"`
	NodePort   int32  `json:"nodePort"`
}

type ServiceDetail struct {
	Name            string              `json:"name"`
	Namespace       string              `json:"namespace"`
	UID             string              `json:"uid"`
	Type            string              `json:"type"`
	ClusterIPs      []string            `json:"clusterIPs"`
	ExternalIPs     []string            `json:"externalIPs"`
	Selector        map[string]string   `json:"selector"`
	Ports           []ServicePortDetail `json:"ports"`
	SessionAffinity string              `json:"sessionAffinity"`
	Labels          map[string]string   `json:"labels"`
	Annotations     map[string]string   `json:"annotations"`
	CreatedAt       string              `json:"createdAt"`
}

type EndpointsSubsetAddress struct {
	IP       string `json:"ip"`
	Hostname string `json:"hostname"`
	NodeName string `json:"nodeName"`
	Ready    bool   `json:"ready"`
}

type EndpointsSubsetPort struct {
	Name     string `json:"name"`
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
}

type EndpointsSubset struct {
	Addresses []EndpointsSubsetAddress `json:"addresses"`
	Ports     []EndpointsSubsetPort    `json:"ports"`
}

type EndpointsDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Subsets     []EndpointsSubset `json:"subsets"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type EndpointSliceEndpoint struct {
	Addresses []string `json:"addresses"`
	NodeName  string   `json:"nodeName"`
	Hostname  string   `json:"hostname"`
	Ready     bool     `json:"ready"`
}

type EndpointSlicePort struct {
	Name     string `json:"name"`
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
}

type EndpointSliceDetail struct {
	Name        string                  `json:"name"`
	Namespace   string                  `json:"namespace"`
	UID         string                  `json:"uid"`
	AddressType string                  `json:"addressType"`
	Service     string                  `json:"service"`
	Endpoints   []EndpointSliceEndpoint `json:"endpoints"`
	Ports       []EndpointSlicePort     `json:"ports"`
	Labels      map[string]string       `json:"labels"`
	Annotations map[string]string       `json:"annotations"`
	CreatedAt   string                  `json:"createdAt"`
}

type IngressPathDetail struct {
	Path        string `json:"path"`
	PathType    string `json:"pathType"`
	ServiceName string `json:"serviceName"`
	ServicePort string `json:"servicePort"`
}

type IngressRuleDetail struct {
	Host  string              `json:"host"`
	Paths []IngressPathDetail `json:"paths"`
}

type IngressTLSDetail struct {
	Hosts      []string `json:"hosts"`
	SecretName string   `json:"secretName"`
}

type IngressDetail struct {
	Name        string              `json:"name"`
	Namespace   string              `json:"namespace"`
	UID         string              `json:"uid"`
	Class       string              `json:"class"`
	Rules       []IngressRuleDetail `json:"rules"`
	TLS         []IngressTLSDetail  `json:"tls"`
	Addresses   []string            `json:"addresses"`
	Labels      map[string]string   `json:"labels"`
	Annotations map[string]string   `json:"annotations"`
	CreatedAt   string              `json:"createdAt"`
}

type NetworkPolicyDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	PodSelector string            `json:"podSelector"`
	PolicyTypes []string          `json:"policyTypes"`
	Ingress     int               `json:"ingress"`
	Egress      int               `json:"egress"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

func (w *contextWatcher) Service(namespace, name string) (*ServiceDetail, error) {
	f := w.factoryFor("Service")
	if f == nil {
		return nil, errKindNoAccess("Service")
	}
	s, err := f.Core().V1().Services().Lister().Services(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	clusterIPs := append([]string{}, s.Spec.ClusterIPs...)
	if len(clusterIPs) == 0 && s.Spec.ClusterIP != "" {
		clusterIPs = []string{s.Spec.ClusterIP}
	}
	ports := make([]ServicePortDetail, 0, len(s.Spec.Ports))
	for _, p := range s.Spec.Ports {
		ports = append(ports, ServicePortDetail{
			Name:       p.Name,
			Protocol:   string(p.Protocol),
			Port:       p.Port,
			TargetPort: p.TargetPort.String(),
			NodePort:   p.NodePort,
		})
	}
	externalIPs := append([]string{}, s.Spec.ExternalIPs...)
	if s.Spec.Type == corev1.ServiceTypeLoadBalancer {
		for _, ing := range s.Status.LoadBalancer.Ingress {
			if ing.IP != "" {
				externalIPs = append(externalIPs, ing.IP)
			} else if ing.Hostname != "" {
				externalIPs = append(externalIPs, ing.Hostname)
			}
		}
	}
	return &ServiceDetail{
		Name:            s.Name,
		Namespace:       s.Namespace,
		UID:             string(s.UID),
		Type:            string(s.Spec.Type),
		ClusterIPs:      clusterIPs,
		ExternalIPs:     externalIPs,
		Selector:        s.Spec.Selector,
		Ports:           ports,
		SessionAffinity: string(s.Spec.SessionAffinity),
		Labels:          s.Labels,
		Annotations:     s.Annotations,
		CreatedAt:       s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Endpoints(namespace, name string) (*EndpointsDetail, error) {
	f := w.factoryFor("Endpoints")
	if f == nil {
		return nil, errKindNoAccess("Endpoints")
	}
	e, err := f.Core().V1().Endpoints().Lister().Endpoints(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	subs := make([]EndpointsSubset, 0, len(e.Subsets))
	for _, s := range e.Subsets {
		addrs := make([]EndpointsSubsetAddress, 0, len(s.Addresses)+len(s.NotReadyAddresses))
		for _, a := range s.Addresses {
			node := ""
			if a.NodeName != nil {
				node = *a.NodeName
			}
			addrs = append(addrs, EndpointsSubsetAddress{IP: a.IP, Hostname: a.Hostname, NodeName: node, Ready: true})
		}
		for _, a := range s.NotReadyAddresses {
			node := ""
			if a.NodeName != nil {
				node = *a.NodeName
			}
			addrs = append(addrs, EndpointsSubsetAddress{IP: a.IP, Hostname: a.Hostname, NodeName: node, Ready: false})
		}
		ports := make([]EndpointsSubsetPort, 0, len(s.Ports))
		for _, p := range s.Ports {
			ports = append(ports, EndpointsSubsetPort{Name: p.Name, Port: p.Port, Protocol: string(p.Protocol)})
		}
		subs = append(subs, EndpointsSubset{Addresses: addrs, Ports: ports})
	}
	return &EndpointsDetail{
		Name:        e.Name,
		Namespace:   e.Namespace,
		UID:         string(e.UID),
		Subsets:     subs,
		Labels:      e.Labels,
		Annotations: e.Annotations,
		CreatedAt:   e.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) EndpointSlice(namespace, name string) (*EndpointSliceDetail, error) {
	f := w.factoryFor("EndpointSlice")
	if f == nil {
		return nil, errKindNoAccess("EndpointSlice")
	}
	s, err := f.Discovery().V1().EndpointSlices().Lister().EndpointSlices(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	endpoints := make([]EndpointSliceEndpoint, 0, len(s.Endpoints))
	for _, e := range s.Endpoints {
		ready := false
		if e.Conditions.Ready != nil {
			ready = *e.Conditions.Ready
		}
		node := ""
		if e.NodeName != nil {
			node = *e.NodeName
		}
		host := ""
		if e.Hostname != nil {
			host = *e.Hostname
		}
		endpoints = append(endpoints, EndpointSliceEndpoint{
			Addresses: append([]string(nil), e.Addresses...),
			NodeName:  node,
			Hostname:  host,
			Ready:     ready,
		})
	}
	ports := make([]EndpointSlicePort, 0, len(s.Ports))
	for _, p := range s.Ports {
		port := int32(0)
		if p.Port != nil {
			port = *p.Port
		}
		proto := ""
		if p.Protocol != nil {
			proto = string(*p.Protocol)
		}
		pname := ""
		if p.Name != nil {
			pname = *p.Name
		}
		ports = append(ports, EndpointSlicePort{Name: pname, Port: port, Protocol: proto})
	}
	return &EndpointSliceDetail{
		Name:        s.Name,
		Namespace:   s.Namespace,
		UID:         string(s.UID),
		AddressType: string(s.AddressType),
		Service:     s.Labels["kubernetes.io/service-name"],
		Endpoints:   endpoints,
		Ports:       ports,
		Labels:      s.Labels,
		Annotations: s.Annotations,
		CreatedAt:   s.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) Ingress(namespace, name string) (*IngressDetail, error) {
	f := w.factoryFor("Ingress")
	if f == nil {
		return nil, errKindNoAccess("Ingress")
	}
	ing, err := f.Networking().V1().Ingresses().Lister().Ingresses(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	class := ""
	if ing.Spec.IngressClassName != nil {
		class = *ing.Spec.IngressClassName
	}
	rules := make([]IngressRuleDetail, 0, len(ing.Spec.Rules))
	for _, r := range ing.Spec.Rules {
		paths := []IngressPathDetail{}
		if r.HTTP != nil {
			for _, p := range r.HTTP.Paths {
				svcName := ""
				svcPort := ""
				if p.Backend.Service != nil {
					svcName = p.Backend.Service.Name
					if p.Backend.Service.Port.Number != 0 {
						svcPort = fmt.Sprintf("%d", p.Backend.Service.Port.Number)
					} else {
						svcPort = p.Backend.Service.Port.Name
					}
				}
				pathType := ""
				if p.PathType != nil {
					pathType = string(*p.PathType)
				}
				paths = append(paths, IngressPathDetail{
					Path:        p.Path,
					PathType:    pathType,
					ServiceName: svcName,
					ServicePort: svcPort,
				})
			}
		}
		rules = append(rules, IngressRuleDetail{Host: r.Host, Paths: paths})
	}
	tls := make([]IngressTLSDetail, 0, len(ing.Spec.TLS))
	for _, t := range ing.Spec.TLS {
		tls = append(tls, IngressTLSDetail{Hosts: t.Hosts, SecretName: t.SecretName})
	}
	addresses := make([]string, 0, len(ing.Status.LoadBalancer.Ingress))
	for _, lb := range ing.Status.LoadBalancer.Ingress {
		if lb.IP != "" {
			addresses = append(addresses, lb.IP)
		} else if lb.Hostname != "" {
			addresses = append(addresses, lb.Hostname)
		}
	}
	return &IngressDetail{
		Name:        ing.Name,
		Namespace:   ing.Namespace,
		UID:         string(ing.UID),
		Class:       class,
		Rules:       rules,
		TLS:         tls,
		Addresses:   addresses,
		Labels:      ing.Labels,
		Annotations: ing.Annotations,
		CreatedAt:   ing.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) NetworkPolicy(namespace, name string) (*NetworkPolicyDetail, error) {
	f := w.factoryFor("NetworkPolicy")
	if f == nil {
		return nil, errKindNoAccess("NetworkPolicy")
	}
	p, err := f.Networking().V1().NetworkPolicies().Lister().NetworkPolicies(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	types := make([]string, 0, len(p.Spec.PolicyTypes))
	for _, t := range p.Spec.PolicyTypes {
		types = append(types, string(t))
	}
	return &NetworkPolicyDetail{
		Name:        p.Name,
		Namespace:   p.Namespace,
		UID:         string(p.UID),
		PodSelector: formatLabelSelector(&p.Spec.PodSelector),
		PolicyTypes: types,
		Ingress:     len(p.Spec.Ingress),
		Egress:      len(p.Spec.Egress),
		Labels:      p.Labels,
		Annotations: p.Annotations,
		CreatedAt:   p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}
