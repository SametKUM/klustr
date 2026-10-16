package kube

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/robfig/cron/v3"
	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
)

const (
	karpenterNodePoolLabel     = "karpenter.sh/nodepool"
	karpenterCapacityTypeLabel = "karpenter.sh/capacity-type"
	karpenterDoNotDisrupt      = "karpenter.sh/do-not-disrupt"
	// karpenterDisruptedTaint is set while Karpenter is disrupting the node.
	karpenterDisruptedTaint = "karpenter.sh/disrupted"
	mirrorPodAnnotation     = "kubernetes.io/config.mirror"
)

// karpenterEventReasons are the reasons Karpenter's disruption and
// termination controllers record on Nodes, NodeClaims and NodePools.
var karpenterEventReasons = map[string]bool{
	"DisruptionBlocked": true, "DisruptionLaunching": true, "DisruptionTerminating": true,
	"DisruptionWaitingReadiness": true, "Unconsolidatable": true, "ConsolidationCandidate": true,
	"ConsolidationRejected": true, "ConsolidationApproved": true, "NodeRepairBlocked": true,
	"Disrupted": true, "FailedDraining": true, "TerminationGracePeriodExpiring": true,
}

// KarpenterDisruption explains whether Karpenter will voluntarily disrupt a
// node (consolidate, replace when drifted) and what is holding it back.
type KarpenterDisruption struct {
	NodeName  string `json:"nodeName"`
	NodeClaim string `json:"nodeClaim"`
	NodePool  string `json:"nodePool"`
	// Managed is false for a node no NodeClaim or NodePool owns; the rest
	// of the report is then empty.
	Managed             bool   `json:"managed"`
	CapacityType        string `json:"capacityType"`
	ConsolidationPolicy string `json:"consolidationPolicy"`
	ConsolidateAfter    string `json:"consolidateAfter"`
	ExpireAfter         string `json:"expireAfter"`
	// LastPodEventTime is when a pod last landed on or left the node, the
	// clock consolidateAfter counts from.
	LastPodEventTime string `json:"lastPodEventTime"`
	// Disrupting is set while Karpenter is already taking the node down,
	// with the reason it recorded.
	Disrupting       bool                  `json:"disrupting"`
	DisruptionReason string                `json:"disruptionReason"`
	Blockers         []KarpenterBlocker    `json:"blockers"`
	Budgets          []KarpenterBudget     `json:"budgets"`
	Conditions       []ConditionDetail     `json:"conditions"`
	Events           []EventInfo           `json:"events"`
	Pods             []KarpenterDisruptPod `json:"pods"`
}

// KarpenterBlocker is one reason Karpenter will not disrupt the node now.
type KarpenterBlocker struct {
	// Kind is "annotation", "pod", "pdb", "budget", "policy" or "state".
	Kind    string `json:"kind"`
	Message string `json:"message"`
	// ObjectKind, Namespace and Name point at the object to look at.
	ObjectKind string `json:"objectKind"`
	Namespace  string `json:"namespace"`
	Name       string `json:"name"`
}

// KarpenterBudget is one NodePool disruption budget evaluated now.
type KarpenterBudget struct {
	Nodes    string   `json:"nodes"`
	Reasons  []string `json:"reasons"`
	Schedule string   `json:"schedule"`
	Duration string   `json:"duration"`
	Active   bool     `json:"active"`
	// Allowed is how many of the pool's nodes the budget lets Karpenter
	// disrupt at once while active, -1 when inactive.
	Allowed int64  `json:"allowed"`
	Error   string `json:"error"`
}

// KarpenterDisruptPod is a pod on the node that Karpenter has to evict to
// disrupt it, with what stands in the way.
type KarpenterDisruptPod struct {
	Namespace   string   `json:"namespace"`
	Name        string   `json:"name"`
	DoNotEvict  bool     `json:"doNotDisrupt"`
	BlockingPDB []string `json:"blockingPDBs"`
}

