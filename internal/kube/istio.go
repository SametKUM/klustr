package kube

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Istio read-only typed views. Istio serves these kinds at versions that vary
// by install (v1 / v1beta1 / v1alpha3), so unlike the Flux slice we never
// hardcode a version: istioGVR resolves the served storage version from the
// discovered CRD, which is the same version the frontend watches.
const (
	istioNetworkingGroup = "networking.istio.io"
	istioSecurityGroup   = "security.istio.io"

	istioVirtualServiceResource     = "virtualservices"
	istioDestinationRuleResource    = "destinationrules"
	istioPeerAuthenticationResource = "peerauthentications"
)

// istioGVR resolves the cluster's served GVR for a group/resource pair via the
// discovered CRD, or false when Istio's CRDs are absent.
func (m *ClientManager) istioGVR(contextName, group, resource string) (schema.GroupVersionResource, bool) {
	w, ok := m.watcher(contextName)
	if !ok || w.crd == nil {
		return schema.GroupVersionResource{}, false
	}
	info, ok := w.crd.LookupCRDByGVR(schema.GroupVersionResource{Group: group, Resource: resource})
	if !ok {
		return schema.GroupVersionResource{}, false
	}
	return info.GVR(), true
}

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

func istioToInt64(v any) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case float64:
		return int64(n)
	}
	return 0
}

func sortByNS[T any](rows []T, key func(int) (string, string)) {
	sort.SliceStable(rows, func(i, j int) bool {
		ni, nameI := key(i)
		nj, nameJ := key(j)
		if ni != nj {
			return ni < nj
		}
		return nameI < nameJ
	})
}

// ---------------------------------------------------------------------------
// VirtualService
// ---------------------------------------------------------------------------

type IstioDestinationWeight struct {
	Host   string `json:"host"`
	Subset string `json:"subset"`
	Port   int64  `json:"port"`
	Weight int64  `json:"weight"`
}

type IstioRouteRule struct {
	Match        string                   `json:"match"`
	Destinations []IstioDestinationWeight `json:"destinations"`
}

type IstioVirtualServiceInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Hosts     []string `json:"hosts"`
	Gateways  []string `json:"gateways"`
	HTTPCount int      `json:"httpCount"`
	TLSCount  int      `json:"tlsCount"`
	TCPCount  int      `json:"tcpCount"`
	CreatedAt string   `json:"createdAt"`
}

type IstioVirtualServiceDetail struct {
	IstioVirtualServiceInfo
	HTTPRoutes []IstioRouteRule `json:"httpRoutes"`
	TLSRoutes  []IstioRouteRule `json:"tlsRoutes"`
	TCPRoutes  []IstioRouteRule `json:"tcpRoutes"`
}

