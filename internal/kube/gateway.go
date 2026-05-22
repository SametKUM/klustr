package kube

import (
	"context"
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/tools/cache"

	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
)

// ----------------------------------------------------------------------
// List-row Info structs.
// ----------------------------------------------------------------------

type GatewayInfo struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	Class      string `json:"class"`
	Addresses  string `json:"addresses"`
	Listeners  string `json:"listeners"`
	Programmed string `json:"programmed"`
	CreatedAt  string `json:"createdAt"`
}

type HTTPRouteInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Hostnames string `json:"hostnames"`
	Parents   string `json:"parents"`
	Rules     int    `json:"rules"`
	Accepted  string `json:"accepted"`
	CreatedAt string `json:"createdAt"`
}

type GRPCRouteInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Hostnames string `json:"hostnames"`
	Parents   string `json:"parents"`
	Rules     int    `json:"rules"`
	Accepted  string `json:"accepted"`
	CreatedAt string `json:"createdAt"`
}

type GatewayClassInfo struct {
	Name       string `json:"name"`
	Controller string `json:"controller"`
	Accepted   string `json:"accepted"`
	CreatedAt  string `json:"createdAt"`
}

type ReferenceGrantInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	From      string `json:"from"`
	To        string `json:"to"`
	CreatedAt string `json:"createdAt"`
}

// ----------------------------------------------------------------------
// Detail structs.
// ----------------------------------------------------------------------

type ListenerDetail struct {
	Name              string            `json:"name"`
	Hostname          string            `json:"hostname"`
	Protocol          string            `json:"protocol"`
	Port              int32             `json:"port"`
	AllowedNamespaces string            `json:"allowedNamespaces"`
	AttachedRoutes    int32             `json:"attachedRoutes"`
	Conditions        []ConditionDetail `json:"conditions"`
}

type GatewayDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Class       string            `json:"class"`
	Addresses   []string          `json:"addresses"`
	Listeners   []ListenerDetail  `json:"listeners"`
	Conditions  []ConditionDetail `json:"conditions"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type ParentRefDetail struct {
	Group       string `json:"group"`
	Kind        string `json:"kind"`
	Namespace   string `json:"namespace"`
	Name        string `json:"name"`
	SectionName string `json:"sectionName"`
	Port        int32  `json:"port"`
}

type BackendRefDetail struct {
	Group     string `json:"group"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Port      int32  `json:"port"`
	Weight    int32  `json:"weight"`
}

type HTTPRouteMatchDetail struct {
	PathType    string   `json:"pathType"`
	Path        string   `json:"path"`
	Method      string   `json:"method"`
	Headers     []string `json:"headers"`
	QueryParams []string `json:"queryParams"`
}

type HTTPRouteRuleDetail struct {
	Matches  []HTTPRouteMatchDetail `json:"matches"`
	Backends []BackendRefDetail     `json:"backends"`
}

type RouteParentStatusDetail struct {
	Parent     ParentRefDetail   `json:"parent"`
	Controller string            `json:"controller"`
	Conditions []ConditionDetail `json:"conditions"`
}

type HTTPRouteDetail struct {
	Name        string                    `json:"name"`
	Namespace   string                    `json:"namespace"`
	UID         string                    `json:"uid"`
	Hostnames   []string                  `json:"hostnames"`
	Parents     []ParentRefDetail         `json:"parents"`
	Rules       []HTTPRouteRuleDetail     `json:"rules"`
	Status      []RouteParentStatusDetail `json:"status"`
	Labels      map[string]string         `json:"labels"`
	Annotations map[string]string         `json:"annotations"`
	CreatedAt   string                    `json:"createdAt"`
}

type GRPCRouteMatchDetail struct {
	MethodType string   `json:"methodType"`
	Service    string   `json:"service"`
	Method     string   `json:"method"`
	Headers    []string `json:"headers"`
}

type GRPCRouteRuleDetail struct {
	Matches  []GRPCRouteMatchDetail `json:"matches"`
	Backends []BackendRefDetail     `json:"backends"`
}

