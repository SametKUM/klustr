package kube

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var (
	istioGatewayGR               = schema.GroupResource{Group: "networking.istio.io", Resource: "gateways"}
	istioServiceEntryGR          = schema.GroupResource{Group: "networking.istio.io", Resource: "serviceentries"}
	istioSidecarGR               = schema.GroupResource{Group: "networking.istio.io", Resource: "sidecars"}
	istioAuthorizationPolicyGR   = schema.GroupResource{Group: "security.istio.io", Resource: "authorizationpolicies"}
	istioRequestAuthenticationGR = schema.GroupResource{Group: "security.istio.io", Resource: "requestauthentications"}
)

// IstioPort is a port as Gateway servers, ServiceEntries and Sidecar
// listeners declare it.
type IstioPort struct {
	Number     int64  `json:"number"`
	Protocol   string `json:"protocol"`
	Name       string `json:"name"`
	TargetPort int64  `json:"targetPort"`
}

func istioPortFrom(m map[string]any) IstioPort {
	p := IstioPort{Number: toInt64(m["number"]), TargetPort: toInt64(m["targetPort"])}
	p.Protocol, _ = m["protocol"].(string)
	p.Name, _ = m["name"].(string)
	return p
}

func istioPortsSummary(ports []IstioPort) string {
	parts := make([]string, 0, len(ports))
	for _, p := range ports {
		s := fmt.Sprint(p.Number)
		if p.Protocol != "" {
			s += "/" + p.Protocol
		}
		parts = append(parts, s)
	}
	return strings.Join(parts, ", ")
}

func stringsAt(m map[string]any, key string) []string {
	return appendStrings([]string{}, m[key])
}

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

type IstioGatewayServer struct {
	Name           string    `json:"name"`
	Port           IstioPort `json:"port"`
	Bind           string    `json:"bind"`
	Hosts          []string  `json:"hosts"`
	TLSMode        string    `json:"tlsMode"`
	CredentialName string    `json:"credentialName"`
	HTTPSRedirect  bool      `json:"httpsRedirect"`
}

type IstioGatewayInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Selector  string   `json:"selector"`
	Ports     string   `json:"ports"`
	Hosts     []string `json:"hosts"`
	CreatedAt string   `json:"createdAt"`
}

type IstioGatewayDetail struct {
	IstioGatewayInfo
	SelectorLabels map[string]string    `json:"selectorLabels"`
	Servers        []IstioGatewayServer `json:"servers"`
	// Workloads are the gateway proxies the selector picks, in any
	// namespace: Istio does not scope a Gateway's selector to its own.
	Workloads IstioWorkloads `json:"workloads"`
	// VirtualServices are the cached VirtualServices bound to this Gateway.
	VirtualServices []IstioObjectRef `json:"virtualServices"`
}

