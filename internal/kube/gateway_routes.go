package kube

import (
	"strings"
	"time"

	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
)

type TLSRouteInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Hostnames    string `json:"hostnames"`
	Parents      string `json:"parents"`
	Rules        int    `json:"rules"`
	Accepted     string `json:"accepted"`
	ResolvedRefs string `json:"resolvedRefs"`
	CreatedAt    string `json:"createdAt"`
}

type TCPRouteInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Parents      string `json:"parents"`
	Rules        int    `json:"rules"`
	Accepted     string `json:"accepted"`
	ResolvedRefs string `json:"resolvedRefs"`
	CreatedAt    string `json:"createdAt"`
}

type UDPRouteInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Parents      string `json:"parents"`
	Rules        int    `json:"rules"`
	Accepted     string `json:"accepted"`
	ResolvedRefs string `json:"resolvedRefs"`
	CreatedAt    string `json:"createdAt"`
}

type L4RouteRuleDetail struct {
	Name     string             `json:"name"`
	Backends []BackendRefDetail `json:"backends"`
}

type TLSRouteDetail struct {
	Name        string                    `json:"name"`
	Namespace   string                    `json:"namespace"`
	UID         string                    `json:"uid"`
	Hostnames   []string                  `json:"hostnames"`
	Parents     []ParentRefDetail         `json:"parents"`
	Rules       []L4RouteRuleDetail       `json:"rules"`
	Status      []RouteParentStatusDetail `json:"status"`
	Labels      map[string]string         `json:"labels"`
	Annotations map[string]string         `json:"annotations"`
	CreatedAt   string                    `json:"createdAt"`
}

type TCPRouteDetail struct {
	Name        string                    `json:"name"`
	Namespace   string                    `json:"namespace"`
	UID         string                    `json:"uid"`
	Parents     []ParentRefDetail         `json:"parents"`
	Rules       []L4RouteRuleDetail       `json:"rules"`
	Status      []RouteParentStatusDetail `json:"status"`
	Labels      map[string]string         `json:"labels"`
	Annotations map[string]string         `json:"annotations"`
	CreatedAt   string                    `json:"createdAt"`
}

type UDPRouteDetail struct {
	Name        string                    `json:"name"`
	Namespace   string                    `json:"namespace"`
	UID         string                    `json:"uid"`
	Parents     []ParentRefDetail         `json:"parents"`
	Rules       []L4RouteRuleDetail       `json:"rules"`
	Status      []RouteParentStatusDetail `json:"status"`
	Labels      map[string]string         `json:"labels"`
	Annotations map[string]string         `json:"annotations"`
	CreatedAt   string                    `json:"createdAt"`
}

