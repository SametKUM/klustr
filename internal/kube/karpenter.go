package kube

import (
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// NodePool and NodeClaim are both cluster-scoped. Their storage version is v1
// since Karpenter 1.0 and v1beta1 before it.
var (
	karpenterNodePoolGR  = schema.GroupResource{Group: "karpenter.sh", Resource: "nodepools"}
	karpenterNodeClaimGR = schema.GroupResource{Group: "karpenter.sh", Resource: "nodeclaims"}
)

// KarpenterNodePoolInfo is the row shape for the NodePools list view.
// It pulls together fields scattered across spec/status so the frontend
// renders a useful overview without parsing the whole CR.
type KarpenterNodePoolInfo struct {
	Name                string `json:"name"`
	Weight              int64  `json:"weight"`
	NodeClassKind       string `json:"nodeClassKind"`
	NodeClassGroup      string `json:"nodeClassGroup"`
	NodeClassName       string `json:"nodeClassName"`
	ConsolidationPolicy string `json:"consolidationPolicy"`
	ConsolidateAfter    string `json:"consolidateAfter"`
	CPULimit            string `json:"cpuLimit"`
	MemoryLimit         string `json:"memoryLimit"`
	CPUUsage            string `json:"cpuUsage"`
	MemoryUsage         string `json:"memoryUsage"`
	NodeCount           string `json:"nodeCount"`
	Ready               string `json:"ready"`
	CreatedAt           string `json:"createdAt"`
}

// KarpenterNodeClaimInfo is the row shape for the NodeClaims list view.
// status.conditions surfaces the per-claim lifecycle (Launched / Registered
// / Initialized / Drifted / Empty) which is the most useful signal here.
type KarpenterNodeClaimInfo struct {
	Name           string `json:"name"`
	NodeName       string `json:"nodeName"`
	NodePool       string `json:"nodePool"`
	NodeClassKind  string `json:"nodeClassKind"`
	NodeClassGroup string `json:"nodeClassGroup"`
	NodeClassName  string `json:"nodeClassName"`
	InstanceType   string `json:"instanceType"`
	CapacityType   string `json:"capacityType"`
	Zone           string `json:"zone"`
	ProviderID     string `json:"providerID"`
	CPU            string `json:"cpu"`
	Memory         string `json:"memory"`
	Launched       string `json:"launched"`
	Registered     string `json:"registered"`
	Initialized    string `json:"initialized"`
	Drifted        string `json:"drifted"`
	Ready          string `json:"ready"`
	CreatedAt      string `json:"createdAt"`
}

// ListKarpenterNodePools projects cached NodePool CRs into KarpenterNodePoolInfo.
// Caller must have started the CR watch first (frontend does this on view mount,
// same as Argo Applications).
func (m *ClientManager) ListKarpenterNodePools(contextName string) []KarpenterNodePoolInfo {
	return listServedRows(m, contextName, karpenterNodePoolGR, "", extractKarpenterNodePool,
		func(r KarpenterNodePoolInfo) (string, string) { return "", r.Name })
}

// ListKarpenterNodeClaims projects cached NodeClaim CRs into KarpenterNodeClaimInfo.
func (m *ClientManager) ListKarpenterNodeClaims(contextName string) []KarpenterNodeClaimInfo {
	return listServedRows(m, contextName, karpenterNodeClaimGR, "", extractKarpenterNodeClaim,
		func(r KarpenterNodeClaimInfo) (string, string) { return "", r.Name })
}

// NodeForNodeClaim resolves the single node a NodeClaim has registered, read from
// status.nodeName on the claim. Returns an empty slice while the claim is still
// launching (no node yet). A slice rather than a pointer so the frontend reuses
// the NodePool node-table renderer.
func (m *ClientManager) NodeForNodeClaim(contextName, nodeClaimName string) []NodeInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []NodeInfo{}
	}
	var nodeName string
	for _, obj := range m.listServedCRs(contextName, karpenterNodeClaimGR, "") {
		if obj.GetName() == nodeClaimName {
			nodeName, _, _ = unstructured.NestedString(obj.Object, "status", "nodeName")
			break
		}
	}
	if nodeName == "" {
		return []NodeInfo{}
	}
	return w.NodeInfoByName(nodeName)
}