func (m *ClientManager) ListIstioGateways(contextName, namespace string) []IstioGatewayInfo {
	return listServedRows(m, contextName, istioGatewayGR, namespace, extractIstioGateway,
		func(r IstioGatewayInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetIstioGateway(ctx context.Context, contextName, namespace, name string) (*IstioGatewayDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, istioGatewayGR, namespace, name)
	if err != nil {
		return nil, err
	}
	sel, _ := istioSelector(obj, "spec", "selector")
	d := &IstioGatewayDetail{
		IstioGatewayInfo: extractIstioGateway(obj),
		SelectorLabels:   sel,
		Servers:          extractIstioGatewayServers(obj),
		Workloads:        IstioWorkloads{Pods: []IstioObjectRef{}},
		VirtualServices:  []IstioObjectRef{},
	}
	if len(sel) > 0 {
		d.Workloads = m.istioWorkloads(contextName, "", sel)
	}
	for _, vs := range m.listServedCRs(contextName, istioVirtualServiceGR, "") {
		gateways, _, _ := unstructured.NestedStringSlice(vs.Object, "spec", "gateways")
		for _, ref := range istioGatewayRefs(vs.GetNamespace(), gateways) {
			if ref.Namespace == namespace && ref.Name == name {
				d.VirtualServices = append(d.VirtualServices, IstioObjectRef{Namespace: vs.GetNamespace(), Name: vs.GetName()})
				break
			}
		}
	}
	sort.Slice(d.VirtualServices, func(i, j int) bool {
		a, b := d.VirtualServices[i], d.VirtualServices[j]
		return a.Namespace+"/"+a.Name < b.Namespace+"/"+b.Name
	})
	return d, nil
}

func extractIstioGatewayServers(obj *unstructured.Unstructured) []IstioGatewayServer {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "servers")
	out := make([]IstioGatewayServer, 0, len(raw))
	for _, item := range raw {
		s, _ := item.(map[string]any)
		port, _ := s["port"].(map[string]any)
		srv := IstioGatewayServer{Port: istioPortFrom(port), Hosts: stringsAt(s, "hosts")}
		srv.Name, _ = s["name"].(string)
		srv.Bind, _ = s["bind"].(string)
		if tls, ok := s["tls"].(map[string]any); ok {
			srv.TLSMode, _ = tls["mode"].(string)
			srv.CredentialName, _ = tls["credentialName"].(string)
			srv.HTTPSRedirect, _ = tls["httpsRedirect"].(bool)
		}
		out = append(out, srv)
	}
	return out
}

func extractIstioGateway(obj *unstructured.Unstructured) IstioGatewayInfo {
	servers := extractIstioGatewayServers(obj)
	ports := make([]IstioPort, 0, len(servers))
	seen := map[string]bool{}
	hosts := []string{}
	for _, s := range servers {
		ports = append(ports, s.Port)
		for _, h := range s.Hosts {
			if !seen[h] {
				seen[h] = true
				hosts = append(hosts, h)
			}
		}
	}
	sel, _ := istioSelector(obj, "spec", "selector")
	return IstioGatewayInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Selector: selectorString(sel),
		Ports: istioPortsSummary(ports), Hosts: hosts, CreatedAt: crCreatedAt(obj),
	}
}

// ---------------------------------------------------------------------------
// ServiceEntry
// ---------------------------------------------------------------------------

type IstioServiceEntryEndpoint struct {
	Address  string            `json:"address"`
	Ports    string            `json:"ports"`
	Labels   map[string]string `json:"labels"`
	Network  string            `json:"network"`
	Locality string            `json:"locality"`
	Weight   int64             `json:"weight"`
}

type IstioServiceEntryInfo struct {
	Name       string   `json:"name"`
	Namespace  string   `json:"namespace"`
	Hosts      []string `json:"hosts"`
	Location   string   `json:"location"`
	Resolution string   `json:"resolution"`
	Ports      string   `json:"ports"`
	Endpoints  int      `json:"endpoints"`
	CreatedAt  string   `json:"createdAt"`
}

type IstioServiceEntryDetail struct {
	IstioServiceEntryInfo
	Addresses        []string                    `json:"addresses"`
	PortList         []IstioPort                 `json:"portList"`
	EndpointList     []IstioServiceEntryEndpoint `json:"endpointList"`
	WorkloadSelector map[string]string           `json:"workloadSelector"`
	ExportTo         []string                    `json:"exportTo"`
	SubjectAltNames  []string                    `json:"subjectAltNames"`
	Conditions       []ConditionDetail           `json:"conditions"`
}

