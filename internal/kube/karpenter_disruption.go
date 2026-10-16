package kube

import (
	"context"
	"fmt"
	"math"
	"slices"
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
	corelisters "k8s.io/client-go/listers/core/v1"
	"k8s.io/client-go/tools/cache"
)

const (
	karpenterNodePoolLabel     = "karpenter.sh/nodepool"
	karpenterCapacityTypeLabel = "karpenter.sh/capacity-type"
	karpenterRegisteredLabel   = "karpenter.sh/registered"
	karpenterInitializedLabel  = "karpenter.sh/initialized"
	karpenterDoNotDisrupt      = "karpenter.sh/do-not-disrupt"
	// karpenterDisruptedTaint is set while Karpenter is disrupting the node.
	karpenterDisruptedTaint = "karpenter.sh/disrupted"
	mirrorPodAnnotation     = "kubernetes.io/config.mirror"
)

// The voluntary disruption reasons a blocker can hold back, in the order the
// verdict names them. Expiration and repair are forced and left out.
const (
	disruptionEmpty         = "Empty"
	disruptionUnderutilized = "Underutilized"
	disruptionDrifted       = "Drifted"
)

var (
	voluntaryDisruptions     = []string{disruptionEmpty, disruptionUnderutilized, disruptionDrifted}
	consolidationDisruptions = []string{disruptionEmpty, disruptionUnderutilized}
)

// disruptionSyncWait bounds how long a report waits for informers it has
// just started to finish their first LIST.
const disruptionSyncWait = 5 * time.Second

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
	Disrupting       bool               `json:"disrupting"`
	DisruptionReason string             `json:"disruptionReason"`
	Blockers         []KarpenterBlocker `json:"blockers"`
	// Blocked is every voluntary disruption reason (Empty, Underutilized,
	// Drifted) at least one blocker holds back.
	Blocked []string `json:"blocked"`
	// Incomplete names what Klustr could not read cluster-wide, so a report
	// without blockers is no proof that nothing blocks.
	Incomplete []string          `json:"incomplete"`
	Budgets    []KarpenterBudget `json:"budgets"`
	// PoolDisrupting counts the pool's nodes that are NotReady or already
	// being disrupted; Karpenter subtracts them from every budget.
	PoolDisrupting int                   `json:"poolDisrupting"`
	Conditions     []ConditionDetail     `json:"conditions"`
	Events         []EventInfo           `json:"events"`
	Pods           []KarpenterDisruptPod `json:"pods"`
}

// KarpenterBlocker is one reason Karpenter will not disrupt the node now.
type KarpenterBlocker struct {
	// Kind is "annotation", "pod", "pdb", "budget", "policy" or "state".
	Kind    string `json:"kind"`
	Message string `json:"message"`
	// Reasons are the voluntary disruption reasons it holds back.
	Reasons []string `json:"reasons"`
	// Until is when the blocker lifts by itself (RFC 3339), or "".
	Until string `json:"until"`
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
	Allowed int64 `json:"allowed"`
	// Remaining is Allowed less the pool's nodes already disrupting or
	// NotReady, never below 0; -1 when inactive.
	Remaining int64  `json:"remaining"`
	Error     string `json:"error"`
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
	// poolDisrupting counts the pool's nodes consuming its budgets.
	poolDisrupting int
	incomplete     []string
	now            time.Time
}

// disruptionInputs are the cached kinds the report reads, with what a
// partial view of each can hide.
var disruptionInputs = []struct{ kind, gap string }{
	{"Node", "Nodes are not readable cluster-wide, so the pool's nodes that already use up its budgets are not counted."},
	{"Pod", "Pods are not readable cluster-wide, so do-not-disrupt pods on the node can be missing."},
	{"PodDisruptionBudget", "PodDisruptionBudgets are not readable cluster-wide, so PDBs that block eviction can be missing."},
}

