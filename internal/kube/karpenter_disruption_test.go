package kube

import (
	"context"
	"reflect"
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/tools/cache"
)

func disruptionNodeClaim(t *testing.T, annotations string) *unstructured.Unstructured {
	t.Helper()
	return mustUnstructured(t, `
apiVersion: karpenter.sh/v1
kind: NodeClaim
metadata:
  name: general-x7k2p
  labels: {karpenter.sh/nodepool: general, karpenter.sh/capacity-type: spot}
  annotations: {`+annotations+`}
status:
  nodeName: ip-10-0-1-5.eu-central-1.compute.internal
  lastPodEventTime: "2026-10-16T09:00:00Z"
  conditions:
    - {type: Initialized, status: "True", reason: Initialized}
    - {type: Consolidatable, status: "False", reason: NotConsolidatable}
`)
}

func disruptionNodePool(t *testing.T, disruption string) *unstructured.Unstructured {
	t.Helper()
	return mustUnstructured(t, `
apiVersion: karpenter.sh/v1
kind: NodePool
metadata: {name: general}
spec:
  template: {spec: {expireAfter: 720h}}
  disruption: {`+disruption+`}
`)
}

func disruptionNode(annotations map[string]string) *corev1.Node {
	return &corev1.Node{ObjectMeta: metav1.ObjectMeta{
		Name:        "ip-10-0-1-5.eu-central-1.compute.internal",
		Labels:      map[string]string{karpenterNodePoolLabel: "general"},
		Annotations: annotations,
	}}
}

func disruptionPod(name string, labels, annotations map[string]string, owner string) *corev1.Pod {
	p := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Namespace: "shop", Name: name, Labels: labels, Annotations: annotations}}
	if owner != "" {
		p.OwnerReferences = []metav1.OwnerReference{{Kind: owner, Name: "owner"}}
	}
	p.Status.Phase = corev1.PodRunning
	return p
}

func disruptionPDB(name string, match map[string]string, allowed int32) *policyv1.PodDisruptionBudget {
	return &policyv1.PodDisruptionBudget{
		ObjectMeta: metav1.ObjectMeta{Namespace: "shop", Name: name},
		Spec:       policyv1.PodDisruptionBudgetSpec{Selector: &metav1.LabelSelector{MatchLabels: match}},
		Status:     policyv1.PodDisruptionBudgetStatus{DisruptionsAllowed: allowed},
	}
}

func blockerKinds(d *KarpenterDisruption) []string {
	out := make([]string, 0, len(d.Blockers))
	for _, b := range d.Blockers {
		out = append(out, b.Kind+":"+b.Name)
	}
	return out
}

func TestKarpenterDisruptionUnmanagedNode(t *testing.T) {
	d := analyzeKarpenterDisruption(disruptionInput{node: &corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "kind-worker"}}})
	if d.Managed || len(d.Blockers) != 0 {
		t.Fatalf("unmanaged node = %+v", d)
	}
}

func TestKarpenterDisruptionNothingBlocks(t *testing.T) {
	d := analyzeKarpenterDisruption(disruptionInput{
		node:      disruptionNode(nil),
		nodeClaim: disruptionNodeClaim(t, ""),
		nodePool:  disruptionNodePool(t, "consolidationPolicy: WhenEmptyOrUnderutilized, consolidateAfter: 1m"),
		pods:      []*corev1.Pod{disruptionPod("api-1", map[string]string{"app": "api"}, nil, "ReplicaSet")},
		pdbs:      []*policyv1.PodDisruptionBudget{disruptionPDB("api", map[string]string{"app": "api"}, 1)},
		poolNodes: 4,
		now:       time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC),
	})
	if !d.Managed || d.NodeClaim != "general-x7k2p" || d.NodePool != "general" || d.CapacityType != "spot" {
		t.Fatalf("identity = %+v", d)
	}
	if len(d.Blockers) != 0 {
		t.Fatalf("blockers = %+v, want none", d.Blockers)
	}
	// No budgets set: Karpenter's default 10% of 4 nodes rounds up to 1.
	if want := []KarpenterBudget{{Nodes: "10%", Reasons: []string{}, Active: true, Allowed: 1}}; !reflect.DeepEqual(d.Budgets, want) {
		t.Fatalf("budgets = %+v, want %+v", d.Budgets, want)
	}
	if d.ExpireAfter != "720h" || d.LastPodEventTime != "2026-10-16T09:00:00Z" {
		t.Fatalf("pool/claim details = %+v", d)
	}
}