func extractKarpenterNodePool(obj *unstructured.Unstructured) KarpenterNodePoolInfo {
	info := KarpenterNodePoolInfo{
		Name:      obj.GetName(),
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
	if w, found, _ := unstructured.NestedInt64(obj.Object, "spec", "weight"); found {
		info.Weight = w
	}
	info.NodeClassKind, _, _ = unstructured.NestedString(obj.Object, "spec", "template", "spec", "nodeClassRef", "kind")
	info.NodeClassGroup, _, _ = unstructured.NestedString(obj.Object, "spec", "template", "spec", "nodeClassRef", "group")
	info.NodeClassName, _, _ = unstructured.NestedString(obj.Object, "spec", "template", "spec", "nodeClassRef", "name")
	info.ConsolidationPolicy, _, _ = unstructured.NestedString(obj.Object, "spec", "disruption", "consolidationPolicy")
	info.ConsolidateAfter, _, _ = unstructured.NestedString(obj.Object, "spec", "disruption", "consolidateAfter")

	if limits, found, _ := unstructured.NestedMap(obj.Object, "spec", "limits"); found {
		if cpu, ok := limits["cpu"].(string); ok {
			info.CPULimit = cpu
		}
		if mem, ok := limits["memory"].(string); ok {
			info.MemoryLimit = mem
		}
	}
	if resources, found, _ := unstructured.NestedMap(obj.Object, "status", "resources"); found {
		if cpu, ok := resources["cpu"].(string); ok {
			info.CPUUsage = cpu
		}
		if mem, ok := resources["memory"].(string); ok {
			info.MemoryUsage = mem
		}
		if nodes, ok := resources["nodes"].(string); ok {
			info.NodeCount = nodes
		}
	}
	info.Ready = conditionStatusByType(crConditions(obj), "Ready")
	return info
}

func extractKarpenterNodeClaim(obj *unstructured.Unstructured) KarpenterNodeClaimInfo {
	info := KarpenterNodeClaimInfo{
		Name:      obj.GetName(),
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
	info.NodeName, _, _ = unstructured.NestedString(obj.Object, "status", "nodeName")
	info.ProviderID, _, _ = unstructured.NestedString(obj.Object, "status", "providerID")
	info.NodeClassKind, _, _ = unstructured.NestedString(obj.Object, "spec", "nodeClassRef", "kind")
	info.NodeClassGroup, _, _ = unstructured.NestedString(obj.Object, "spec", "nodeClassRef", "group")
	info.NodeClassName, _, _ = unstructured.NestedString(obj.Object, "spec", "nodeClassRef", "name")

	if capacity, found, _ := unstructured.NestedMap(obj.Object, "status", "capacity"); found {
		if cpu, ok := capacity["cpu"].(string); ok {
			info.CPU = cpu
		}
		if mem, ok := capacity["memory"].(string); ok {
			info.Memory = mem
		}
	}

	// NodePool, instance type, capacity type and zone are surfaced as labels
	// on the NodeClaim itself by the Karpenter core controller. Reading them
	// from labels (rather than spec.requirements) reflects the actually-chosen
	// values for an already-launched node, which is what the user wants to see.
	lbls := obj.GetLabels()
	info.NodePool = lbls["karpenter.sh/nodepool"]
	info.InstanceType = lbls["node.kubernetes.io/instance-type"]
	info.CapacityType = lbls["karpenter.sh/capacity-type"]
	info.Zone = lbls["topology.kubernetes.io/zone"]

	conds := crConditions(obj)
	info.Launched = conditionStatusByType(conds, "Launched")
	info.Registered = conditionStatusByType(conds, "Registered")
	info.Initialized = conditionStatusByType(conds, "Initialized")
	info.Drifted = conditionStatusByType(conds, "Drifted")
	info.Ready = conditionStatusByType(conds, "Ready")
	return info
}