// GetKarpenterDisruption reports on a node, found by name or through the
// NodeClaim that launched it (one of the two may be "").
func (m *ClientManager) GetKarpenterDisruption(ctx context.Context, contextName, nodeName, nodeClaimName string) (*KarpenterDisruption, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("context %q is not connected", contextName)
	}
	in := disruptionInput{now: time.Now()}
	for _, input := range disruptionInputs {
		if w.access.For(input.kind).Mode != AccessCluster {
			in.incomplete = append(in.incomplete, input.gap)
		}
	}
	// Unlike a list view, the report is read once per refresh, so it waits
	// for informers factoryFor has just started rather than answer from
	// their empty caches.
	syncCtx, cancel := context.WithTimeout(ctx, disruptionSyncWait)
	defer cancel()
	var nodes corelisters.NodeLister
	if f := w.factoryFor("Node"); f != nil {
		waitForInformer(syncCtx, f.Core().V1().Nodes().Informer())
		nodes = f.Core().V1().Nodes().Lister()
	}
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
		if nodes != nil {
			if n, err := nodes.Get(nodeName); err == nil {
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
		var members []*corev1.Node
		if nodes != nil {
			members, _ = nodes.List(labels.SelectorFromSet(labels.Set{karpenterNodePoolLabel: pool}))
		}
		in.poolNodes = poolNodeCount(in.nodePool, members)
		in.poolDisrupting = poolDisruptingNodes(members)
	}
	if in.node != nil {
		in.pods = podsOnNode(syncCtx, w, in.node.Name)
		if f := w.factoryFor("PodDisruptionBudget"); f != nil {
			waitForInformer(syncCtx, f.Policy().V1().PodDisruptionBudgets().Informer())
			in.pdbs, _ = f.Policy().V1().PodDisruptionBudgets().Lister().List(labels.Everything())
		}
	}
	out := analyzeKarpenterDisruption(in)
	if out.Managed && w.cs != nil {
		out.Events = karpenterEvents(ctx, w.cs, out)
	}
	return out, nil
}

