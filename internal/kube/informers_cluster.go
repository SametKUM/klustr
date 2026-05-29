package kube

import (
	"sort"
	"strings"
	"time"

	coordv1 "k8s.io/api/coordination/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type NamespaceInfo struct {
	Name      string `json:"name"`
	Phase     string `json:"phase"`
	CreatedAt string `json:"createdAt"`
}

type NodeInfo struct {
	Name         string `json:"name"`
	Status       string `json:"status"`
	Roles        string `json:"roles"`
	Version      string `json:"version"`
	OSImage      string `json:"osImage"`
	InternalIP   string `json:"internalIP"`
	InstanceType string `json:"instanceType"`
	CapacityType string `json:"capacityType"`
	NodePool     string `json:"nodePool"`
	CreatedAt    string `json:"createdAt"`
}

type LeaseInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Holder    string `json:"holder"`
	CreatedAt string `json:"createdAt"`
}

type RuntimeClassInfo struct {
	Name      string `json:"name"`
	Handler   string `json:"handler"`
	CreatedAt string `json:"createdAt"`
}

type PriorityClassInfo struct {
	Name          string `json:"name"`
	Value         int32  `json:"value"`
	GlobalDefault bool   `json:"globalDefault"`
	Description   string `json:"description"`
	CreatedAt     string `json:"createdAt"`
}

type IngressClassInfo struct {
	Name       string `json:"name"`
	Controller string `json:"controller"`
	IsDefault  bool   `json:"isDefault"`
	CreatedAt  string `json:"createdAt"`
}

type FlowSchemaInfo struct {
	Name               string `json:"name"`
	PriorityLevel      string `json:"priorityLevel"`
	MatchingPrecedence int32  `json:"matchingPrecedence"`
	Distinguisher      string `json:"distinguisher"`
	CreatedAt          string `json:"createdAt"`
}

type PriorityLevelConfigurationInfo struct {
	Name                     string `json:"name"`
	Type                     string `json:"type"`
	NominalConcurrencyShares int32  `json:"nominalConcurrencyShares"`
	LimitResponse            string `json:"limitResponse"`
	CreatedAt                string `json:"createdAt"`
}

type LimitRangeInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Limits    int    `json:"limits"`
	CreatedAt string `json:"createdAt"`
}

type ResourceQuotaInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Scopes    string `json:"scopes"`
	Used      int    `json:"used"`
	Hard      int    `json:"hard"`
	CreatedAt string `json:"createdAt"`
}