func TestKarpenterDisruptionBlockers(t *testing.T) {
	pods := []*corev1.Pod{
		disruptionPod("batch-1", nil, map[string]string{karpenterDoNotDisrupt: "true"}, "Job"),
		disruptionPod("db-0", map[string]string{"app": "db"}, nil, "StatefulSet"),
		disruptionPod("web-1", map[string]string{"app": "web", "tier": "front"}, nil, "ReplicaSet"),
		// DaemonSet and static pods stay on the node, so their PDBs and
		// annotations do not matter.
		disruptionPod("logs-x", map[string]string{"app": "db"}, map[string]string{karpenterDoNotDisrupt: "true"}, "DaemonSet"),
		disruptionPod("kube-proxy", map[string]string{"app": "db"}, map[string]string{mirrorPodAnnotation: "x"}, ""),
	}
	d := analyzeKarpenterDisruption(disruptionInput{
		node:      disruptionNode(map[string]string{karpenterDoNotDisrupt: "true"}),
		nodeClaim: disruptionNodeClaim(t, ""),
		nodePool:  disruptionNodePool(t, `consolidationPolicy: WhenEmpty, budgets: [{nodes: "0", reasons: [Drifted]}]`),
		pods:      pods,
		pdbs: []*policyv1.PodDisruptionBudget{
			disruptionPDB("db", map[string]string{"app": "db"}, 0),
			disruptionPDB("web", map[string]string{"app": "web"}, 1),
			disruptionPDB("front", map[string]string{"tier": "front"}, 1),
		},
		poolNodes: 3,
		now:       time.Now(),
	})
	want := []string{
		"annotation:ip-10-0-1-5.eu-central-1.compute.internal",
		"pod:batch-1",
		"pdb:db",
		"pdb:web-1",
		"policy:general",
		"budget:general",
	}
	if got := blockerKinds(d); !reflect.DeepEqual(got, want) {
		t.Fatalf("blockers = %v\nwant %v", got, want)
	}
	if !strings.Contains(d.Blockers[3].Message, "front, web") {
		t.Fatalf("multi-PDB message = %q", d.Blockers[3].Message)
	}
	if !strings.Contains(d.Blockers[4].Message, "runs 3 pods") {
		t.Fatalf("WhenEmpty message = %q", d.Blockers[4].Message)
	}
	if !strings.Contains(d.Blockers[5].Message, "Drifted") {
		t.Fatalf("budget message = %q", d.Blockers[5].Message)
	}
	if len(d.Pods) != 3 {
		t.Fatalf("pods = %+v, want batch-1, db-0 and web-1", d.Pods)
	}
}

func TestKarpenterDisruptionConsolidateNever(t *testing.T) {
	d := analyzeKarpenterDisruption(disruptionInput{
		node:      disruptionNode(nil),
		nodeClaim: disruptionNodeClaim(t, `karpenter.sh/do-not-disrupt: "true"`),
		nodePool:  disruptionNodePool(t, "consolidateAfter: Never"),
		now:       time.Now(),
	})
	if got := blockerKinds(d); !reflect.DeepEqual(got, []string{"annotation:general-x7k2p", "policy:general"}) {
		t.Fatalf("blockers = %v", got)
	}
}

func TestKarpenterDisruptionInProgress(t *testing.T) {
	node := disruptionNode(nil)
	node.Spec.Taints = []corev1.Taint{{Key: karpenterDisruptedTaint, Effect: corev1.TaintEffectNoSchedule}}
	claim := disruptionNodeClaim(t, "")
	conds, _, _ := unstructured.NestedSlice(claim.Object, "status", "conditions")
	conds = append(conds, map[string]any{"type": "DisruptionReason", "status": "True", "reason": "Underutilized"})
	if err := unstructured.SetNestedSlice(claim.Object, conds, "status", "conditions"); err != nil {
		t.Fatal(err)
	}
	d := analyzeKarpenterDisruption(disruptionInput{node: node, nodeClaim: claim, now: time.Now()})
	if !d.Disrupting || d.DisruptionReason != "Underutilized" {
		t.Fatalf("disrupting = %v %q", d.Disrupting, d.DisruptionReason)
	}
}

