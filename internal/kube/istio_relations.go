package kube

import (
	"sort"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
)

// maxIstioWorkloads caps the pods listed per selector; the count says how
// many matched in all.
const maxIstioWorkloads = 50

// IstioObjectRef points at a Kubernetes object an Istio resource names.
type IstioObjectRef struct {
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

// IstioServiceRef is a host an Istio resource routes to and the cluster
// Service it resolves to; Namespace and Name are "" when the host is not a
// Service of this cluster (a ServiceEntry, an external name, a wildcard).
type IstioServiceRef struct {
	Host      string `json:"host"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

// IstioWorkloads are the pods a selector picks, at most maxIstioWorkloads of
// Total.
type IstioWorkloads struct {
	Pods  []IstioObjectRef `json:"pods"`
	Total int              `json:"total"`
}

// istioRootNamespace is Istio's default root namespace. Klustr does not read
// the mesh config, so a mesh that moves it gets namespace-local results.
const istioRootNamespace = "istio-system"

// istioServiceHost reads the Service a host names, the way Istio resolves it:
// a short name in the config's namespace, or a
// "name.namespace.svc.<cluster domain>" FQDN. Istio expands only dotless
// names, so "name.namespace" and "name.namespace.svc" name no Service.
func istioServiceHost(host, namespace string) (ns, name string, ok bool) {
	if host == "" || strings.Contains(host, "*") {
		return "", "", false
	}
	parts := strings.Split(host, ".")
	switch {
	case len(parts) == 1:
		return namespace, parts[0], true
	case len(parts) >= 4 && parts[2] == "svc":
		return parts[1], parts[0], true
	}
	return "", "", false
}

// istioService returns the cached Service a host resolves to.
func (w *contextWatcher) istioService(host, namespace string) (*corev1.Service, bool) {
	ns, name, ok := istioServiceHost(host, namespace)
	if !ok {
		return nil, false
	}
	f := w.factoryFor("Service")
	if f == nil {
		return nil, false
	}
	svc, err := f.Core().V1().Services().Lister().Services(ns).Get(name)
	if err != nil {
		return nil, false
	}
	return svc, true
}

func (m *ClientManager) istioServiceRef(contextName, host, namespace string) IstioServiceRef {
	ref := IstioServiceRef{Host: host}
	w, ok := m.watcher(contextName)
	if !ok {
		return ref
	}
	if svc, found := w.istioService(host, namespace); found {
		ref.Namespace, ref.Name = svc.Namespace, svc.Name
	}
	return ref
}

// istioWorkloads lists the cached pods in namespace ("" for every namespace)
// whose labels match sel. A nil sel selects nothing: callers pass the
// namespace-wide case explicitly.
func (m *ClientManager) istioWorkloads(contextName, namespace string, sel map[string]string) IstioWorkloads {
	out := IstioWorkloads{Pods: []IstioObjectRef{}}
	w, ok := m.watcher(contextName)
	if !ok || sel == nil {
		return out
	}
	f := w.factoryFor("Pod")
	if f == nil {
		return out
	}
	selector := labels.SelectorFromSet(sel)
	var pods []*corev1.Pod
	var err error
	if namespace == "" {
		pods, err = f.Core().V1().Pods().Lister().List(selector)
	} else {
		pods, err = f.Core().V1().Pods().Lister().Pods(namespace).List(selector)
	}
	if err != nil {
		return out
	}
	sort.Slice(pods, func(i, j int) bool {
		if pods[i].Namespace != pods[j].Namespace {
			return pods[i].Namespace < pods[j].Namespace
		}
		return pods[i].Name < pods[j].Name
	})
	out.Total = len(pods)
	for _, p := range pods {
		if len(out.Pods) == maxIstioWorkloads {
			break
		}
		out.Pods = append(out.Pods, IstioObjectRef{Namespace: p.Namespace, Name: p.Name})
	}
	return out
}

// istioSelector reads a matchLabels-style map at path. found is false when
// the field is absent, which for most Istio kinds means "every workload in
// the namespace".
func istioSelector(obj *unstructured.Unstructured, path ...string) (map[string]string, bool) {
	sel, found, _ := unstructured.NestedStringMap(obj.Object, path...)
	if !found || len(sel) == 0 {
		return map[string]string{}, false
	}
	return sel, true
}

// istioSubsetSelector is a Service selector narrowed by a subset's labels, or
// nil when the two disagree on a key: no pod carries both values.
func istioSubsetSelector(service, subset map[string]string) map[string]string {
	sel := make(map[string]string, len(service)+len(subset))
	for k, v := range service {
		sel[k] = v
	}
	for k, v := range subset {
		if cur, ok := sel[k]; ok && cur != v {
			return nil
		}
		sel[k] = v
	}
	return sel
}

func selectorString(sel map[string]string) string {
	pairs := make([]string, 0, len(sel))
	for k, v := range sel {
		pairs = append(pairs, k+"="+v)
	}
	sort.Strings(pairs)
	return strings.Join(pairs, ", ")
}

// istioTargetRefs reads targetRefs, or the deprecated single targetRef, as
// "Kind/name" strings.
func istioTargetRefs(obj *unstructured.Unstructured) []string {
	out := []string{}
	refs, _, _ := nestedSliceNoCopy(obj.Object, "spec", "targetRefs")
	if single, ok, _ := nestedMapNoCopy(obj.Object, "spec", "targetRef"); ok && single != nil {
		refs = append(refs, single)
	}
	for _, item := range refs {
		r, _ := item.(map[string]any)
		kind, _ := r["kind"].(string)
		name, _ := r["name"].(string)
		if name == "" {
			continue
		}
		if ns, _ := r["namespace"].(string); ns != "" {
			name = ns + "/" + name
		}
		out = append(out, kind+"/"+name)
	}
	return out
}

// istioSelectsAcrossMesh reports whether a selector-scoped policy picks
// workloads in every namespace. Istio applies a selector-less policy in the
// root namespace to the whole mesh. AuthorizationPolicy and
// RequestAuthentication (rootSelectorMeshWide) also match a root-namespace
// selector against every namespace's workloads; a Sidecar's workloadSelector
// stays within its own namespace.
func istioSelectsAcrossMesh(obj *unstructured.Unstructured, rootSelectorMeshWide bool, selectorPath ...string) bool {
	if obj.GetNamespace() != istioRootNamespace || len(istioTargetRefs(obj)) > 0 {
		return false
	}
	_, hasSelector := istioSelector(obj, selectorPath...)
	return !hasSelector || rootSelectorMeshWide
}

// istioScope describes which workloads a selector-or-targetRefs policy
// applies to.
func istioScope(obj *unstructured.Unstructured, rootSelectorMeshWide bool, selectorPath ...string) string {
	if refs := istioTargetRefs(obj); len(refs) > 0 {
		return strings.Join(refs, ", ")
	}
	meshWide := istioSelectsAcrossMesh(obj, rootSelectorMeshWide, selectorPath...)
	if sel, ok := istioSelector(obj, selectorPath...); ok {
		if meshWide {
			return selectorString(sel) + " (all namespaces)"
		}
		return selectorString(sel)
	}
	if meshWide {
		return "mesh-wide"
	}
	return "namespace-wide"
}

// istioPolicyWorkloads lists the pods a selector-scoped policy applies to,
// or every pod of its namespace when it has neither selector nor targetRefs,
// searching every namespace when istioSelectsAcrossMesh says so. Policies
// attached through targetRefs apply at a gateway or waypoint and list none.
func (m *ClientManager) istioPolicyWorkloads(contextName string, obj *unstructured.Unstructured, rootSelectorMeshWide bool, selectorPath ...string) IstioWorkloads {
	if len(istioTargetRefs(obj)) > 0 {
		return IstioWorkloads{Pods: []IstioObjectRef{}}
	}
	sel, _ := istioSelector(obj, selectorPath...)
	ns := obj.GetNamespace()
	if istioSelectsAcrossMesh(obj, rootSelectorMeshWide, selectorPath...) {
		ns = ""
	}
	return m.istioWorkloads(contextName, ns, sel)
}