func (w *contextWatcher) Namespaces() []NamespaceInfo {
	f := w.factoryFor("Namespace")
	if f == nil {
		// Restricted user with no cluster-wide list — fall back to the
		// kubeconfig-supplied default namespace so the selector has at
		// least one row.
		if w.defaultNS != "" {
			return []NamespaceInfo{{Name: w.defaultNS, Phase: "Active"}}
		}
		return []NamespaceInfo{}
	}
	list, err := f.Core().V1().Namespaces().Lister().List(labels.Everything())
	if err != nil {
		return []NamespaceInfo{}
	}
	out := make([]NamespaceInfo, 0, len(list))
	for _, ns := range list {
		out = append(out, NamespaceInfo{
			Name:      ns.Name,
			Phase:     string(ns.Status.Phase),
			CreatedAt: ns.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) Nodes() []NodeInfo {
	f := w.factoryFor("Node")
	if f == nil {
		return []NodeInfo{}
	}
	list, err := f.Core().V1().Nodes().Lister().List(labels.Everything())
	if err != nil {
		return []NodeInfo{}
	}
	out := make([]NodeInfo, 0, len(list))
	for _, n := range list {
		out = append(out, nodeInfo(n))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// NodesForNodePool lists the nodes a Karpenter NodePool currently owns. Karpenter
// stamps every node it provisions with the karpenter.sh/nodepool label, so a label
// selector is the authoritative join — there is no owner reference from Node back
// to NodePool.
func (w *contextWatcher) NodesForNodePool(nodePoolName string) []NodeInfo {
	f := w.factoryFor("Node")
	if f == nil {
		return []NodeInfo{}
	}
	sel := labels.SelectorFromSet(labels.Set{"karpenter.sh/nodepool": nodePoolName})
	list, err := f.Core().V1().Nodes().Lister().List(sel)
	if err != nil {
		return []NodeInfo{}
	}
	out := make([]NodeInfo, 0, len(list))
	for _, n := range list {
		out = append(out, nodeInfo(n))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// NodeInfoByName returns a one-element slice for the named node, or empty when
// it is not in cache. The slice shape lets the Karpenter detail views share the
// same node-table renderer the NodePool view uses.
func (w *contextWatcher) NodeInfoByName(name string) []NodeInfo {
	f := w.factoryFor("Node")
	if f == nil {
		return []NodeInfo{}
	}
	n, err := f.Core().V1().Nodes().Lister().Get(name)
	if err != nil {
		return []NodeInfo{}
	}
	return []NodeInfo{nodeInfo(n)}
}

func nodeInfo(n *corev1.Node) NodeInfo {
	return NodeInfo{
		Name:         n.Name,
		Status:       nodeStatus(n),
		Roles:        nodeRoles(n),
		Version:      n.Status.NodeInfo.KubeletVersion,
		OSImage:      n.Status.NodeInfo.OSImage,
		InternalIP:   nodeInternalIP(n),
		InstanceType: nodeInstanceType(n),
		CapacityType: nodeCapacityType(n),
		NodePool:     nodeNodePool(n),
		CreatedAt:    n.CreationTimestamp.UTC().Format(time.RFC3339),
	}
}

func (w *contextWatcher) Leases(namespace string) []LeaseInfo {
	f := w.factoryFor("Lease")
	if f == nil {
		return []LeaseInfo{}
	}
	lister := f.Coordination().V1().Leases().Lister()
	var (
		leases []*coordv1.Lease
		err    error
	)
	if namespace == "" {
		leases, err = lister.List(labels.Everything())
	} else {
		leases, err = lister.Leases(namespace).List(labels.Everything())
	}
	if err != nil {
		return []LeaseInfo{}
	}
	out := make([]LeaseInfo, 0, len(leases))
	for _, l := range leases {
		holder := ""
		if l.Spec.HolderIdentity != nil {
			holder = *l.Spec.HolderIdentity
		}
		out = append(out, LeaseInfo{
			Name:      l.Name,
			Namespace: l.Namespace,
			Holder:    holder,
			CreatedAt: l.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) RuntimeClasses() []RuntimeClassInfo {
	f := w.factoryFor("RuntimeClass")
	if f == nil {
		return []RuntimeClassInfo{}
	}
	rcs, err := f.Node().V1().RuntimeClasses().Lister().List(labels.Everything())
	if err != nil {
		return []RuntimeClassInfo{}
	}
	out := make([]RuntimeClassInfo, 0, len(rcs))
	for _, r := range rcs {
		out = append(out, RuntimeClassInfo{
			Name:      r.Name,
			Handler:   r.Handler,
			CreatedAt: r.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) PriorityClasses() []PriorityClassInfo {
	f := w.factoryFor("PriorityClass")
	if f == nil {
		return []PriorityClassInfo{}
	}
	pcs, err := f.Scheduling().V1().PriorityClasses().Lister().List(labels.Everything())
	if err != nil {
		return []PriorityClassInfo{}
	}
	out := make([]PriorityClassInfo, 0, len(pcs))
	for _, p := range pcs {
		out = append(out, PriorityClassInfo{
			Name:          p.Name,
			Value:         p.Value,
			GlobalDefault: p.GlobalDefault,
			Description:   p.Description,
			CreatedAt:     p.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Value > out[j].Value })
	return out
}

func (w *contextWatcher) IngressClasses() []IngressClassInfo {
	f := w.factoryFor("IngressClass")
	if f == nil {
		return []IngressClassInfo{}
	}
	classes, err := f.Networking().V1().IngressClasses().Lister().List(labels.Everything())
	if err != nil {
		return []IngressClassInfo{}
	}
	out := make([]IngressClassInfo, 0, len(classes))
	for _, c := range classes {
		out = append(out, IngressClassInfo{
			Name:       c.Name,
			Controller: c.Spec.Controller,
			IsDefault:  c.Annotations["ingressclass.kubernetes.io/is-default-class"] == "true",
			CreatedAt:  c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) FlowSchemas() []FlowSchemaInfo {
	f := w.factoryFor("FlowSchema")
	if f == nil {
		return []FlowSchemaInfo{}
	}
	list, err := f.Flowcontrol().V1().FlowSchemas().Lister().List(labels.Everything())
	if err != nil {
		return []FlowSchemaInfo{}
	}
	out := make([]FlowSchemaInfo, 0, len(list))
	for _, fs := range list {
		dist := ""
		if fs.Spec.DistinguisherMethod != nil {
			dist = string(fs.Spec.DistinguisherMethod.Type)
		}
		out = append(out, FlowSchemaInfo{
			Name:               fs.Name,
			PriorityLevel:      fs.Spec.PriorityLevelConfiguration.Name,
			MatchingPrecedence: fs.Spec.MatchingPrecedence,
			Distinguisher:      dist,
			CreatedAt:          fs.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].MatchingPrecedence < out[j].MatchingPrecedence })
	return out
}

func (w *contextWatcher) PriorityLevelConfigurations() []PriorityLevelConfigurationInfo {
	f := w.factoryFor("PriorityLevelConfiguration")
	if f == nil {
		return []PriorityLevelConfigurationInfo{}
	}
	list, err := f.Flowcontrol().V1().PriorityLevelConfigurations().Lister().List(labels.Everything())
	if err != nil {
		return []PriorityLevelConfigurationInfo{}
	}
	out := make([]PriorityLevelConfigurationInfo, 0, len(list))
	for _, plc := range list {
		var shares int32
		var limit string
		switch {
		case plc.Spec.Limited != nil:
			if plc.Spec.Limited.NominalConcurrencyShares != nil {
				shares = *plc.Spec.Limited.NominalConcurrencyShares
			}
			if plc.Spec.Limited.LimitResponse.Type != "" {
				limit = string(plc.Spec.Limited.LimitResponse.Type)
			}
		case plc.Spec.Exempt != nil:
			if plc.Spec.Exempt.NominalConcurrencyShares != nil {
				shares = *plc.Spec.Exempt.NominalConcurrencyShares
			}
		}
		out = append(out, PriorityLevelConfigurationInfo{
			Name:                     plc.Name,
			Type:                     string(plc.Spec.Type),
			NominalConcurrencyShares: shares,
			LimitResponse:            limit,
			CreatedAt:                plc.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) LimitRanges(namespace string) []LimitRangeInfo {
	f := w.factoryFor("LimitRange")
	if f == nil {
		return []LimitRangeInfo{}
	}
	lister := f.Core().V1().LimitRanges().Lister()
	var (
		lrs []*corev1.LimitRange
		err error
	)
	if namespace == "" {
		lrs, err = lister.List(labels.Everything())
	} else {
		lrs, err = lister.LimitRanges(namespace).List(labels.Everything())
	}
	if err != nil {
		return []LimitRangeInfo{}
	}
	out := make([]LimitRangeInfo, 0, len(lrs))
	for _, l := range lrs {
		out = append(out, LimitRangeInfo{
			Name:      l.Name,
			Namespace: l.Namespace,
			Limits:    len(l.Spec.Limits),
			CreatedAt: l.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) ResourceQuotas(namespace string) []ResourceQuotaInfo {
	f := w.factoryFor("ResourceQuota")
	if f == nil {
		return []ResourceQuotaInfo{}
	}
	lister := f.Core().V1().ResourceQuotas().Lister()
	var (
		qs  []*corev1.ResourceQuota
		err error
	)
	if namespace == "" {
		qs, err = lister.List(labels.Everything())
	} else {
		qs, err = lister.ResourceQuotas(namespace).List(labels.Everything())
	}
	if err != nil {
		return []ResourceQuotaInfo{}
	}
	out := make([]ResourceQuotaInfo, 0, len(qs))
	for _, q := range qs {
		scopes := make([]string, 0, len(q.Spec.Scopes))
		for _, s := range q.Spec.Scopes {
			scopes = append(scopes, string(s))
		}
		out = append(out, ResourceQuotaInfo{
			Name:      q.Name,
			Namespace: q.Namespace,
			Scopes:    strings.Join(scopes, ","),
			Used:      len(q.Status.Used),
			Hard:      len(q.Status.Hard),
			CreatedAt: q.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func nodeStatus(n *corev1.Node) string {
	ready := "Unknown"
	for _, c := range n.Status.Conditions {
		if c.Type == corev1.NodeReady {
			switch c.Status {
			case corev1.ConditionTrue:
				ready = "Ready"
			default:
				ready = "NotReady"
			}
		}
	}
	if n.Spec.Unschedulable {
		ready += ",SchedulingDisabled"
	}
	return ready
}

func nodeRoles(n *corev1.Node) string {
	const prefix = "node-role.kubernetes.io/"
	roles := make([]string, 0)
	for k := range n.Labels {
		if strings.HasPrefix(k, prefix) {
			role := strings.TrimPrefix(k, prefix)
			if role != "" {
				roles = append(roles, role)
			}
		}
	}
	if len(roles) == 0 {
		return "<none>"
	}
	sort.Strings(roles)
	return strings.Join(roles, ",")
}

func nodeInternalIP(n *corev1.Node) string {
	for _, addr := range n.Status.Addresses {
		if addr.Type == corev1.NodeInternalIP {
			return addr.Address
		}
	}
	return ""
}

func nodeInstanceType(n *corev1.Node) string {
	if v := n.Labels["node.kubernetes.io/instance-type"]; v != "" {
		return v
	}
	return n.Labels["beta.kubernetes.io/instance-type"]
}

// nodeCapacityType normalizes the per-provider "spot vs on-demand" label
// down to lowercase "spot" / "on-demand" so the UI can render one badge
// regardless of whether the cluster is on Karpenter, EKS managed node
// groups, GKE, or AKS.
func nodeCapacityType(n *corev1.Node) string {
	if v := n.Labels["karpenter.sh/capacity-type"]; v != "" {
		return strings.ToLower(v)
	}
	switch strings.ToUpper(n.Labels["eks.amazonaws.com/capacityType"]) {
	case "SPOT":
		return "spot"
	case "ON_DEMAND":
		return "on-demand"
	}
	if strings.EqualFold(n.Labels["cloud.google.com/gke-spot"], "true") {
		return "spot"
	}
	switch strings.ToLower(n.Labels["kubernetes.azure.com/scalesetpriority"]) {
	case "spot":
		return "spot"
	case "regular":
		return "on-demand"
	}
	return ""
}

func nodeNodePool(n *corev1.Node) string {
	for _, k := range []string{
		"karpenter.sh/nodepool",
		"karpenter.sh/provisioner-name",
		"eks.amazonaws.com/nodegroup",
		"cloud.google.com/gke-nodepool",
		"kubernetes.azure.com/agentpool",
	} {
		if v := n.Labels[k]; v != "" {
			return v
		}
	}
	return ""
}