func TestEvaluateBudgets(t *testing.T) {
	// A budget blocking weekdays 09:00–17:00 UTC, and one of 20%.
	pool := disruptionNodePool(t, `budgets: [{nodes: "0", schedule: "0 9 * * mon-fri", duration: 8h}, {nodes: "20%", reasons: [Underutilized, Empty]}, {nodes: "1", schedule: "not a cron", duration: 1h}]`)
	thursdayNoon := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	got := evaluateBudgets(pool, 12, thursdayNoon)
	if !got[0].Active || got[0].Allowed != 0 {
		t.Fatalf("business-hours budget at noon = %+v", got[0])
	}
	if !got[1].Active || got[1].Allowed != 3 || !reflect.DeepEqual(got[1].Reasons, []string{"Underutilized", "Empty"}) {
		t.Fatalf("20%% of 12 = %+v, want 3 (rounded up)", got[1])
	}
	// Karpenter fails closed on a schedule it cannot parse.
	if !got[2].Active || got[2].Allowed != 0 || got[2].Error == "" {
		t.Fatalf("broken schedule = %+v", got[2])
	}
	thursdayNight := time.Date(2026, 10, 15, 20, 0, 0, 0, time.UTC)
	if b := evaluateBudgets(pool, 12, thursdayNight)[0]; b.Active || b.Allowed != -1 {
		t.Fatalf("business-hours budget at night = %+v", b)
	}
	saturday := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	if b := evaluateBudgets(pool, 12, saturday)[0]; b.Active {
		t.Fatalf("weekday budget on Saturday = %+v", b)
	}
}

// GetKarpenterDisruption finds the NodeClaim through the node's owner
// reference, the pool through its label, and keeps only Karpenter's events.
func TestGetKarpenterDisruption(t *testing.T) {
	nodeClaimGVR := karpenterNodeClaimGR.WithVersion("v1")
	nodePoolGVR := karpenterNodePoolGR.WithVersion("v1")
	m, _ := fakeCRDManager(t, []fakeCRD{{gvr: nodeClaimGVR, kind: "NodeClaim"}, {gvr: nodePoolGVR, kind: "NodePool"}},
		disruptionNodeClaim(t, ""), disruptionNodePool(t, "consolidateAfter: Never"))

	node := disruptionNode(nil)
	node.OwnerReferences = []metav1.OwnerReference{{APIVersion: "karpenter.sh/v1", Kind: "NodeClaim", Name: "general-x7k2p"}}
	pod := disruptionPod("db-0", map[string]string{"app": "db"}, nil, "StatefulSet")
	pod.Spec.NodeName = node.Name
	events := []runtime.Object{
		&corev1.Event{ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "a"}, Reason: "DisruptionBlocked", Message: "Cannot disrupt Node",
			InvolvedObject: corev1.ObjectReference{Kind: "Node", Name: node.Name}},
		&corev1.Event{ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "b"}, Reason: "NodeReady",
			InvolvedObject: corev1.ObjectReference{Kind: "Node", Name: node.Name}},
		&corev1.Event{ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "c"}, Reason: "DisruptionBlocked", Message: "No allowed disruptions due to blocking budget",
			InvolvedObject: corev1.ObjectReference{Kind: "NodePool", Name: "general"}},
	}
	cs := fake.NewClientset(events...)
	f := informers.NewSharedInformerFactory(cs, 0)
	if err := f.Core().V1().Pods().Informer().AddIndexers(podIndexers); err != nil {
		t.Fatal(err)
	}
	for store, obj := range map[cache.Store]any{
		f.Core().V1().Nodes().Informer().GetStore():                  node,
		f.Core().V1().Pods().Informer().GetStore():                   pod,
		f.Policy().V1().PodDisruptionBudgets().Informer().GetStore(): disruptionPDB("db", map[string]string{"app": "db"}, 0),
	} {
		if err := store.Add(obj); err != nil {
			t.Fatal(err)
		}
	}
	w := m.watchers["ctx"]
	w.cs, w.factory = cs, f

	d, err := m.GetKarpenterDisruption(context.Background(), "ctx", node.Name, "")
	if err != nil {
		t.Fatal(err)
	}
	if d.NodeClaim != "general-x7k2p" || d.NodePool != "general" {
		t.Fatalf("identity = %+v", d)
	}
	if got := blockerKinds(d); !reflect.DeepEqual(got, []string{"pdb:db", "policy:general"}) {
		t.Fatalf("blockers = %v", got)
	}
	if len(d.Events) != 2 {
		t.Fatalf("events = %+v, want the two DisruptionBlocked ones", d.Events)
	}

	// Opened from the NodeClaim, the node comes from status.nodeName.
	d, err = m.GetKarpenterDisruption(context.Background(), "ctx", "", "general-x7k2p")
	if err != nil || d.NodeName != node.Name {
		t.Fatalf("from NodeClaim: %+v, %v", d, err)
	}
}
