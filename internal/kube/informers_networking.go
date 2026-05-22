package kube

import (
	"fmt"
	"sort"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type ServiceInfo struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	Type       string `json:"type"`
	ClusterIP  string `json:"clusterIP"`
	ExternalIP string `json:"externalIP"`
	Ports      string `json:"ports"`
	CreatedAt  string `json:"createdAt"`
}

type EndpointsInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Endpoints string `json:"endpoints"`
	CreatedAt string `json:"createdAt"`
}

type EndpointSliceInfo struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	AddressType string `json:"addressType"`
	Ports       string `json:"ports"`
	Endpoints   int    `json:"endpoints"`
	Service     string `json:"service"`
	CreatedAt   string `json:"createdAt"`
}

type IngressInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Class     string `json:"class"`
	Hosts     string `json:"hosts"`
	Address   string `json:"address"`
	Ports     string `json:"ports"`
	CreatedAt string `json:"createdAt"`
}

type NetworkPolicyInfo struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	PodSelector string `json:"podSelector"`
	PolicyTypes string `json:"policyTypes"`
	CreatedAt   string `json:"createdAt"`
}

func (w *contextWatcher) Services(namespace string) []ServiceInfo {
	lister := w.factory.Core().V1().Services().Lister()
	var (
		svcs []*corev1.Service
		err  error
	)
	if namespace == "" {
		svcs, err = lister.List(labels.Everything())
	} else {
		svcs, err = lister.Services(namespace).List(labels.Everything())
	}
	if err != nil {
		return []ServiceInfo{}
	}
	out := make([]ServiceInfo, 0, len(svcs))
	for _, s := range svcs {
		out = append(out, ServiceInfo{
			Name:       s.Name,
			Namespace:  s.Namespace,
			Type:       string(s.Spec.Type),
			ClusterIP:  serviceClusterIP(s),
			ExternalIP: serviceExternalIP(s),
			Ports:      servicePorts(s),
			CreatedAt:  s.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	return out
}

func (w *contextWatcher) ListEndpoints(namespace string) []EndpointsInfo {
	lister := w.factory.Core().V1().Endpoints().Lister()
	var (
		eps []*corev1.Endpoints
		err error
	)
	if namespace == "" {
		eps, err = lister.List(labels.Everything())
	} else {
		eps, err = lister.Endpoints(namespace).List(labels.Everything())
	}
	if err != nil {
		return []EndpointsInfo{}
	}
	out := make([]EndpointsInfo, 0, len(eps))
	for _, e := range eps {
		addrs := []string{}
		for _, s := range e.Subsets {
			for _, a := range s.Addresses {
				for _, p := range s.Ports {
					addrs = append(addrs, fmt.Sprintf("%s:%d", a.IP, p.Port))
				}
			}
		}
		joined := strings.Join(addrs, ", ")
		if len(addrs) > 5 {
			joined = strings.Join(addrs[:5], ", ") + fmt.Sprintf(" +%d more", len(addrs)-5)
		}
		out = append(out, EndpointsInfo{
			Name:      e.Name,
			Namespace: e.Namespace,
			Endpoints: joined,
			CreatedAt: e.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) EndpointSlices(namespace string) []EndpointSliceInfo {
	lister := w.factory.Discovery().V1().EndpointSlices().Lister()
	var (
		slices []*discoveryv1.EndpointSlice
		err    error
	)
	if namespace == "" {
		slices, err = lister.List(labels.Everything())
	} else {
		slices, err = lister.EndpointSlices(namespace).List(labels.Everything())
	}
	if err != nil {
		return []EndpointSliceInfo{}
	}
	out := make([]EndpointSliceInfo, 0, len(slices))
	for _, s := range slices {
		ports := make([]string, 0, len(s.Ports))
		for _, p := range s.Ports {
			port := int32(0)
			if p.Port != nil {
				port = *p.Port
			}
			proto := ""
			if p.Protocol != nil {
				proto = string(*p.Protocol)
			}
			ports = append(ports, fmt.Sprintf("%d/%s", port, proto))
		}
		out = append(out, EndpointSliceInfo{
			Name:        s.Name,
			Namespace:   s.Namespace,
			AddressType: string(s.AddressType),
			Ports:       strings.Join(ports, ","),
			Endpoints:   len(s.Endpoints),
			Service:     s.Labels["kubernetes.io/service-name"],
			CreatedAt:   s.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) Ingresses(namespace string) []IngressInfo {
	lister := w.factory.Networking().V1().Ingresses().Lister()
	var (
		ings []*networkingv1.Ingress
		err  error
	)
	if namespace == "" {
		ings, err = lister.List(labels.Everything())
	} else {
		ings, err = lister.Ingresses(namespace).List(labels.Everything())
	}
	if err != nil {
		return []IngressInfo{}
	}
	out := make([]IngressInfo, 0, len(ings))
	for _, ing := range ings {
		class := ""
		if ing.Spec.IngressClassName != nil {
			class = *ing.Spec.IngressClassName
		}
		hosts := make([]string, 0, len(ing.Spec.Rules))
		for _, r := range ing.Spec.Rules {
			if r.Host != "" {
				hosts = append(hosts, r.Host)
			}
		}
		addresses := make([]string, 0, len(ing.Status.LoadBalancer.Ingress))
		for _, lb := range ing.Status.LoadBalancer.Ingress {
			if lb.IP != "" {
				addresses = append(addresses, lb.IP)
			} else if lb.Hostname != "" {
				addresses = append(addresses, lb.Hostname)
			}
		}
		ports := "80"
		if len(ing.Spec.TLS) > 0 {
			ports = "80, 443"
		}
		out = append(out, IngressInfo{
			Name:      ing.Name,
			Namespace: ing.Namespace,
			Class:     class,
			Hosts:     strings.Join(hosts, ", "),
			Address:   strings.Join(addresses, ", "),
			Ports:     ports,
			CreatedAt: ing.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) NetworkPolicies(namespace string) []NetworkPolicyInfo {
	lister := w.factory.Networking().V1().NetworkPolicies().Lister()
	var (
		policies []*networkingv1.NetworkPolicy
		err      error
	)
	if namespace == "" {
		policies, err = lister.List(labels.Everything())
	} else {
		policies, err = lister.NetworkPolicies(namespace).List(labels.Everything())
	}
	if err != nil {
		return []NetworkPolicyInfo{}
	}
	out := make([]NetworkPolicyInfo, 0, len(policies))
	for _, p := range policies {
		types := make([]string, 0, len(p.Spec.PolicyTypes))
		for _, t := range p.Spec.PolicyTypes {
			types = append(types, string(t))
		}
		out = append(out, NetworkPolicyInfo{
			Name:        p.Name,
			Namespace:   p.Namespace,
			PodSelector: formatLabelSelector(&p.Spec.PodSelector),
			PolicyTypes: strings.Join(types, ","),
			CreatedAt:   p.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func serviceClusterIP(s *corev1.Service) string {
	if s.Spec.ClusterIP == "" {
		return "<none>"
	}
	return s.Spec.ClusterIP
}

func serviceExternalIP(s *corev1.Service) string {
	switch s.Spec.Type {
	case corev1.ServiceTypeExternalName:
		return s.Spec.ExternalName
	case corev1.ServiceTypeLoadBalancer:
		ips := make([]string, 0, len(s.Status.LoadBalancer.Ingress))
		for _, ing := range s.Status.LoadBalancer.Ingress {
			if ing.IP != "" {
				ips = append(ips, ing.IP)
			} else if ing.Hostname != "" {
				ips = append(ips, ing.Hostname)
			}
		}
		if len(ips) > 0 {
			return strings.Join(ips, ",")
		}
		return "<pending>"
	}
	if len(s.Spec.ExternalIPs) > 0 {
		return strings.Join(s.Spec.ExternalIPs, ",")
	}
	return "<none>"
}

func servicePorts(s *corev1.Service) string {
	if len(s.Spec.Ports) == 0 {
		return "<none>"
	}
	parts := make([]string, 0, len(s.Spec.Ports))
	for _, p := range s.Spec.Ports {
		if p.NodePort != 0 {
			parts = append(parts, fmt.Sprintf("%d:%d/%s", p.Port, p.NodePort, p.Protocol))
		} else {
			parts = append(parts, fmt.Sprintf("%d/%s", p.Port, p.Protocol))
		}
	}
	return strings.Join(parts, ",")
}