type disruptionInput struct {
	node      *corev1.Node
	nodeClaim *unstructured.Unstructured
	nodePool  *unstructured.Unstructured
	pods      []*corev1.Pod
	pdbs      []*policyv1.PodDisruptionBudget
	poolNodes int
	now       time.Time
}

// GetKarpenterDisruption reports on a node, found by name or through the
// NodeClaim that launched it (one of the two may be "").
func (m *ClientManager) GetKarpenterDisruption(ctx context.Context, contextName, nodeName, nodeClaimName string) (*KarpenterDisruption, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("context %q is not connected", contextName)
	}
	in := disruptionInput{now: time.Now()}
	if nodeClaimName != "" {
		claim, err := m.getServedCR(ctx, contextName, karpenterNodeClaimGR, "", nodeClaimName)
		if err != nil {
			return nil, err
		}
		in.nodeClaim = claim
		if nodeName == "" {
			nodeName, _, _ = unstructured.NestedString(claim.Object, "status", "nodeName")
		}
	}
	if nodeName != "" {
		if f := w.factoryFor("Node"); f != nil {
			if n, err := f.Core().V1().Nodes().Lister().Get(nodeName); err == nil {
				in.node = n
			}
		}
		if in.node == nil && w.cs != nil {
			n, err := w.cs.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
			if err != nil {
				return nil, err
			}
			in.node = n
		}
	}
	if in.nodeClaim == nil && in.node != nil {
		if name := nodeClaimOwner(in.node); name != "" {
			if claim, err := m.getServedCR(ctx, contextName, karpenterNodeClaimGR, "", name); err == nil {
				in.nodeClaim = claim
			}
		}
	}
	if pool := disruptionPoolName(in); pool != "" {
		if obj, err := m.getServedCR(ctx, contextName, karpenterNodePoolGR, "", pool); err == nil {
			in.nodePool = obj
		}
		in.poolNodes = poolNodeCount(w, in.nodePool, pool)
	}
	if in.node != nil {
		in.pods = podsOnNode(w, in.node.Name)
		if f := w.factoryFor("PodDisruptionBudget"); f != nil {
			in.pdbs, _ = f.Policy().V1().PodDisruptionBudgets().Lister().List(labels.Everything())
		}
	}
	out := analyzeKarpenterDisruption(in)
	if out.Managed && w.cs != nil {
		out.Events = karpenterEvents(ctx, w.cs, out)
	}
	return out, nil
}

func nodeClaimOwner(n *corev1.Node) string {
	for _, o := range n.OwnerReferences {
		if o.Kind == "NodeClaim" && strings.HasPrefix(o.APIVersion, "karpenter.sh/") {
			return o.Name
		}
	}
	return ""
}

func disruptionPoolName(in disruptionInput) string {
	if in.nodeClaim != nil {
		if p := in.nodeClaim.GetLabels()[karpenterNodePoolLabel]; p != "" {
			return p
		}
	}
	if in.node != nil {
		return in.node.Labels[karpenterNodePoolLabel]
	}
	return ""
}

// poolNodeCount is the node count budgets scale percentages against: the
// NodePool's status.resources.nodes, or the cached nodes carrying its label.
func poolNodeCount(w *contextWatcher, pool *unstructured.Unstructured, name string) int {
	if pool != nil {
		if v, found, _ := unstructured.NestedFieldNoCopy(pool.Object, "status", "resources", "nodes"); found {
			if q, ok := v.(string); ok {
				var n int
				if _, err := fmt.Sscanf(q, "%d", &n); err == nil {
					return n
				}
			}
		}
	}
	f := w.factoryFor("Node")
	if f == nil {
		return 0
	}
	nodes, err := f.Core().V1().Nodes().Lister().List(labels.SelectorFromSet(labels.Set{karpenterNodePoolLabel: name}))
	if err != nil {
		return 0
	}
	return len(nodes)
}