func (m *ClientManager) ListIstioVirtualServices(contextName, namespace string) []IstioVirtualServiceInfo {
	gvr, ok := m.istioGVR(contextName, istioNetworkingGroup, istioVirtualServiceResource)
	if !ok {
		return []IstioVirtualServiceInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]IstioVirtualServiceInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractVirtualService(obj))
	}
	sortByNS(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetIstioVirtualService(ctx context.Context, contextName, namespace, name string) (*IstioVirtualServiceDetail, error) {
	gvr, ok := m.istioGVR(contextName, istioNetworkingGroup, istioVirtualServiceResource)
	if !ok {
		return nil, fmt.Errorf("istio VirtualService CRD not found")
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	return &IstioVirtualServiceDetail{
		IstioVirtualServiceInfo: extractVirtualService(obj),
		HTTPRoutes:              extractRouteRules(obj, "http"),
		TLSRoutes:               extractRouteRules(obj, "tls"),
		TCPRoutes:               extractRouteRules(obj, "tcp"),
	}, nil
}

func extractVirtualService(obj *unstructured.Unstructured) IstioVirtualServiceInfo {
	hosts, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "hosts")
	gateways, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "gateways")
	httpRules, _, _ := nestedSliceNoCopy(obj.Object, "spec", "http")
	tlsRules, _, _ := nestedSliceNoCopy(obj.Object, "spec", "tls")
	tcpRules, _, _ := nestedSliceNoCopy(obj.Object, "spec", "tcp")
	return IstioVirtualServiceInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Hosts:     append([]string{}, hosts...),
		Gateways:  append([]string{}, gateways...),
		HTTPCount: len(httpRules),
		TLSCount:  len(tlsRules),
		TCPCount:  len(tcpRules),
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

func extractRouteRules(obj *unstructured.Unstructured, field string) []IstioRouteRule {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", field)
	out := make([]IstioRouteRule, 0, len(raw))
	for _, item := range raw {
		rule, ok := item.(map[string]any)
		if !ok {
			continue
		}
		out = append(out, IstioRouteRule{
			Match:        summariseMatch(rule),
			Destinations: extractDestinations(rule),
		})
	}
	return out
}

func extractDestinations(rule map[string]any) []IstioDestinationWeight {
	routes, ok := rule["route"].([]any)
	if !ok {
		return []IstioDestinationWeight{}
	}
	out := make([]IstioDestinationWeight, 0, len(routes))
	for _, r := range routes {
		rm, ok := r.(map[string]any)
		if !ok {
			continue
		}
		dest, _ := rm["destination"].(map[string]any)
		host, _ := dest["host"].(string)
		subset, _ := dest["subset"].(string)
		var port int64
		if p, ok := dest["port"].(map[string]any); ok {
			port = istioToInt64(p["number"])
		}
		out = append(out, IstioDestinationWeight{
			Host:   host,
			Subset: subset,
			Port:   port,
			Weight: istioToInt64(rm["weight"]),
		})
	}
	return out
}

// summariseMatch renders an Istio route rule's match conditions into a compact
// string for the routing table. It handles the common HTTP (uri/method/header),
// TLS (sniHosts) and TCP (port) match shapes; an absent match means "match all".
func summariseMatch(rule map[string]any) string {
	matches, ok := rule["match"].([]any)
	if !ok || len(matches) == 0 {
		return "any"
	}
	parts := make([]string, 0, len(matches))
	for _, m := range matches {
		mm, ok := m.(map[string]any)
		if !ok {
			continue
		}
		if uri, ok := mm["uri"].(map[string]any); ok {
			for kind, v := range uri {
				if s, ok := v.(string); ok {
					parts = append(parts, fmt.Sprintf("uri %s %s", kind, s))
				}
			}
		}
		if method, ok := mm["method"].(map[string]any); ok {
			for kind, v := range method {
				if s, ok := v.(string); ok {
					parts = append(parts, fmt.Sprintf("method %s %s", kind, s))
				}
			}
		}
		if headers, ok := mm["headers"].(map[string]any); ok && len(headers) > 0 {
			parts = append(parts, fmt.Sprintf("%d header match", len(headers)))
		}
		if sni, ok := mm["sniHosts"].([]any); ok && len(sni) > 0 {
			hosts := make([]string, 0, len(sni))
			for _, h := range sni {
				if s, ok := h.(string); ok {
					hosts = append(hosts, s)
				}
			}
			parts = append(parts, "sni "+strings.Join(hosts, ","))
		}
		if port, ok := mm["port"]; ok {
			if n := istioToInt64(port); n > 0 {
				parts = append(parts, fmt.Sprintf("port %d", n))
			}
		}
	}
	if len(parts) == 0 {
		return "any"
	}
	return strings.Join(parts, ", ")
}

// ---------------------------------------------------------------------------
// DestinationRule
// ---------------------------------------------------------------------------

type IstioSubset struct {
	Name   string            `json:"name"`
	Labels map[string]string `json:"labels"`
}

type IstioDestinationRuleInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Host      string   `json:"host"`
	Subsets   []string `json:"subsets"`
	TLSMode   string   `json:"tlsMode"`
	CreatedAt string   `json:"createdAt"`
}

type IstioDestinationRuleDetail struct {
	IstioDestinationRuleInfo
	SubsetDetails []IstioSubset `json:"subsetDetails"`
	LoadBalancer  string        `json:"loadBalancer"`
}