type GRPCRouteDetail struct {
	Name        string                    `json:"name"`
	Namespace   string                    `json:"namespace"`
	UID         string                    `json:"uid"`
	Hostnames   []string                  `json:"hostnames"`
	Parents     []ParentRefDetail         `json:"parents"`
	Rules       []GRPCRouteRuleDetail     `json:"rules"`
	Status      []RouteParentStatusDetail `json:"status"`
	Labels      map[string]string         `json:"labels"`
	Annotations map[string]string         `json:"annotations"`
	CreatedAt   string                    `json:"createdAt"`
}

type GatewayClassDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Controller  string            `json:"controller"`
	Description string            `json:"description"`
	Conditions  []ConditionDetail `json:"conditions"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

type ReferenceGrantFromDetail struct {
	Group     string `json:"group"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
}

type ReferenceGrantToDetail struct {
	Group string `json:"group"`
	Kind  string `json:"kind"`
	Name  string `json:"name"`
}

type ReferenceGrantDetail struct {
	Name        string                     `json:"name"`
	Namespace   string                     `json:"namespace"`
	UID         string                     `json:"uid"`
	From        []ReferenceGrantFromDetail `json:"from"`
	To          []ReferenceGrantToDetail   `json:"to"`
	Labels      map[string]string          `json:"labels"`
	Annotations map[string]string          `json:"annotations"`
	CreatedAt   string                     `json:"createdAt"`
}

// ----------------------------------------------------------------------
// Discovery + informer setup.
// ----------------------------------------------------------------------

// hasGatewayAPIGroup probes discovery for the gateway.networking.k8s.io API
// group. We gate Gateway API informer registration behind this so clusters
// without Gateway API CRDs do not have the reflector spam "no matches" log
// lines.
func hasGatewayAPIGroup(d discovery.DiscoveryInterface) bool {
	groups, err := d.ServerGroups()
	if err != nil {
		return false
	}
	for _, g := range groups.Groups {
		if g.Name == "gateway.networking.k8s.io" {
			return true
		}
	}
	return false
}

func (w *contextWatcher) startGatewayInformers(ctx context.Context) error {
	if w.gwFactory == nil {
		return nil
	}
	// Gateway API uses a single typed factory across all five kinds. If the
	// user can't list any of them cluster-wide we'd loop-spam the log just
	// like the built-in factories would; drop the whole factory in that
	// case. A future enhancement could route per-kind like the built-in
	// factory does.
	gvr := kindToGVR["Gateway"]
	if !canList(ctx, w.cs, gvr, "") {
		w.gwFactory = nil
		return nil
	}
	gateways := w.gwFactory.Gateway().V1().Gateways().Informer()
	if _, err := gateways.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Gateway") },
		UpdateFunc: func(any, any) { w.touch("Gateway") },
		DeleteFunc: func(any) { w.touch("Gateway") },
	}); err != nil {
		return err
	}
	httpRoutes := w.gwFactory.Gateway().V1().HTTPRoutes().Informer()
	if _, err := httpRoutes.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("HTTPRoute") },
		UpdateFunc: func(any, any) { w.touch("HTTPRoute") },
		DeleteFunc: func(any) { w.touch("HTTPRoute") },
	}); err != nil {
		return err
	}
	grpcRoutes := w.gwFactory.Gateway().V1().GRPCRoutes().Informer()
	if _, err := grpcRoutes.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("GRPCRoute") },
		UpdateFunc: func(any, any) { w.touch("GRPCRoute") },
		DeleteFunc: func(any) { w.touch("GRPCRoute") },
	}); err != nil {
		return err
	}
	gwClasses := w.gwFactory.Gateway().V1().GatewayClasses().Informer()
	if _, err := gwClasses.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("GatewayClass") },
		UpdateFunc: func(any, any) { w.touch("GatewayClass") },
		DeleteFunc: func(any) { w.touch("GatewayClass") },
	}); err != nil {
		return err
	}
	refGrants := w.gwFactory.Gateway().V1().ReferenceGrants().Informer()
	if _, err := refGrants.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("ReferenceGrant") },
		UpdateFunc: func(any, any) { w.touch("ReferenceGrant") },
		DeleteFunc: func(any) { w.touch("ReferenceGrant") },
	}); err != nil {
		return err
	}
	w.gwFactory.Start(ctx.Done())
	go func() {
		w.gwFactory.WaitForCacheSync(ctx.Done())
		for _, kind := range []string{"Gateway", "HTTPRoute", "GRPCRoute", "GatewayClass", "ReferenceGrant"} {
			w.touch(kind)
		}
	}()
	return nil
}