func podsOnNode(w *contextWatcher, nodeName string) []*corev1.Pod {
	f := w.factoryFor("Pod")
	if f == nil {
		return nil
	}
	objs, err := f.Core().V1().Pods().Informer().GetIndexer().ByIndex(podByNodeIndex, nodeName)
	if err != nil {
		return nil
	}
	out := make([]*corev1.Pod, 0, len(objs))
	for _, o := range objs {
		if p, ok := o.(*corev1.Pod); ok {
			out = append(out, p)
		}
	}
	return out
}

func analyzeKarpenterDisruption(in disruptionInput) *KarpenterDisruption {
	out := &KarpenterDisruption{
		Blockers: []KarpenterBlocker{}, Budgets: []KarpenterBudget{}, Conditions: []ConditionDetail{},
		Events: []EventInfo{}, Pods: []KarpenterDisruptPod{},
	}
	if in.node != nil {
		out.NodeName = in.node.Name
		out.CapacityType = in.node.Labels[karpenterCapacityTypeLabel]
	}
	if in.nodeClaim != nil {
		out.NodeClaim = in.nodeClaim.GetName()
		out.Conditions = crConditions(in.nodeClaim)
		out.LastPodEventTime, _, _ = unstructured.NestedString(in.nodeClaim.Object, "status", "lastPodEventTime")
		if out.CapacityType == "" {
			out.CapacityType = in.nodeClaim.GetLabels()[karpenterCapacityTypeLabel]
		}
	}
	out.NodePool = disruptionPoolName(in)
	out.Managed = out.NodeClaim != "" || out.NodePool != ""
	if !out.Managed {
		return out
	}

	if c, ok := findCondition(out.Conditions, "DisruptionReason"); ok && c.Status == "True" {
		out.Disrupting, out.DisruptionReason = true, c.Reason
	}
	if in.node != nil {
		for _, taint := range in.node.Spec.Taints {
			if taint.Key == karpenterDisruptedTaint {
				out.Disrupting = true
			}
		}
	}

	block := func(b KarpenterBlocker) { out.Blockers = append(out.Blockers, b) }
	if in.node != nil && in.node.Annotations[karpenterDoNotDisrupt] == "true" {
		block(KarpenterBlocker{Kind: "annotation", Message: "The node is annotated karpenter.sh/do-not-disrupt.", ObjectKind: "Node", Name: in.node.Name})
	}
	if in.nodeClaim != nil && in.nodeClaim.GetAnnotations()[karpenterDoNotDisrupt] == "true" {
		block(KarpenterBlocker{Kind: "annotation", Message: "The NodeClaim is annotated karpenter.sh/do-not-disrupt.", ObjectKind: "NodeClaim", Name: in.nodeClaim.GetName()})
	}
	if in.nodeClaim != nil && conditionStatusByType(out.Conditions, "Initialized") != "True" {
		block(KarpenterBlocker{Kind: "state", Message: "The NodeClaim is not initialized yet; Karpenter only disrupts initialized nodes."})
	}

	evictable := 0
	for _, p := range in.pods {
		if !podNeedsEviction(p) {
			continue
		}
		evictable++
		dp := KarpenterDisruptPod{Namespace: p.Namespace, Name: p.Name, BlockingPDB: []string{}}
		if p.Annotations[karpenterDoNotDisrupt] == "true" {
			dp.DoNotEvict = true
			block(KarpenterBlocker{Kind: "pod", Message: fmt.Sprintf("Pod %s/%s is annotated karpenter.sh/do-not-disrupt.", p.Namespace, p.Name),
				ObjectKind: "Pod", Namespace: p.Namespace, Name: p.Name})
		}
		matching := matchingPDBs(p, in.pdbs)
		if len(matching) > 1 {
			names := make([]string, 0, len(matching))
			for _, pdb := range matching {
				names = append(names, pdb.Name)
			}
			dp.BlockingPDB = names
			block(KarpenterBlocker{Kind: "pdb", Message: fmt.Sprintf("Pod %s/%s is matched by more than one PDB (%s), which the Eviction API refuses.", p.Namespace, p.Name, strings.Join(names, ", ")),
				ObjectKind: "Pod", Namespace: p.Namespace, Name: p.Name})
		} else if len(matching) == 1 && matching[0].Status.DisruptionsAllowed == 0 {
			pdb := matching[0]
			dp.BlockingPDB = []string{pdb.Name}
			block(KarpenterBlocker{Kind: "pdb", Message: fmt.Sprintf("PDB %s/%s allows no disruptions, so pod %s cannot be evicted.", pdb.Namespace, pdb.Name, p.Name),
				ObjectKind: "PodDisruptionBudget", Namespace: pdb.Namespace, Name: pdb.Name})
		}
		if dp.DoNotEvict || len(dp.BlockingPDB) > 0 {
			out.Pods = append(out.Pods, dp)
		}
	}

	if in.nodePool != nil {
		pool := in.nodePool
		out.ConsolidationPolicy, _, _ = unstructured.NestedString(pool.Object, "spec", "disruption", "consolidationPolicy")
		if out.ConsolidationPolicy == "" {
			out.ConsolidationPolicy = "WhenEmptyOrUnderutilized"
		}
		out.ConsolidateAfter, _, _ = unstructured.NestedString(pool.Object, "spec", "disruption", "consolidateAfter")
		out.ExpireAfter, _, _ = unstructured.NestedString(pool.Object, "spec", "template", "spec", "expireAfter")
		if out.ConsolidateAfter == "Never" {
			block(KarpenterBlocker{Kind: "policy", Message: "The NodePool sets consolidateAfter: Never, so Karpenter never consolidates its nodes.",
				ObjectKind: "NodePool", Name: pool.GetName()})
		} else if out.ConsolidationPolicy == "WhenEmpty" && evictable > 0 {
			block(KarpenterBlocker{Kind: "policy", Message: fmt.Sprintf("The NodePool consolidates only empty nodes (WhenEmpty), and this node runs %d pods that would need eviction.", evictable),
				ObjectKind: "NodePool", Name: pool.GetName()})
		}
		// The node under report is one of the pool's, whatever a stale or
		// missing status count says.
		out.Budgets = evaluateBudgets(pool, max(in.poolNodes, 1), in.now)
		for _, b := range out.Budgets {
			if b.Active && b.Allowed == 0 {
				scope := "every disruption reason"
				if len(b.Reasons) > 0 {
					scope = strings.Join(b.Reasons, ", ")
				}
				block(KarpenterBlocker{Kind: "budget", Message: fmt.Sprintf("A disruption budget (nodes: %s) is active and allows no disruptions for %s.", b.Nodes, scope),
					ObjectKind: "NodePool", Name: pool.GetName()})
			}
		}
	}
	return out
}