func (m *ClientManager) ListIstioDestinationRules(contextName, namespace string) []IstioDestinationRuleInfo {
	gvr, ok := m.istioGVR(contextName, istioNetworkingGroup, istioDestinationRuleResource)
	if !ok {
		return []IstioDestinationRuleInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]IstioDestinationRuleInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractDestinationRule(obj))
	}
	sortByNS(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetIstioDestinationRule(ctx context.Context, contextName, namespace, name string) (*IstioDestinationRuleDetail, error) {
	gvr, ok := m.istioGVR(contextName, istioNetworkingGroup, istioDestinationRuleResource)
	if !ok {
		return nil, fmt.Errorf("istio DestinationRule CRD not found")
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	lb, _, _ := unstructured.NestedString(obj.Object, "spec", "trafficPolicy", "loadBalancer", "simple")
	return &IstioDestinationRuleDetail{
		IstioDestinationRuleInfo: extractDestinationRule(obj),
		SubsetDetails:            extractSubsets(obj),
		LoadBalancer:             lb,
	}, nil
}

func extractDestinationRule(obj *unstructured.Unstructured) IstioDestinationRuleInfo {
	host, _, _ := unstructured.NestedString(obj.Object, "spec", "host")
	tlsMode, _, _ := unstructured.NestedString(obj.Object, "spec", "trafficPolicy", "tls", "mode")
	subsets := extractSubsets(obj)
	names := make([]string, 0, len(subsets))
	for _, s := range subsets {
		names = append(names, s.Name)
	}
	return IstioDestinationRuleInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Host:      host,
		Subsets:   names,
		TLSMode:   tlsMode,
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

func extractSubsets(obj *unstructured.Unstructured) []IstioSubset {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "subsets")
	out := make([]IstioSubset, 0, len(raw))
	for _, item := range raw {
		sm, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := sm["name"].(string)
		labels := map[string]string{}
		if lm, ok := sm["labels"].(map[string]any); ok {
			for k, v := range lm {
				if s, ok := v.(string); ok {
					labels[k] = s
				}
			}
		}
		out = append(out, IstioSubset{Name: name, Labels: labels})
	}
	return out
}

// ---------------------------------------------------------------------------
// PeerAuthentication
// ---------------------------------------------------------------------------

type IstioPortMTLS struct {
	Port int64  `json:"port"`
	Mode string `json:"mode"`
}

type IstioPeerAuthenticationInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	MTLSMode  string `json:"mtlsMode"`
	Selector  string `json:"selector"`
	CreatedAt string `json:"createdAt"`
}

type IstioPeerAuthenticationDetail struct {
	IstioPeerAuthenticationInfo
	SelectorLabels map[string]string `json:"selectorLabels"`
	PortLevel      []IstioPortMTLS   `json:"portLevel"`
}

func (m *ClientManager) ListIstioPeerAuthentications(contextName, namespace string) []IstioPeerAuthenticationInfo {
	gvr, ok := m.istioGVR(contextName, istioSecurityGroup, istioPeerAuthenticationResource)
	if !ok {
		return []IstioPeerAuthenticationInfo{}
	}
	objs := listCachedCRs(m, contextName, gvr, namespace)
	out := make([]IstioPeerAuthenticationInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractPeerAuthentication(obj))
	}
	sortByNS(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetIstioPeerAuthentication(ctx context.Context, contextName, namespace, name string) (*IstioPeerAuthenticationDetail, error) {
	gvr, ok := m.istioGVR(contextName, istioSecurityGroup, istioPeerAuthenticationResource)
	if !ok {
		return nil, fmt.Errorf("istio PeerAuthentication CRD not found")
	}
	obj, err := m.crForDetail(ctx, contextName, gvr, namespace, name)
	if err != nil {
		return nil, err
	}
	selectorLabels, _, _ := unstructured.NestedStringMap(obj.Object, "spec", "selector", "matchLabels")
	return &IstioPeerAuthenticationDetail{
		IstioPeerAuthenticationInfo: extractPeerAuthentication(obj),
		SelectorLabels:              selectorLabels,
		PortLevel:                   extractPortLevelMTLS(obj),
	}, nil
}

func extractPeerAuthentication(obj *unstructured.Unstructured) IstioPeerAuthenticationInfo {
	mode, _, _ := unstructured.NestedString(obj.Object, "spec", "mtls", "mode")
	if mode == "" {
		mode = "UNSET"
	}
	selectorLabels, found, _ := unstructured.NestedStringMap(obj.Object, "spec", "selector", "matchLabels")
	selector := "namespace-wide"
	if found && len(selectorLabels) > 0 {
		pairs := make([]string, 0, len(selectorLabels))
		for k, v := range selectorLabels {
			pairs = append(pairs, k+"="+v)
		}
		sort.Strings(pairs)
		selector = strings.Join(pairs, ", ")
	}
	return IstioPeerAuthenticationInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		MTLSMode:  mode,
		Selector:  selector,
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

func extractPortLevelMTLS(obj *unstructured.Unstructured) []IstioPortMTLS {
	raw, found, _ := nestedMapNoCopy(obj.Object, "spec", "portLevelMtls")
	if !found {
		return []IstioPortMTLS{}
	}
	out := make([]IstioPortMTLS, 0, len(raw))
	for portStr, v := range raw {
		entry, ok := v.(map[string]any)
		if !ok {
			continue
		}
		mode, _ := entry["mode"].(string)
		port, err := strconv.ParseInt(portStr, 10, 64)
		if err != nil {
			continue
		}
		out = append(out, IstioPortMTLS{Port: port, Mode: mode})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Port < out[j].Port })
	return out
}