// ----------------------------------------------------------------------
// Listers — Gateways.
// ----------------------------------------------------------------------

func (w *contextWatcher) Gateways(namespace string) []GatewayInfo {
	if w.gwFactory == nil {
		return []GatewayInfo{}
	}
	lister := w.gwFactory.Gateway().V1().Gateways().Lister()
	var (
		list []*gatewayv1.Gateway
		err  error
	)
	if namespace == "" {
		list, err = lister.List(labels.Everything())
	} else {
		list, err = lister.Gateways(namespace).List(labels.Everything())
	}
	if err != nil {
		return []GatewayInfo{}
	}
	out := make([]GatewayInfo, 0, len(list))
	for _, g := range list {
		addresses := make([]string, 0, len(g.Status.Addresses))
		for _, a := range g.Status.Addresses {
			if a.Value != "" {
				addresses = append(addresses, a.Value)
			}
		}
		listeners := make([]string, 0, len(g.Spec.Listeners))
		for _, l := range g.Spec.Listeners {
			listeners = append(listeners, fmt.Sprintf("%s:%d/%s", l.Name, l.Port, l.Protocol))
		}
		out = append(out, GatewayInfo{
			Name:       g.Name,
			Namespace:  g.Namespace,
			Class:      string(g.Spec.GatewayClassName),
			Addresses:  strings.Join(addresses, ", "),
			Listeners:  strings.Join(listeners, ", "),
			Programmed: conditionStatus(g.Status.Conditions, "Programmed"),
			CreatedAt:  g.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) Gateway(namespace, name string) (*GatewayDetail, error) {
	if w.gwFactory == nil {
		return nil, fmt.Errorf("gateway api not available in this cluster")
	}
	g, err := w.gwFactory.Gateway().V1().Gateways().Lister().Gateways(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	listenerStatus := make(map[string]gatewayv1.ListenerStatus, len(g.Status.Listeners))
	for _, ls := range g.Status.Listeners {
		listenerStatus[string(ls.Name)] = ls
	}
	listeners := make([]ListenerDetail, 0, len(g.Spec.Listeners))
	for _, l := range g.Spec.Listeners {
		hostname := ""
		if l.Hostname != nil {
			hostname = string(*l.Hostname)
		}
		allowed := ""
		if l.AllowedRoutes != nil && l.AllowedRoutes.Namespaces != nil && l.AllowedRoutes.Namespaces.From != nil {
			allowed = string(*l.AllowedRoutes.Namespaces.From)
		}
		var attached int32
		var conds []ConditionDetail
		if ls, ok := listenerStatus[string(l.Name)]; ok {
			attached = ls.AttachedRoutes
			conds = conditionsToDetail(ls.Conditions)
		}
		listeners = append(listeners, ListenerDetail{
			Name:              string(l.Name),
			Hostname:          hostname,
			Protocol:          string(l.Protocol),
			Port:              int32(l.Port),
			AllowedNamespaces: allowed,
			AttachedRoutes:    attached,
			Conditions:        conds,
		})
	}
	addresses := make([]string, 0, len(g.Status.Addresses))
	for _, a := range g.Status.Addresses {
		if a.Value != "" {
			addresses = append(addresses, a.Value)
		}
	}
	return &GatewayDetail{
		Name:        g.Name,
		Namespace:   g.Namespace,
		UID:         string(g.UID),
		Class:       string(g.Spec.GatewayClassName),
		Addresses:   addresses,
		Listeners:   listeners,
		Conditions:  conditionsToDetail(g.Status.Conditions),
		Labels:      g.Labels,
		Annotations: g.Annotations,
		CreatedAt:   g.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

// ----------------------------------------------------------------------
// Listers — HTTPRoutes.
// ----------------------------------------------------------------------

func (w *contextWatcher) HTTPRoutes(namespace string) []HTTPRouteInfo {
	if w.gwFactory == nil {
		return []HTTPRouteInfo{}
	}
	lister := w.gwFactory.Gateway().V1().HTTPRoutes().Lister()
	var (
		list []*gatewayv1.HTTPRoute
		err  error
	)
	if namespace == "" {
		list, err = lister.List(labels.Everything())
	} else {
		list, err = lister.HTTPRoutes(namespace).List(labels.Everything())
	}
	if err != nil {
		return []HTTPRouteInfo{}
	}
	out := make([]HTTPRouteInfo, 0, len(list))
	for _, r := range list {
		hostnames := make([]string, 0, len(r.Spec.Hostnames))
		for _, h := range r.Spec.Hostnames {
			hostnames = append(hostnames, string(h))
		}
		parents := make([]string, 0, len(r.Spec.ParentRefs))
		for _, p := range r.Spec.ParentRefs {
			parents = append(parents, formatParentRefShort(p, r.Namespace))
		}
		out = append(out, HTTPRouteInfo{
			Name:      r.Name,
			Namespace: r.Namespace,
			Hostnames: strings.Join(hostnames, ", "),
			Parents:   strings.Join(parents, ", "),
			Rules:     len(r.Spec.Rules),
			Accepted:  anyParentConditionStatus(r.Status.Parents, "Accepted"),
			CreatedAt: r.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) HTTPRoute(namespace, name string) (*HTTPRouteDetail, error) {
	if w.gwFactory == nil {
		return nil, fmt.Errorf("gateway api not available in this cluster")
	}
	r, err := w.gwFactory.Gateway().V1().HTTPRoutes().Lister().HTTPRoutes(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	hostnames := make([]string, 0, len(r.Spec.Hostnames))
	for _, h := range r.Spec.Hostnames {
		hostnames = append(hostnames, string(h))
	}
	parents := make([]ParentRefDetail, 0, len(r.Spec.ParentRefs))
	for _, p := range r.Spec.ParentRefs {
		parents = append(parents, parentRefDetail(p, r.Namespace))
	}
	rules := make([]HTTPRouteRuleDetail, 0, len(r.Spec.Rules))
	for _, ru := range r.Spec.Rules {
		matches := make([]HTTPRouteMatchDetail, 0, len(ru.Matches))
		for _, m := range ru.Matches {
			pt, path := "", ""
			if m.Path != nil {
				if m.Path.Type != nil {
					pt = string(*m.Path.Type)
				}
				if m.Path.Value != nil {
					path = *m.Path.Value
				}
			}
			method := ""
			if m.Method != nil {
				method = string(*m.Method)
			}
			headers := make([]string, 0, len(m.Headers))
			for _, h := range m.Headers {
				headers = append(headers, fmt.Sprintf("%s=%s", h.Name, h.Value))
			}
			qps := make([]string, 0, len(m.QueryParams))
			for _, q := range m.QueryParams {
				qps = append(qps, fmt.Sprintf("%s=%s", q.Name, q.Value))
			}
			matches = append(matches, HTTPRouteMatchDetail{
				PathType:    pt,
				Path:        path,
				Method:      method,
				Headers:     headers,
				QueryParams: qps,
			})
		}
		backends := make([]BackendRefDetail, 0, len(ru.BackendRefs))
		for _, b := range ru.BackendRefs {
			backends = append(backends, backendRefDetail(b.BackendRef, r.Namespace, b.Weight))
		}
		rules = append(rules, HTTPRouteRuleDetail{Matches: matches, Backends: backends})
	}
	status := routeParentStatusDetail(r.Status.Parents, r.Namespace)
	return &HTTPRouteDetail{
		Name:        r.Name,
		Namespace:   r.Namespace,
		UID:         string(r.UID),
		Hostnames:   hostnames,
		Parents:     parents,
		Rules:       rules,
		Status:      status,
		Labels:      r.Labels,
		Annotations: r.Annotations,
		CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

// ----------------------------------------------------------------------
// Listers — GRPCRoutes.
// ----------------------------------------------------------------------

func (w *contextWatcher) GRPCRoutes(namespace string) []GRPCRouteInfo {
	if w.gwFactory == nil {
		return []GRPCRouteInfo{}
	}
	lister := w.gwFactory.Gateway().V1().GRPCRoutes().Lister()
	var (
		list []*gatewayv1.GRPCRoute
		err  error
	)
	if namespace == "" {
		list, err = lister.List(labels.Everything())
	} else {
		list, err = lister.GRPCRoutes(namespace).List(labels.Everything())
	}
	if err != nil {
		return []GRPCRouteInfo{}
	}
	out := make([]GRPCRouteInfo, 0, len(list))
	for _, r := range list {
		hostnames := make([]string, 0, len(r.Spec.Hostnames))
		for _, h := range r.Spec.Hostnames {
			hostnames = append(hostnames, string(h))
		}
		parents := make([]string, 0, len(r.Spec.ParentRefs))
		for _, p := range r.Spec.ParentRefs {
			parents = append(parents, formatParentRefShort(p, r.Namespace))
		}
		out = append(out, GRPCRouteInfo{
			Name:      r.Name,
			Namespace: r.Namespace,
			Hostnames: strings.Join(hostnames, ", "),
			Parents:   strings.Join(parents, ", "),
			Rules:     len(r.Spec.Rules),
			Accepted:  anyParentConditionStatus(r.Status.Parents, "Accepted"),
			CreatedAt: r.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) GRPCRoute(namespace, name string) (*GRPCRouteDetail, error) {
	if w.gwFactory == nil {
		return nil, fmt.Errorf("gateway api not available in this cluster")
	}
	r, err := w.gwFactory.Gateway().V1().GRPCRoutes().Lister().GRPCRoutes(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	hostnames := make([]string, 0, len(r.Spec.Hostnames))
	for _, h := range r.Spec.Hostnames {
		hostnames = append(hostnames, string(h))
	}
	parents := make([]ParentRefDetail, 0, len(r.Spec.ParentRefs))
	for _, p := range r.Spec.ParentRefs {
		parents = append(parents, parentRefDetail(p, r.Namespace))
	}
	rules := make([]GRPCRouteRuleDetail, 0, len(r.Spec.Rules))
	for _, ru := range r.Spec.Rules {
		matches := make([]GRPCRouteMatchDetail, 0, len(ru.Matches))
		for _, m := range ru.Matches {
			mt, svc, method := "", "", ""
			if m.Method != nil {
				if m.Method.Type != nil {
					mt = string(*m.Method.Type)
				}
				if m.Method.Service != nil {
					svc = *m.Method.Service
				}
				if m.Method.Method != nil {
					method = *m.Method.Method
				}
			}
			headers := make([]string, 0, len(m.Headers))
			for _, h := range m.Headers {
				headers = append(headers, fmt.Sprintf("%s=%s", h.Name, h.Value))
			}
			matches = append(matches, GRPCRouteMatchDetail{
				MethodType: mt,
				Service:    svc,
				Method:     method,
				Headers:    headers,
			})
		}
		backends := make([]BackendRefDetail, 0, len(ru.BackendRefs))
		for _, b := range ru.BackendRefs {
			backends = append(backends, backendRefDetail(b.BackendRef, r.Namespace, b.Weight))
		}
		rules = append(rules, GRPCRouteRuleDetail{Matches: matches, Backends: backends})
	}
	status := routeParentStatusDetail(r.Status.Parents, r.Namespace)
	return &GRPCRouteDetail{
		Name:        r.Name,
		Namespace:   r.Namespace,
		UID:         string(r.UID),
		Hostnames:   hostnames,
		Parents:     parents,
		Rules:       rules,
		Status:      status,
		Labels:      r.Labels,
		Annotations: r.Annotations,
		CreatedAt:   r.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

// ----------------------------------------------------------------------
// Listers — GatewayClasses (cluster-scoped).
// ----------------------------------------------------------------------

func (w *contextWatcher) GatewayClasses() []GatewayClassInfo {
	if w.gwFactory == nil {
		return []GatewayClassInfo{}
	}
	list, err := w.gwFactory.Gateway().V1().GatewayClasses().Lister().List(labels.Everything())
	if err != nil {
		return []GatewayClassInfo{}
	}
	out := make([]GatewayClassInfo, 0, len(list))
	for _, c := range list {
		out = append(out, GatewayClassInfo{
			Name:       c.Name,
			Controller: string(c.Spec.ControllerName),
			Accepted:   conditionStatus(c.Status.Conditions, "Accepted"),
			CreatedAt:  c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return "", out[i].Name })
	return out
}

func (w *contextWatcher) GatewayClass(name string) (*GatewayClassDetail, error) {
	if w.gwFactory == nil {
		return nil, fmt.Errorf("gateway api not available in this cluster")
	}
	c, err := w.gwFactory.Gateway().V1().GatewayClasses().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	desc := ""
	if c.Spec.Description != nil {
		desc = *c.Spec.Description
	}
	return &GatewayClassDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Controller:  string(c.Spec.ControllerName),
		Description: desc,
		Conditions:  conditionsToDetail(c.Status.Conditions),
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

// ----------------------------------------------------------------------
// Listers — ReferenceGrants.
// ----------------------------------------------------------------------

func (w *contextWatcher) ReferenceGrants(namespace string) []ReferenceGrantInfo {
	if w.gwFactory == nil {
		return []ReferenceGrantInfo{}
	}
	lister := w.gwFactory.Gateway().V1().ReferenceGrants().Lister()
	var (
		list []*gatewayv1.ReferenceGrant
		err  error
	)
	if namespace == "" {
		list, err = lister.List(labels.Everything())
	} else {
		list, err = lister.ReferenceGrants(namespace).List(labels.Everything())
	}
	if err != nil {
		return []ReferenceGrantInfo{}
	}
	out := make([]ReferenceGrantInfo, 0, len(list))
	for _, g := range list {
		froms := make([]string, 0, len(g.Spec.From))
		for _, f := range g.Spec.From {
			froms = append(froms, fmt.Sprintf("%s/%s", string(f.Namespace), string(f.Kind)))
		}
		tos := make([]string, 0, len(g.Spec.To))
		for _, t := range g.Spec.To {
			name := "*"
			if t.Name != nil && *t.Name != "" {
				name = string(*t.Name)
			}
			tos = append(tos, fmt.Sprintf("%s/%s", string(t.Kind), name))
		}
		out = append(out, ReferenceGrantInfo{
			Name:      g.Name,
			Namespace: g.Namespace,
			From:      strings.Join(froms, ", "),
			To:        strings.Join(tos, ", "),
			CreatedAt: g.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) ReferenceGrant(namespace, name string) (*ReferenceGrantDetail, error) {
	if w.gwFactory == nil {
		return nil, fmt.Errorf("gateway api not available in this cluster")
	}
	g, err := w.gwFactory.Gateway().V1().ReferenceGrants().Lister().ReferenceGrants(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	froms := make([]ReferenceGrantFromDetail, 0, len(g.Spec.From))
	for _, f := range g.Spec.From {
		froms = append(froms, ReferenceGrantFromDetail{
			Group:     string(f.Group),
			Kind:      string(f.Kind),
			Namespace: string(f.Namespace),
		})
	}
	tos := make([]ReferenceGrantToDetail, 0, len(g.Spec.To))
	for _, t := range g.Spec.To {
		name := ""
		if t.Name != nil {
			name = string(*t.Name)
		}
		tos = append(tos, ReferenceGrantToDetail{
			Group: string(t.Group),
			Kind:  string(t.Kind),
			Name:  name,
		})
	}
	return &ReferenceGrantDetail{
		Name:        g.Name,
		Namespace:   g.Namespace,
		UID:         string(g.UID),
		From:        froms,
		To:          tos,
		Labels:      g.Labels,
		Annotations: g.Annotations,
		CreatedAt:   g.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

// ----------------------------------------------------------------------
// Helpers.
// ----------------------------------------------------------------------

func conditionStatus(conds []metav1.Condition, kind string) string {
	for _, c := range conds {
		if c.Type == kind {
			return string(c.Status)
		}
	}
	return ""
}

func anyParentConditionStatus(parents []gatewayv1.RouteParentStatus, kind string) string {
	// Routes are accepted by parent. We report "True" if any parent accepts,
	// "False" if any rejects (and none accept), otherwise the first non-empty
	// status — empty if no parent has the condition yet.
	hasFalse, hasUnknown := false, false
	for _, p := range parents {
		s := conditionStatus(p.Conditions, kind)
		switch s {
		case "True":
			return "True"
		case "False":
			hasFalse = true
		case "Unknown":
			hasUnknown = true
		}
	}
	switch {
	case hasFalse:
		return "False"
	case hasUnknown:
		return "Unknown"
	}
	return ""
}

func conditionsToDetail(conds []metav1.Condition) []ConditionDetail {
	out := make([]ConditionDetail, 0, len(conds))
	for _, c := range conds {
		out = append(out, ConditionDetail{
			Type:    c.Type,
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}
	return out
}

func parentRefDetail(p gatewayv1.ParentReference, defaultNS string) ParentRefDetail {
	out := ParentRefDetail{
		Name:      string(p.Name),
		Namespace: defaultNS,
	}
	if p.Group != nil {
		out.Group = string(*p.Group)
	}
	if p.Kind != nil {
		out.Kind = string(*p.Kind)
	}
	if p.Namespace != nil {
		out.Namespace = string(*p.Namespace)
	}
	if p.SectionName != nil {
		out.SectionName = string(*p.SectionName)
	}
	if p.Port != nil {
		out.Port = int32(*p.Port)
	}
	return out
}

func formatParentRefShort(p gatewayv1.ParentReference, defaultNS string) string {
	ns := defaultNS
	if p.Namespace != nil {
		ns = string(*p.Namespace)
	}
	if ns == defaultNS {
		return string(p.Name)
	}
	return ns + "/" + string(p.Name)
}

func backendRefDetail(b gatewayv1.BackendRef, defaultNS string, weight *int32) BackendRefDetail {
	out := BackendRefDetail{
		Name:      string(b.Name),
		Namespace: defaultNS,
		Kind:      "Service",
	}
	if b.Group != nil {
		out.Group = string(*b.Group)
	}
	if b.Kind != nil {
		out.Kind = string(*b.Kind)
	}
	if b.Namespace != nil {
		out.Namespace = string(*b.Namespace)
	}
	if b.Port != nil {
		out.Port = int32(*b.Port)
	}
	if weight != nil {
		out.Weight = *weight
	} else if b.Weight != nil {
		out.Weight = *b.Weight
	}
	return out
}

func routeParentStatusDetail(parents []gatewayv1.RouteParentStatus, defaultNS string) []RouteParentStatusDetail {
	out := make([]RouteParentStatusDetail, 0, len(parents))
	for _, p := range parents {
		out = append(out, RouteParentStatusDetail{
			Parent:     parentRefDetail(p.ParentRef, defaultNS),
			Controller: string(p.ControllerName),
			Conditions: conditionsToDetail(p.Conditions),
		})
	}
	return out
}