// waitForInformer blocks until the informer's first LIST has filled its
// cache or ctx ends, whichever comes first.
func waitForInformer(ctx context.Context, informer cache.SharedIndexInformer) {
	if !informer.HasSynced() {
		cache.WaitForCacheSync(ctx.Done(), informer.HasSynced)
	}
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
// NodePool's status.nodes (Karpenter 1.15+), its older
// status.resources.nodes, or the cached nodes carrying its label.
func poolNodeCount(pool *unstructured.Unstructured, members []*corev1.Node) int {
	if pool != nil {
		if v, found, _ := unstructured.NestedFieldNoCopy(pool.Object, "status", "nodes"); found {
			switch n := v.(type) {
			case int64:
				return int(n)
			case float64:
				return int(n)
			}
		}
		if v, found, _ := unstructured.NestedFieldNoCopy(pool.Object, "status", "resources", "nodes"); found {
			if q, ok := v.(string); ok {
				var n int
				if _, err := fmt.Sscanf(q, "%d", &n); err == nil {
					return n
				}
			}
		}
	}
	return len(members)
}

// poolDisruptingNodes mirrors Karpenter's NodePoolStatsFromNodes: among the
// pool's initialized nodes, those being deleted, tainted for disruption or
// NotReady use up budget before any new disruption does.
func poolDisruptingNodes(members []*corev1.Node) int {
	n := 0
	for _, node := range members {
		if node.Labels[karpenterInitializedLabel] != "true" {
			continue
		}
		disrupted := node.DeletionTimestamp != nil
		for _, t := range node.Spec.Taints {
			if t.Key == karpenterDisruptedTaint {
				disrupted = true
			}
		}
		if disrupted || !nodeReady(node) {
			n++
		}
	}
	return n
}

func nodeReady(n *corev1.Node) bool {
	for _, c := range n.Status.Conditions {
		if c.Type == corev1.NodeReady {
			return c.Status == corev1.ConditionTrue
		}
	}
	return false
}

func podsOnNode(ctx context.Context, w *contextWatcher, nodeName string) []*corev1.Pod {
	f := w.factoryFor("Pod")
	if f == nil {
		return nil
	}
	informer := f.Core().V1().Pods().Informer()
	waitForInformer(ctx, informer)
	objs, err := informer.GetIndexer().ByIndex(podByNodeIndex, nodeName)
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
		Blockers: []KarpenterBlocker{}, Blocked: []string{}, Incomplete: append([]string{}, in.incomplete...),
		Budgets: []KarpenterBudget{}, PoolDisrupting: in.poolDisrupting, Conditions: []ConditionDetail{},
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
	if kind, name, annotations := disruptionAnnotations(in); annotations[karpenterDoNotDisrupt] == "true" {
		block(KarpenterBlocker{Kind: "annotation", Message: fmt.Sprintf("The %s is annotated karpenter.sh/do-not-disrupt.", kind),
			Reasons: disruptionReasons(voluntaryDisruptions...), ObjectKind: kind, Name: name})
	}
	initialized := in.nodeClaim == nil || conditionStatusByType(out.Conditions, "Initialized") == "True"
	if !initialized {
		block(KarpenterBlocker{Kind: "state", Message: "The NodeClaim is not initialized yet; Karpenter only disrupts initialized nodes.",
			Reasons: disruptionReasons(voluntaryDisruptions...)})
	}

	// A drift replacement ignores pod-level blockers once the NodeClaim
	// bounds its drain with terminationGracePeriod; consolidation never does.
	podScope := voluntaryDisruptions
	if in.nodeClaim != nil {
		if _, found, _ := unstructured.NestedFieldNoCopy(in.nodeClaim.Object, "spec", "terminationGracePeriod"); found {
			podScope = consolidationDisruptions
		}
	}
	reschedulable := 0
	for _, p := range in.pods {
		if podReschedulable(p) {
			reschedulable++
		}
		if !podActive(p) {
			continue
		}
		dp := KarpenterDisruptPod{Namespace: p.Namespace, Name: p.Name, BlockingPDB: []string{}}
		// Unlike eviction, the annotation applies to DaemonSet and mirror
		// pods too (ValidatePodsDisruptable).
		if active, until := doNotDisruptActive(p, in.now); active {
			dp.DoNotEvict = true
			msg := fmt.Sprintf("Pod %s/%s is annotated karpenter.sh/do-not-disrupt.", p.Namespace, p.Name)
			if !until.IsZero() {
				msg = fmt.Sprintf("Pod %s/%s is annotated karpenter.sh/do-not-disrupt: %s, counted from its start.", p.Namespace, p.Name, p.Annotations[karpenterDoNotDisrupt])
			}
			b := KarpenterBlocker{Kind: "pod", Message: msg, Reasons: disruptionReasons(podScope...), ObjectKind: "Pod", Namespace: p.Namespace, Name: p.Name}
			if !until.IsZero() {
				b.Until = until.UTC().Format(time.RFC3339)
			}
			block(b)
		}
		if podEvictable(p) {
			matching := matchingPDBs(p, in.pdbs)
			if len(matching) > 1 {
				names := make([]string, 0, len(matching))
				for _, pdb := range matching {
					names = append(names, pdb.Name)
				}
				dp.BlockingPDB = names
				block(KarpenterBlocker{Kind: "pdb", Message: fmt.Sprintf("Pod %s/%s is matched by more than one PDB (%s), which the Eviction API refuses.", p.Namespace, p.Name, strings.Join(names, ", ")),
					Reasons: disruptionReasons(podScope...), ObjectKind: "Pod", Namespace: p.Namespace, Name: p.Name})
			} else if len(matching) == 1 && pdbBlocksEviction(matching[0], p) {
				pdb := matching[0]
				dp.BlockingPDB = []string{pdb.Name}
				block(KarpenterBlocker{Kind: "pdb", Message: fmt.Sprintf("PDB %s/%s allows no disruptions, so pod %s cannot be evicted.", pdb.Namespace, pdb.Name, p.Name),
					Reasons: disruptionReasons(podScope...), ObjectKind: "PodDisruptionBudget", Namespace: pdb.Namespace, Name: pdb.Name})
			}
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
				Reasons: disruptionReasons(consolidationDisruptions...), ObjectKind: "NodePool", Name: pool.GetName()})
		} else {
			if out.ConsolidationPolicy == "WhenEmpty" && reschedulable > 0 {
				block(KarpenterBlocker{Kind: "policy", Message: fmt.Sprintf("The NodePool consolidates only empty nodes (WhenEmpty), and this node runs %d pods that would need to move.", reschedulable),
					Reasons: disruptionReasons(consolidationDisruptions...), ObjectKind: "NodePool", Name: pool.GetName()})
			}
			if initialized && in.nodeClaim != nil {
				if b, ok := consolidatableBlocker(out, in.now); ok {
					block(b)
				}
			}
		}
		// The node under report is one of the pool's, whatever a stale or
		// missing status count says.
		out.Budgets = evaluateBudgets(pool, max(in.poolNodes, 1), in.poolDisrupting, in.now)
		for _, b := range out.Budgets {
			if !b.Active || b.Remaining != 0 {
				continue
			}
			reasons := budgetDisruptions(b.Reasons)
			if len(reasons) == 0 {
				// A budget only for Unhealthy limits repair, which this
				// report does not cover.
				continue
			}
			msg := fmt.Sprintf("A disruption budget (nodes: %s) is active and allows no disruptions for %s.", b.Nodes, strings.Join(reasons, ", "))
			if b.Allowed > 0 {
				msg = fmt.Sprintf("A disruption budget (nodes: %s) allows %d at once for %s; NotReady or disrupting nodes in the pool (%d) already use that up.",
					b.Nodes, b.Allowed, strings.Join(reasons, ", "), in.poolDisrupting)
			}
			block(KarpenterBlocker{Kind: "budget", Message: msg, Reasons: reasons, ObjectKind: "NodePool", Name: pool.GetName()})
		}
	}

	blocked := map[string]bool{}
	for _, b := range out.Blockers {
		for _, r := range b.Reasons {
			blocked[r] = true
		}
	}
	for _, r := range voluntaryDisruptions {
		if blocked[r] {
			out.Blocked = append(out.Blocked, r)
		}
	}
	return out
}