func tlsRouteInfo(r *gatewayv1.TLSRoute) TLSRouteInfo {
	return TLSRouteInfo{
		Name: r.Name, Namespace: r.Namespace,
		Hostnames:    strings.Join(gatewayHostnames(r.Spec.Hostnames), ", "),
		Parents:      gatewayParentNames(r.Spec.ParentRefs, r.Namespace),
		Rules:        len(r.Spec.Rules),
		Accepted:     anyParentConditionStatus(r.Status.Parents, "Accepted", r.Generation),
		ResolvedRefs: anyParentConditionStatus(r.Status.Parents, "ResolvedRefs", r.Generation),
		CreatedAt:    r.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func tcpRouteInfo(r *gatewayv1.TCPRoute) TCPRouteInfo {
	return TCPRouteInfo{
		Name: r.Name, Namespace: r.Namespace,
		Parents:      gatewayParentNames(r.Spec.ParentRefs, r.Namespace),
		Rules:        len(r.Spec.Rules),
		Accepted:     anyParentConditionStatus(r.Status.Parents, "Accepted", r.Generation),
		ResolvedRefs: anyParentConditionStatus(r.Status.Parents, "ResolvedRefs", r.Generation),
		CreatedAt:    r.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func udpRouteInfo(r *gatewayv1.UDPRoute) UDPRouteInfo {
	return UDPRouteInfo{
		Name: r.Name, Namespace: r.Namespace,
		Parents:      gatewayParentNames(r.Spec.ParentRefs, r.Namespace),
		Rules:        len(r.Spec.Rules),
		Accepted:     anyParentConditionStatus(r.Status.Parents, "Accepted", r.Generation),
		ResolvedRefs: anyParentConditionStatus(r.Status.Parents, "ResolvedRefs", r.Generation),
		CreatedAt:    r.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func tlsRouteDetail(r *gatewayv1.TLSRoute) *TLSRouteDetail {
	rules := make([]L4RouteRuleDetail, 0, len(r.Spec.Rules))
	for _, rule := range r.Spec.Rules {
		rules = append(rules, l4RouteRuleDetail(rule.Name, rule.BackendRefs, r.Namespace))
	}
	return &TLSRouteDetail{
		Name: r.Name, Namespace: r.Namespace, UID: string(r.UID),
		Hostnames: gatewayHostnames(r.Spec.Hostnames),
		Parents:   normalizedGatewayParents(r.Spec.ParentRefs, r.Namespace),
		Rules:     rules, Status: normalizedGatewayRouteStatus(r.Status.Parents, r.Namespace, r.Generation),
		Labels: r.Labels, Annotations: r.Annotations,
		CreatedAt: r.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func tcpRouteDetail(r *gatewayv1.TCPRoute) *TCPRouteDetail {
	rules := make([]L4RouteRuleDetail, 0, len(r.Spec.Rules))
	for _, rule := range r.Spec.Rules {
		rules = append(rules, l4RouteRuleDetail(rule.Name, rule.BackendRefs, r.Namespace))
	}
	return &TCPRouteDetail{
		Name: r.Name, Namespace: r.Namespace, UID: string(r.UID),
		Parents: normalizedGatewayParents(r.Spec.ParentRefs, r.Namespace),
		Rules:   rules, Status: normalizedGatewayRouteStatus(r.Status.Parents, r.Namespace, r.Generation),
		Labels: r.Labels, Annotations: r.Annotations,
		CreatedAt: r.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func udpRouteDetail(r *gatewayv1.UDPRoute) *UDPRouteDetail {
	rules := make([]L4RouteRuleDetail, 0, len(r.Spec.Rules))
	for _, rule := range r.Spec.Rules {
		rules = append(rules, l4RouteRuleDetail(rule.Name, rule.BackendRefs, r.Namespace))
	}
	return &UDPRouteDetail{
		Name: r.Name, Namespace: r.Namespace, UID: string(r.UID),
		Parents: normalizedGatewayParents(r.Spec.ParentRefs, r.Namespace),
		Rules:   rules, Status: normalizedGatewayRouteStatus(r.Status.Parents, r.Namespace, r.Generation),
		Labels: r.Labels, Annotations: r.Annotations,
		CreatedAt: r.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func l4RouteRuleDetail(name *gatewayv1.SectionName, backends []gatewayv1.BackendRef, namespace string) L4RouteRuleDetail {
	out := L4RouteRuleDetail{Backends: make([]BackendRefDetail, 0, len(backends))}
	if name != nil {
		out.Name = string(*name)
	}
	for _, backend := range backends {
		ref := backendRefDetail(backend, namespace, nil)
		if backend.Weight == nil {
			ref.Weight = 1
		}
		out.Backends = append(out.Backends, ref)
	}
	return out
}

func normalizedGatewayParentRef(ref gatewayv1.ParentReference, namespace string) ParentRefDetail {
	out := parentRefDetail(ref, namespace)
	if ref.Group == nil {
		out.Group = gatewayv1.GroupName
	}
	if ref.Kind == nil {
		out.Kind = "Gateway"
	}
	return out
}

func normalizedGatewayParents(refs []gatewayv1.ParentReference, namespace string) []ParentRefDetail {
	out := make([]ParentRefDetail, 0, len(refs))
	for _, ref := range refs {
		out = append(out, normalizedGatewayParentRef(ref, namespace))
	}
	return out
}

func normalizedGatewayRouteStatus(parents []gatewayv1.RouteParentStatus, namespace string, generation int64) []RouteParentStatusDetail {
	out := routeParentStatusDetail(parents, namespace, generation)
	for i := range out {
		out[i].Parent = normalizedGatewayParentRef(parents[i].ParentRef, namespace)
	}
	return out
}

func gatewayHostnames(hostnames []gatewayv1.Hostname) []string {
	out := make([]string, 0, len(hostnames))
	for _, hostname := range hostnames {
		out = append(out, string(hostname))
	}
	return out
}

func gatewayParentNames(parents []gatewayv1.ParentReference, namespace string) string {
	out := make([]string, 0, len(parents))
	for _, parent := range parents {
		out = append(out, formatParentRefShort(parent, namespace))
	}
	return strings.Join(out, ", ")
}