func (m *ClientManager) ListIstioServiceEntries(contextName, namespace string) []IstioServiceEntryInfo {
	return listServedRows(m, contextName, istioServiceEntryGR, namespace, extractIstioServiceEntry,
		func(r IstioServiceEntryInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetIstioServiceEntry(ctx context.Context, contextName, namespace, name string) (*IstioServiceEntryDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, istioServiceEntryGR, namespace, name)
	if err != nil {
		return nil, err
	}
	spec, _, _ := nestedMapNoCopy(obj.Object, "spec")
	sel, _ := istioSelector(obj, "spec", "workloadSelector", "labels")
	d := &IstioServiceEntryDetail{
		IstioServiceEntryInfo: extractIstioServiceEntry(obj),
		Addresses:             stringsAt(spec, "addresses"),
		PortList:              istioServiceEntryPorts(obj),
		EndpointList:          []IstioServiceEntryEndpoint{},
		WorkloadSelector:      sel,
		ExportTo:              stringsAt(spec, "exportTo"),
		SubjectAltNames:       stringsAt(spec, "subjectAltNames"),
		Conditions:            crConditions(obj),
	}
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "endpoints")
	for _, item := range raw {
		e, _ := item.(map[string]any)
		ep := IstioServiceEntryEndpoint{Labels: map[string]string{}, Weight: toInt64(e["weight"])}
		ep.Address, _ = e["address"].(string)
		ep.Network, _ = e["network"].(string)
		ep.Locality, _ = e["locality"].(string)
		if labels, ok := e["labels"].(map[string]any); ok {
			for k, v := range labels {
				ep.Labels[k] = fmt.Sprint(v)
			}
		}
		if ports, ok := e["ports"].(map[string]any); ok {
			pairs := make([]string, 0, len(ports))
			for k, v := range ports {
				pairs = append(pairs, fmt.Sprintf("%s=%d", k, toInt64(v)))
			}
			sort.Strings(pairs)
			ep.Ports = strings.Join(pairs, ", ")
		}
		d.EndpointList = append(d.EndpointList, ep)
	}
	return d, nil
}

func istioServiceEntryPorts(obj *unstructured.Unstructured) []IstioPort {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "ports")
	out := make([]IstioPort, 0, len(raw))
	for _, item := range raw {
		p, _ := item.(map[string]any)
		out = append(out, istioPortFrom(p))
	}
	return out
}

func extractIstioServiceEntry(obj *unstructured.Unstructured) IstioServiceEntryInfo {
	spec, _, _ := nestedMapNoCopy(obj.Object, "spec")
	location, _ := spec["location"].(string)
	if location == "" {
		location = "MESH_EXTERNAL"
	}
	resolution, _ := spec["resolution"].(string)
	if resolution == "" {
		resolution = "NONE"
	}
	endpoints, _, _ := nestedSliceNoCopy(obj.Object, "spec", "endpoints")
	return IstioServiceEntryInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Hosts: stringsAt(spec, "hosts"),
		Location: location, Resolution: resolution, Ports: istioPortsSummary(istioServiceEntryPorts(obj)),
		Endpoints: len(endpoints), CreatedAt: crCreatedAt(obj),
	}
}

// ---------------------------------------------------------------------------
// Sidecar
// ---------------------------------------------------------------------------

type IstioSidecarListener struct {
	Port            IstioPort `json:"port"`
	Bind            string    `json:"bind"`
	CaptureMode     string    `json:"captureMode"`
	DefaultEndpoint string    `json:"defaultEndpoint"`
	Hosts           []string  `json:"hosts"`
}

type IstioSidecarInfo struct {
	Name           string   `json:"name"`
	Namespace      string   `json:"namespace"`
	Selector       string   `json:"selector"`
	EgressHosts    []string `json:"egressHosts"`
	OutboundPolicy string   `json:"outboundPolicy"`
	CreatedAt      string   `json:"createdAt"`
}

type IstioSidecarDetail struct {
	IstioSidecarInfo
	SelectorLabels map[string]string      `json:"selectorLabels"`
	Ingress        []IstioSidecarListener `json:"ingress"`
	Egress         []IstioSidecarListener `json:"egress"`
	Workloads      IstioWorkloads         `json:"workloads"`
}