func disruptionReasons(reasons ...string) []string {
	return append([]string{}, reasons...)
}

// budgetDisruptions is the voluntary part of a budget's reasons; a budget
// without reasons covers them all.
func budgetDisruptions(reasons []string) []string {
	if len(reasons) == 0 {
		return disruptionReasons(voluntaryDisruptions...)
	}
	out := []string{}
	for _, r := range voluntaryDisruptions {
		if slices.Contains(reasons, r) {
			out = append(out, r)
		}
	}
	return out
}

// disruptionAnnotations is where Karpenter reads the node's do-not-disrupt
// annotation (StateNode.Annotations): the NodeClaim until the node
// registers, the Node after.
func disruptionAnnotations(in disruptionInput) (kind, name string, annotations map[string]string) {
	switch {
	case in.node == nil && in.nodeClaim == nil:
		return "", "", nil
	case in.node == nil:
		return "NodeClaim", in.nodeClaim.GetName(), in.nodeClaim.GetAnnotations()
	case in.nodeClaim == nil || in.node.Labels[karpenterRegisteredLabel] == "true":
		return "Node", in.node.Name, in.node.Annotations
	default:
		return "NodeClaim", in.nodeClaim.GetName(), in.nodeClaim.GetAnnotations()
	}
}

// consolidatableBlocker mirrors the NodeClaim consolidation controller:
// once pods last changed on the node (or it initialized), consolidateAfter
// has to pass before Karpenter sets Consolidatable, and both emptiness and
// consolidation wait for that condition.
func consolidatableBlocker(out *KarpenterDisruption, now time.Time) (KarpenterBlocker, bool) {
	after, err := time.ParseDuration(out.ConsolidateAfter)
	if err != nil {
		return KarpenterBlocker{}, false
	}
	b := KarpenterBlocker{Kind: "state", Reasons: disruptionReasons(consolidationDisruptions...), ObjectKind: "NodeClaim", Name: out.NodeClaim}
	since, from := out.LastPodEventTime, "pods last changed on the node"
	if since == "" {
		if c, ok := findCondition(out.Conditions, "Initialized"); ok {
			since, from = c.LastTransitionTime, "the node initialized"
		}
	}
	if t, err := time.Parse(time.RFC3339, since); err == nil && after > 0 {
		if eligible := t.Add(after); now.Before(eligible) {
			b.Message = fmt.Sprintf("consolidateAfter (%s) has not passed since %s, so Karpenter does not consolidate the node yet.", out.ConsolidateAfter, from)
			b.Until = eligible.UTC().Format(time.RFC3339)
			return b, true
		}
	}
	if conditionStatusByType(out.Conditions, "Consolidatable") != "True" {
		b.Message = "The NodeClaim is not marked Consolidatable yet; Karpenter consolidates a node only once that condition is True."
		return b, true
	}
	return KarpenterBlocker{}, false
}

func podActive(p *corev1.Pod) bool {
	return p.Status.Phase != corev1.PodSucceeded && p.Status.Phase != corev1.PodFailed && p.DeletionTimestamp == nil
}

func podOwnedBy(p *corev1.Pod, kind string) bool {
	for _, o := range p.OwnerReferences {
		if o.Kind == kind {
			return true
		}
	}
	return false
}