// podNeedsEviction reports whether Karpenter has to evict the pod to drain
// the node: DaemonSet and static pods are left in place, and finished pods
// hold nothing.
func podNeedsEviction(p *corev1.Pod) bool {
	if p.Status.Phase == corev1.PodSucceeded || p.Status.Phase == corev1.PodFailed || p.DeletionTimestamp != nil {
		return false
	}
	if _, mirror := p.Annotations[mirrorPodAnnotation]; mirror {
		return false
	}
	for _, o := range p.OwnerReferences {
		if o.Kind == "DaemonSet" {
			return false
		}
	}
	return true
}

func matchingPDBs(p *corev1.Pod, pdbs []*policyv1.PodDisruptionBudget) []*policyv1.PodDisruptionBudget {
	var out []*policyv1.PodDisruptionBudget
	for _, pdb := range pdbs {
		if pdb.Namespace != p.Namespace || pdb.Spec.Selector == nil {
			continue
		}
		sel, err := metav1.LabelSelectorAsSelector(pdb.Spec.Selector)
		if err != nil || sel.Empty() {
			continue
		}
		if sel.Matches(labels.Set(p.Labels)) {
			out = append(out, pdb)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// evaluateBudgets mirrors Karpenter's Budget.IsActive and
// GetAllowedDisruptions: a budget without a schedule is always active, a
// scheduled one is active for duration after each cron hit (UTC), and nodes
// is a count or a percentage of the pool rounded up. Without any budget,
// Karpenter applies one of 10%.
func evaluateBudgets(pool *unstructured.Unstructured, poolNodes int, now time.Time) []KarpenterBudget {
	raw, found, _ := nestedSliceNoCopy(pool.Object, "spec", "disruption", "budgets")
	if !found {
		raw = []any{map[string]any{"nodes": "10%"}}
	}
	out := make([]KarpenterBudget, 0, len(raw))
	for _, item := range raw {
		m, _ := item.(map[string]any)
		b := KarpenterBudget{Reasons: []string{}, Allowed: -1}
		b.Nodes, _ = m["nodes"].(string)
		if b.Nodes == "" {
			b.Nodes = "10%"
		}
		b.Schedule, _ = m["schedule"].(string)
		b.Duration, _ = m["duration"].(string)
		b.Reasons = appendStrings(b.Reasons, m["reasons"])
		active, err := budgetActive(b.Schedule, b.Duration, now)
		if err != nil {
			// Karpenter fails closed on a schedule it cannot parse.
			b.Error = err.Error()
			active = true
		}
		b.Active = active
		if active {
			if err != nil {
				b.Allowed = 0
			} else {
				b.Allowed = budgetAllowed(b.Nodes, poolNodes)
			}
		}
		out = append(out, b)
	}
	return out
}

func budgetActive(schedule, duration string, now time.Time) (bool, error) {
	if schedule == "" && duration == "" {
		return true, nil
	}
	d, err := time.ParseDuration(duration)
	if err != nil {
		return false, fmt.Errorf("invalid duration %q", duration)
	}
	s, err := cron.ParseStandard("TZ=UTC " + schedule)
	if err != nil {
		return false, fmt.Errorf("invalid schedule %q", schedule)
	}
	now = now.UTC()
	return !s.Next(now.Add(-d)).After(now), nil
}

func budgetAllowed(nodes string, poolNodes int) int64 {
	value := intstr.Parse(nodes)
	n, err := intstr.GetScaledValueFromIntOrPercent(&value, poolNodes, true)
	if err != nil {
		return 0
	}
	return int64(math.Max(0, float64(n)))
}

// karpenterEvents lists the disruption events on the node, its NodeClaim
// and its NodePool, newest first. All three are cluster-scoped, so their
// events can sit in any namespace.
func karpenterEvents(ctx context.Context, cs kubernetes.Interface, d *KarpenterDisruption) []EventInfo {
	out := []EventInfo{}
	for _, ref := range [][2]string{{"Node", d.NodeName}, {"NodeClaim", d.NodeClaim}, {"NodePool", d.NodePool}} {
		if ref[1] == "" {
			continue
		}
		list, err := cs.CoreV1().Events("").List(ctx, metav1.ListOptions{
			Limit: 200,
			FieldSelector: fields.AndSelectors(
				fields.OneTermEqualSelector("involvedObject.name", ref[1]),
				fields.OneTermEqualSelector("involvedObject.kind", ref[0]),
			).String(),
		})
		if err != nil {
			continue
		}
		for i := range list.Items {
			e := &list.Items[i]
			if e.InvolvedObject.Kind == ref[0] && e.InvolvedObject.Name == ref[1] && karpenterEventReasons[e.Reason] {
				out = append(out, eventInfoFrom(e))
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].LastSeen.After(out[j].LastSeen) })
	const maxEvents = 30
	if len(out) > maxEvents {
		out = out[:maxEvents]
	}
	return out
}