func (m *ClientManager) ListIstioSidecars(contextName, namespace string) []IstioSidecarInfo {
	return listServedRows(m, contextName, istioSidecarGR, namespace, extractIstioSidecar,
		func(r IstioSidecarInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetIstioSidecar(ctx context.Context, contextName, namespace, name string) (*IstioSidecarDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, istioSidecarGR, namespace, name)
	if err != nil {
		return nil, err
	}
	sel, _ := istioSelector(obj, "spec", "workloadSelector", "labels")
	return &IstioSidecarDetail{
		IstioSidecarInfo: extractIstioSidecar(obj),
		SelectorLabels:   sel,
		Ingress:          istioSidecarListeners(obj, "ingress"),
		Egress:           istioSidecarListeners(obj, "egress"),
		Workloads:        m.istioPolicyWorkloads(contextName, obj, false, "spec", "workloadSelector", "labels"),
	}, nil
}

func istioSidecarListeners(obj *unstructured.Unstructured, field string) []IstioSidecarListener {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", field)
	out := make([]IstioSidecarListener, 0, len(raw))
	for _, item := range raw {
		l, _ := item.(map[string]any)
		port, _ := l["port"].(map[string]any)
		listener := IstioSidecarListener{Port: istioPortFrom(port), Hosts: stringsAt(l, "hosts")}
		listener.Bind, _ = l["bind"].(string)
		listener.CaptureMode, _ = l["captureMode"].(string)
		listener.DefaultEndpoint, _ = l["defaultEndpoint"].(string)
		out = append(out, listener)
	}
	return out
}

func extractIstioSidecar(obj *unstructured.Unstructured) IstioSidecarInfo {
	hosts := []string{}
	for _, l := range istioSidecarListeners(obj, "egress") {
		hosts = append(hosts, l.Hosts...)
	}
	policy, _, _ := unstructured.NestedString(obj.Object, "spec", "outboundTrafficPolicy", "mode")
	if policy == "" {
		// Unset falls back to the mesh-wide setting, ALLOW_ANY by default.
		policy = "mesh default"
	}
	return IstioSidecarInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Selector: istioScope(obj, false, "spec", "workloadSelector", "labels"),
		EgressHosts: hosts, OutboundPolicy: policy, CreatedAt: crCreatedAt(obj),
	}
}

// ---------------------------------------------------------------------------
// AuthorizationPolicy
// ---------------------------------------------------------------------------

// IstioAuthorizationRule is one rule with its from, to and when clauses
// rendered as readable lines; a rule matches when every clause does.
type IstioAuthorizationRule struct {
	From []string `json:"from"`
	To   []string `json:"to"`
	When []string `json:"when"`
}

type IstioAuthorizationPolicyInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Action    string `json:"action"`
	Scope     string `json:"scope"`
	Rules     int    `json:"rules"`
	// Effect calls out the two policies whose meaning is not obvious from
	// their rules: ALLOW without rules allows nothing, which denies whatever
	// no other ALLOW policy allows, and an empty rule matches every request.
	Effect    string `json:"effect"`
	CreatedAt string `json:"createdAt"`
}

type IstioAuthorizationPolicyDetail struct {
	IstioAuthorizationPolicyInfo
	SelectorLabels map[string]string        `json:"selectorLabels"`
	TargetRefs     []string                 `json:"targetRefs"`
	Provider       string                   `json:"provider"`
	RuleList       []IstioAuthorizationRule `json:"ruleList"`
	Workloads      IstioWorkloads           `json:"workloads"`
	// MeshWide reports that the policy picks workloads in every namespace.
	MeshWide bool `json:"meshWide"`
}