func podMirror(p *corev1.Pod) bool {
	_, mirror := p.Annotations[mirrorPodAnnotation]
	return mirror || podOwnedBy(p, "Node")
}

// podReschedulable mirrors Karpenter's IsReschedulable: the pods that would
// have to move elsewhere, which make the node non-empty. DaemonSet and
// static pods stay with the node.
func podReschedulable(p *corev1.Pod) bool {
	terminatingStatefulSet := p.DeletionTimestamp != nil && podOwnedBy(p, "StatefulSet")
	return (podActive(p) || terminatingStatefulSet) && !podOwnedBy(p, "DaemonSet") && !podMirror(p)
}

// podEvictable mirrors the part of Karpenter's IsEvictable that decides
// whether PDBs apply: Karpenter never evicts mirror pods or pods that
// tolerate its disrupted taint.
func podEvictable(p *corev1.Pod) bool {
	return podActive(p) && !podMirror(p) && !toleratesDisruptedTaint(p)
}

func toleratesDisruptedTaint(p *corev1.Pod) bool {
	for _, t := range p.Spec.Tolerations {
		if t.Effect != "" && t.Effect != corev1.TaintEffectNoSchedule {
			continue
		}
		switch t.Operator {
		case corev1.TolerationOpExists:
			if t.Key == "" || t.Key == karpenterDisruptedTaint {
				return true
			}
		case corev1.TolerationOpEqual, "":
			if t.Key == karpenterDisruptedTaint && t.Value == "" {
				return true
			}
		}
	}
	return false
}

// doNotDisruptActive mirrors Karpenter's IsDoNotDisruptActive: "true" holds
// for good, a duration (Karpenter 1.12+) only that long after the pod
// started, and any other value is ignored. until is set for a duration.
func doNotDisruptActive(p *corev1.Pod, now time.Time) (active bool, until time.Time) {
	value, ok := p.Annotations[karpenterDoNotDisrupt]
	if !ok {
		return false, time.Time{}
	}
	if value == "true" {
		return true, time.Time{}
	}
	d, err := time.ParseDuration(value)
	if err != nil || d <= 0 {
		return false, time.Time{}
	}
	if p.Status.StartTime == nil {
		return true, time.Time{}
	}
	until = p.Status.StartTime.Add(d)
	return now.Before(until), until
}

// pdbBlocksEviction is Karpenter's single-PDB check: a PDB that allows no
// disruptions blocks eviction, except of a not-ready pod when its
// unhealthyPodEvictionPolicy is AlwaysAllow.
func pdbBlocksEviction(pdb *policyv1.PodDisruptionBudget, p *corev1.Pod) bool {
	if pdb.Spec.UnhealthyPodEvictionPolicy != nil && *pdb.Spec.UnhealthyPodEvictionPolicy == policyv1.AlwaysAllow {
		for _, c := range p.Status.Conditions {
			if c.Type == corev1.PodReady && c.Status == corev1.ConditionFalse {
				return false
			}
		}
	}
	return pdb.Status.DisruptionsAllowed == 0
}

// matchingPDBs lists the PDBs whose selector picks the pod. An empty
// selector picks every pod in the namespace; a missing one picks none.
func matchingPDBs(p *corev1.Pod, pdbs []*policyv1.PodDisruptionBudget) []*policyv1.PodDisruptionBudget {
	var out []*policyv1.PodDisruptionBudget
	for _, pdb := range pdbs {
		if pdb.Namespace != p.Namespace || pdb.Spec.Selector == nil {
			continue
		}
		sel, err := metav1.LabelSelectorAsSelector(pdb.Spec.Selector)
		if err != nil {
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
// Karpenter applies one of 10%. As in BuildDisruptionBudgetMapping, the
// nodes already disrupting count against every active budget.
func evaluateBudgets(pool *unstructured.Unstructured, poolNodes, disrupting int, now time.Time) []KarpenterBudget {
	raw, found, _ := nestedSliceNoCopy(pool.Object, "spec", "disruption", "budgets")
	if !found {
		raw = []any{map[string]any{"nodes": "10%"}}
	}
	out := make([]KarpenterBudget, 0, len(raw))
	for _, item := range raw {
		m, _ := item.(map[string]any)
		b := KarpenterBudget{Reasons: []string{}, Allowed: -1, Remaining: -1}
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
			b.Remaining = max(b.Allowed-int64(disrupting), 0)
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