func (m *ClientManager) ListIstioAuthorizationPolicies(contextName, namespace string) []IstioAuthorizationPolicyInfo {
	return listServedRows(m, contextName, istioAuthorizationPolicyGR, namespace, extractIstioAuthorizationPolicy,
		func(r IstioAuthorizationPolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetIstioAuthorizationPolicy(ctx context.Context, contextName, namespace, name string) (*IstioAuthorizationPolicyDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, istioAuthorizationPolicyGR, namespace, name)
	if err != nil {
		return nil, err
	}
	sel, _ := istioSelector(obj, "spec", "selector", "matchLabels")
	provider, _, _ := unstructured.NestedString(obj.Object, "spec", "provider", "name")
	d := &IstioAuthorizationPolicyDetail{
		IstioAuthorizationPolicyInfo: extractIstioAuthorizationPolicy(obj),
		SelectorLabels:               sel,
		TargetRefs:                   istioTargetRefs(obj),
		Provider:                     provider,
		RuleList:                     []IstioAuthorizationRule{},
		Workloads:                    m.istioPolicyWorkloads(contextName, obj, true, "spec", "selector", "matchLabels"),
		MeshWide:                     istioSelectsAcrossMesh(obj, true, "spec", "selector", "matchLabels"),
	}
	rules, _, _ := nestedSliceNoCopy(obj.Object, "spec", "rules")
	for _, item := range rules {
		r, _ := item.(map[string]any)
		d.RuleList = append(d.RuleList, IstioAuthorizationRule{
			From: istioClauses(r["from"], "source", istioSourceFields),
			To:   istioClauses(r["to"], "operation", istioOperationFields),
			When: istioConditions(r["when"]),
		})
	}
	return d, nil
}

var istioSourceFields = []string{
	"principals", "notPrincipals", "requestPrincipals", "notRequestPrincipals", "namespaces", "notNamespaces",
	"serviceAccounts", "notServiceAccounts", "ipBlocks", "notIpBlocks", "remoteIpBlocks", "notRemoteIpBlocks",
	"trustDomains", "notTrustDomains",
}

var istioOperationFields = []string{"hosts", "notHosts", "ports", "notPorts", "methods", "notMethods", "paths", "notPaths"}

// istioClauses renders each from/to entry as "field: a, b; field: c", its
// fields ANDed as Istio evaluates them.
func istioClauses(raw any, key string, fields []string) []string {
	items, _ := raw.([]any)
	out := make([]string, 0, len(items))
	for _, item := range items {
		entry, _ := item.(map[string]any)
		inner, _ := entry[key].(map[string]any)
		parts := []string{}
		for _, f := range fields {
			if values := stringsAt(inner, f); len(values) > 0 {
				parts = append(parts, f+": "+strings.Join(values, ", "))
			}
		}
		if len(parts) == 0 {
			parts = append(parts, "any")
		}
		out = append(out, strings.Join(parts, "; "))
	}
	return out
}

func istioConditions(raw any) []string {
	items, _ := raw.([]any)
	out := make([]string, 0, len(items))
	for _, item := range items {
		c, _ := item.(map[string]any)
		key, _ := c["key"].(string)
		if values := stringsAt(c, "values"); len(values) > 0 {
			out = append(out, key+" in "+strings.Join(values, ", "))
		}
		if values := stringsAt(c, "notValues"); len(values) > 0 {
			out = append(out, key+" not in "+strings.Join(values, ", "))
		}
	}
	return out
}

func extractIstioAuthorizationPolicy(obj *unstructured.Unstructured) IstioAuthorizationPolicyInfo {
	action, _, _ := unstructured.NestedString(obj.Object, "spec", "action")
	if action == "" {
		action = "ALLOW"
	}
	rules, rulesSet, _ := nestedSliceNoCopy(obj.Object, "spec", "rules")
	effect := ""
	switch {
	case !rulesSet || len(rules) == 0:
		if action == "ALLOW" {
			effect = "Allows no requests (default deny)"
		} else {
			effect = "Matches no requests"
		}
	default:
		for _, r := range rules {
			if m, _ := r.(map[string]any); len(m) == 0 {
				effect = "Matches all requests"
				break
			}
		}
	}
	return IstioAuthorizationPolicyInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Action: action,
		Scope: istioScope(obj, true, "spec", "selector", "matchLabels"), Rules: len(rules), Effect: effect,
		CreatedAt: crCreatedAt(obj),
	}
}

// ---------------------------------------------------------------------------
// RequestAuthentication
// ---------------------------------------------------------------------------

type IstioJWTRule struct {
	Issuer    string   `json:"issuer"`
	Audiences []string `json:"audiences"`
	JWKSURI   string   `json:"jwksUri"`
	// InlineJWKS reports a key set embedded in the spec rather than fetched.
	InlineJWKS           bool     `json:"inlineJwks"`
	FromHeaders          []string `json:"fromHeaders"`
	FromParams           []string `json:"fromParams"`
	FromCookies          []string `json:"fromCookies"`
	ForwardOriginalToken bool     `json:"forwardOriginalToken"`
	OutputPayloadHeader  string   `json:"outputPayloadHeader"`
}

type IstioRequestAuthenticationInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Scope     string   `json:"scope"`
	Issuers   []string `json:"issuers"`
	CreatedAt string   `json:"createdAt"`
}

type IstioRequestAuthenticationDetail struct {
	IstioRequestAuthenticationInfo
	SelectorLabels map[string]string `json:"selectorLabels"`
	TargetRefs     []string          `json:"targetRefs"`
	JWTRules       []IstioJWTRule    `json:"jwtRules"`
	Workloads      IstioWorkloads    `json:"workloads"`
	// MeshWide reports that the policy picks workloads in every namespace.
	MeshWide bool `json:"meshWide"`
}

func (m *ClientManager) ListIstioRequestAuthentications(contextName, namespace string) []IstioRequestAuthenticationInfo {
	return listServedRows(m, contextName, istioRequestAuthenticationGR, namespace, extractIstioRequestAuthentication,
		func(r IstioRequestAuthenticationInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetIstioRequestAuthentication(ctx context.Context, contextName, namespace, name string) (*IstioRequestAuthenticationDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, istioRequestAuthenticationGR, namespace, name)
	if err != nil {
		return nil, err
	}
	sel, _ := istioSelector(obj, "spec", "selector", "matchLabels")
	return &IstioRequestAuthenticationDetail{
		IstioRequestAuthenticationInfo: extractIstioRequestAuthentication(obj),
		SelectorLabels:                 sel,
		TargetRefs:                     istioTargetRefs(obj),
		JWTRules:                       istioJWTRules(obj),
		Workloads:                      m.istioPolicyWorkloads(contextName, obj, true, "spec", "selector", "matchLabels"),
		MeshWide:                       istioSelectsAcrossMesh(obj, true, "spec", "selector", "matchLabels"),
	}, nil
}

func istioJWTRules(obj *unstructured.Unstructured) []IstioJWTRule {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "jwtRules")
	out := make([]IstioJWTRule, 0, len(raw))
	for _, item := range raw {
		r, _ := item.(map[string]any)
		rule := IstioJWTRule{
			Audiences: stringsAt(r, "audiences"), FromHeaders: []string{},
			FromParams: stringsAt(r, "fromParams"), FromCookies: stringsAt(r, "fromCookies"),
		}
		rule.Issuer, _ = r["issuer"].(string)
		rule.JWKSURI, _ = r["jwksUri"].(string)
		jwks, _ := r["jwks"].(string)
		rule.InlineJWKS = jwks != ""
		rule.ForwardOriginalToken, _ = r["forwardOriginalToken"].(bool)
		rule.OutputPayloadHeader, _ = r["outputPayloadToHeader"].(string)
		headers, _ := r["fromHeaders"].([]any)
		for _, h := range headers {
			hm, _ := h.(map[string]any)
			name, _ := hm["name"].(string)
			if prefix, _ := hm["prefix"].(string); prefix != "" {
				name += " (prefix " + strings.TrimSpace(prefix) + ")"
			}
			rule.FromHeaders = append(rule.FromHeaders, name)
		}
		out = append(out, rule)
	}
	return out
}

func extractIstioRequestAuthentication(obj *unstructured.Unstructured) IstioRequestAuthenticationInfo {
	rules := istioJWTRules(obj)
	issuers := make([]string, 0, len(rules))
	for _, r := range rules {
		issuers = append(issuers, r.Issuer)
	}
	return IstioRequestAuthenticationInfo{
		Name: obj.GetName(), Namespace: obj.GetNamespace(), Scope: istioScope(obj, true, "spec", "selector", "matchLabels"),
		Issuers: issuers, CreatedAt: crCreatedAt(obj),
	}
}
