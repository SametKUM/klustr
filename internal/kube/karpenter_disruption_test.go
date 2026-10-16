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
	clienttesting "k8s.io/client-go/testing"
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
    - {type: Initialized, status: "True", reason: Initialized, lastTransitionTime: "2026-10-16T08:00:00Z"}
    - {type: Consolidatable, status: "True", reason: Consolidatable}
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

// disruptionNode is a registered, initialized and Ready Karpenter node.
func disruptionNode(annotations map[string]string) *corev1.Node {
	n := &corev1.Node{ObjectMeta: metav1.ObjectMeta{
		Name: "ip-10-0-1-5.eu-central-1.compute.internal",
		Labels: map[string]string{
			karpenterNodePoolLabel: "general", karpenterRegisteredLabel: "true", karpenterInitializedLabel: "true",
		},
		Annotations: annotations,
	}}
	n.Status.Conditions = []corev1.NodeCondition{{Type: corev1.NodeReady, Status: corev1.ConditionTrue}}
	return n
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
	if len(d.Blockers) != 0 || len(d.Blocked) != 0 || d.Blocked == nil || d.Incomplete == nil {
		t.Fatalf("blockers = %+v, blocked = %#v, incomplete = %#v; want none, as empty slices", d.Blockers, d.Blocked, d.Incomplete)
	}
	// No budgets set: Karpenter's default 10% of 4 nodes rounds up to 1.
	if want := []KarpenterBudget{{Nodes: "10%", Reasons: []string{}, Active: true, Allowed: 1, Remaining: 1}}; !reflect.DeepEqual(d.Budgets, want) {
		t.Fatalf("budgets = %+v, want %+v", d.Budgets, want)
	}
	if d.ExpireAfter != "720h" || d.LastPodEventTime != "2026-10-16T09:00:00Z" {
		t.Fatalf("pool/claim details = %+v", d)
	}
}

func TestKarpenterDisruptionBlockers(t *testing.T) {
	logs := disruptionPod("logs-x", map[string]string{"app": "db"}, map[string]string{karpenterDoNotDisrupt: "true"}, "DaemonSet")
	logs.Spec.Tolerations = []corev1.Toleration{{Operator: corev1.TolerationOpExists}}
	pods := []*corev1.Pod{
		disruptionPod("batch-1", nil, map[string]string{karpenterDoNotDisrupt: "true"}, "Job"),
		disruptionPod("db-0", map[string]string{"app": "db"}, nil, "StatefulSet"),
		disruptionPod("web-1", map[string]string{"app": "web", "tier": "front"}, nil, "ReplicaSet"),
		// DaemonSet and mirror pods stay on the node, but the annotation
		// still blocks; PDBs skip pods tolerating the disrupted taint and
		// mirror pods, which Karpenter never evicts.
		logs,
		disruptionPod("kube-proxy", map[string]string{"app": "db"}, map[string]string{mirrorPodAnnotation: "x"}, ""),
		disruptionPod("etcd", nil, map[string]string{mirrorPodAnnotation: "x", karpenterDoNotDisrupt: "true"}, ""),
		// A finished pod holds nothing.
		func() *corev1.Pod {
			p := disruptionPod("done", map[string]string{"app": "db"}, map[string]string{karpenterDoNotDisrupt: "true"}, "Job")
			p.Status.Phase = corev1.PodSucceeded
			return p
		}(),
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
		"pod:logs-x",
		"pod:etcd",
		"policy:general",
		"budget:general",
	}
	if got := blockerKinds(d); !reflect.DeepEqual(got, want) {
		t.Fatalf("blockers = %v\nwant %v", got, want)
	}
	if !strings.Contains(d.Blockers[3].Message, "front, web") {
		t.Fatalf("multi-PDB message = %q", d.Blockers[3].Message)
	}
	if !strings.Contains(d.Blockers[6].Message, "runs 3 pods") {
		t.Fatalf("WhenEmpty message = %q", d.Blockers[6].Message)
	}
	if !strings.Contains(d.Blockers[7].Message, "Drifted") {
		t.Fatalf("budget message = %q", d.Blockers[7].Message)
	}
	if len(d.Pods) != 5 {
		t.Fatalf("pods = %+v, want batch-1, db-0, web-1, logs-x and etcd", d.Pods)
	}
	if !reflect.DeepEqual(d.Blocked, voluntaryDisruptions) {
		t.Fatalf("blocked = %v", d.Blocked)
	}
}

// Each blocker holds back only the reasons Karpenter checks it for.
func TestKarpenterDisruptionScopes(t *testing.T) {
	claimWithGrace := disruptionNodeClaim(t, "")
	if err := unstructured.SetNestedField(claimWithGrace.Object, "1h", "spec", "terminationGracePeriod"); err != nil {
		t.Fatal(err)
	}
	pods := []*corev1.Pod{disruptionPod("batch-1", nil, map[string]string{karpenterDoNotDisrupt: "true"}, "Job")}
	cases := []struct {
		name        string
		claim       *unstructured.Unstructured
		pods        []*corev1.Pod
		disruption  string
		poolNodes   int
		disrupting  int
		wantReasons [][]string
		wantBlocked []string
	}{
		{
			name: "pod blocker without a drain bound", claim: disruptionNodeClaim(t, ""), pods: pods,
			disruption:  "consolidateAfter: 0s",
			wantReasons: [][]string{voluntaryDisruptions}, wantBlocked: voluntaryDisruptions,
		},
		{
			name: "drift ignores pod blockers with terminationGracePeriod", claim: claimWithGrace, pods: pods,
			disruption:  "consolidateAfter: 0s",
			wantReasons: [][]string{consolidationDisruptions}, wantBlocked: consolidationDisruptions,
		},
		{
			name: "consolidateAfter Never leaves drift", claim: disruptionNodeClaim(t, ""),
			disruption:  "consolidateAfter: Never",
			wantReasons: [][]string{consolidationDisruptions}, wantBlocked: consolidationDisruptions,
		},
		{
			name: "a drift-only budget leaves consolidation", claim: disruptionNodeClaim(t, ""),
			disruption:  `consolidateAfter: 0s, budgets: [{nodes: "0", reasons: [Drifted]}, {nodes: "0", reasons: [Unhealthy]}]`,
			wantReasons: [][]string{{disruptionDrifted}}, wantBlocked: []string{disruptionDrifted},
		},
		{
			// Karpenter's default 10% of a 10-node pool allows 1, and the
			// one NotReady node has used it up.
			name: "a budget used up by disrupting nodes", claim: disruptionNodeClaim(t, ""),
			disruption: "consolidateAfter: 0s", poolNodes: 10, disrupting: 1,
			wantReasons: [][]string{voluntaryDisruptions}, wantBlocked: voluntaryDisruptions,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			d := analyzeKarpenterDisruption(disruptionInput{
				node: disruptionNode(nil), nodeClaim: tc.claim, nodePool: disruptionNodePool(t, tc.disruption),
				pods: tc.pods, poolNodes: tc.poolNodes, poolDisrupting: tc.disrupting, now: time.Now(),
			})
			got := make([][]string, 0, len(d.Blockers))
			for _, b := range d.Blockers {
				got = append(got, b.Reasons)
			}
			if !reflect.DeepEqual(got, tc.wantReasons) || !reflect.DeepEqual(d.Blocked, tc.wantBlocked) {
				t.Fatalf("blockers = %+v\nblocked = %v, want reasons %v and blocked %v", d.Blockers, d.Blocked, tc.wantReasons, tc.wantBlocked)
			}
			if tc.disrupting > 0 && (d.PoolDisrupting != tc.disrupting || !strings.Contains(d.Blockers[0].Message, "in the pool (1) already use that up")) {
				t.Fatalf("disrupting = %d, message %q", d.PoolDisrupting, d.Blockers[0].Message)
			}
		})
	}
}

// Karpenter reads the node-level annotation from the NodeClaim until the
// node registers, and from the Node after.
func TestKarpenterDisruptionAnnotationSource(t *testing.T) {
	unregistered := disruptionNode(nil)
	delete(unregistered.Labels, karpenterRegisteredLabel)
	cases := []struct {
		name string
		node *corev1.Node
		want []string
	}{
		{"registered node without the annotation", disruptionNode(nil), []string{}},
		{"node not registered yet", unregistered, []string{"annotation:general-x7k2p"}},
		{"no node yet", nil, []string{"annotation:general-x7k2p"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			d := analyzeKarpenterDisruption(disruptionInput{
				node: tc.node, nodeClaim: disruptionNodeClaim(t, `karpenter.sh/do-not-disrupt: "true"`), now: time.Now(),
			})
			if got := blockerKinds(d); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("blockers = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestKarpenterDisruptionConsolidateNever(t *testing.T) {
	node := disruptionNode(nil)
	delete(node.Labels, karpenterRegisteredLabel)
	d := analyzeKarpenterDisruption(disruptionInput{
		node:      node,
		nodeClaim: disruptionNodeClaim(t, `karpenter.sh/do-not-disrupt: "true"`),
		nodePool:  disruptionNodePool(t, "consolidateAfter: Never"),
		now:       time.Now(),
	})
	if got := blockerKinds(d); !reflect.DeepEqual(got, []string{"annotation:general-x7k2p", "policy:general"}) {
		t.Fatalf("blockers = %v", got)
	}
}

// Until consolidateAfter has passed since the last pod change, Karpenter
// leaves Consolidatable unset and neither empties nor consolidates the node.
func TestKarpenterDisruptionConsolidateAfter(t *testing.T) {
	lastPodEvent := time.Date(2026, 10, 16, 9, 0, 0, 0, time.UTC)
	withoutCondition := func(t *testing.T, lastPodEventTime string) *unstructured.Unstructured {
		claim := disruptionNodeClaim(t, "")
		conds, _, _ := unstructured.NestedSlice(claim.Object, "status", "conditions")
		if err := unstructured.SetNestedSlice(claim.Object, conds[:1], "status", "conditions"); err != nil {
			t.Fatal(err)
		}
		if err := unstructured.SetNestedField(claim.Object, lastPodEventTime, "status", "lastPodEventTime"); err != nil {
			t.Fatal(err)
		}
		return claim
	}
	cases := []struct {
		name      string
		claim     *unstructured.Unstructured
		now       time.Time
		wantUntil string
		wantMsg   string
	}{
		{"within the window", withoutCondition(t, "2026-10-16T09:00:00Z"), lastPodEvent.Add(2 * time.Minute), "2026-10-16T09:10:00Z", "since pods last changed"},
		{"counted from initialization", withoutCondition(t, ""), time.Date(2026, 10, 16, 8, 5, 0, 0, time.UTC), "2026-10-16T08:10:00Z", "since the node initialized"},
		{"past the window, condition not set", withoutCondition(t, "2026-10-16T09:00:00Z"), lastPodEvent.Add(time.Hour), "", "not marked Consolidatable"},
		{"past the window, Consolidatable", disruptionNodeClaim(t, ""), lastPodEvent.Add(time.Hour), "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			d := analyzeKarpenterDisruption(disruptionInput{
				node: disruptionNode(nil), nodeClaim: tc.claim, nodePool: disruptionNodePool(t, "consolidateAfter: 10m"), now: tc.now,
			})
			if tc.wantMsg == "" {
				if len(d.Blockers) != 0 {
					t.Fatalf("blockers = %+v, want none", d.Blockers)
				}
				return
			}
			if len(d.Blockers) != 1 {
				t.Fatalf("blockers = %+v, want the consolidateAfter one", d.Blockers)
			}
			b := d.Blockers[0]
			if !strings.Contains(b.Message, tc.wantMsg) || b.Until != tc.wantUntil || !reflect.DeepEqual(b.Reasons, consolidationDisruptions) {
				t.Fatalf("blocker = %+v, want %q until %q", b, tc.wantMsg, tc.wantUntil)
			}
		})
	}
}

func TestDoNotDisruptActive(t *testing.T) {
	now := time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC)
	pod := func(value string, started time.Duration) *corev1.Pod {
		p := disruptionPod("p", nil, map[string]string{karpenterDoNotDisrupt: value}, "")
		if started > 0 {
			p.Status.StartTime = &metav1.Time{Time: now.Add(-started)}
		}
		return p
	}
	cases := []struct {
		name   string
		pod    *corev1.Pod
		active bool
		until  string
	}{
		{"true", pod("true", time.Hour), true, ""},
		{"duration still running", pod("30m", 10*time.Minute), true, "2026-10-16T12:20:00Z"},
		{"duration passed", pod("30m", time.Hour), false, "2026-10-16T11:30:00Z"},
		{"duration before the pod started", pod("30m", 0), true, ""},
		{"invalid value", pod("yes", time.Hour), false, ""},
		{"no annotation", disruptionPod("p", nil, nil, ""), false, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			active, until := doNotDisruptActive(tc.pod, now)
			gotUntil := ""
			if !until.IsZero() {
				gotUntil = until.UTC().Format(time.RFC3339)
			}
			if active != tc.active || gotUntil != tc.until {
				t.Fatalf("active = %v until %q, want %v until %q", active, gotUntil, tc.active, tc.until)
			}
		})
	}
}

func TestMatchingPDBsSelectors(t *testing.T) {
	everything := disruptionPDB("all", nil, 0)
	everything.Spec.Selector = &metav1.LabelSelector{}
	none := disruptionPDB("none", nil, 0)
	none.Spec.Selector = nil
	other := disruptionPDB("other-ns", nil, 0)
	other.Namespace = "billing"
	other.Spec.Selector = &metav1.LabelSelector{}
	got := matchingPDBs(disruptionPod("api-1", map[string]string{"app": "api"}, nil, "ReplicaSet"), []*policyv1.PodDisruptionBudget{everything, none, other})
	if len(got) != 1 || got[0].Name != "all" {
		t.Fatalf("matching = %v, want only the empty-selector PDB in the pod's namespace", got)
	}
}

func TestPDBBlocksEvictionUnhealthyPods(t *testing.T) {
	alwaysAllow := policyv1.AlwaysAllow
	ifHealthy := policyv1.IfHealthyBudget
	pdb := func(policy *policyv1.UnhealthyPodEvictionPolicyType) *policyv1.PodDisruptionBudget {
		p := disruptionPDB("db", map[string]string{"app": "db"}, 0)
		p.Spec.UnhealthyPodEvictionPolicy = policy
		return p
	}
	pod := func(ready corev1.ConditionStatus) *corev1.Pod {
		p := disruptionPod("db-0", map[string]string{"app": "db"}, nil, "StatefulSet")
		p.Status.Conditions = []corev1.PodCondition{{Type: corev1.PodReady, Status: ready}}
		return p
	}
	cases := []struct {
		name string
		pdb  *policyv1.PodDisruptionBudget
		pod  *corev1.Pod
		want bool
	}{
		{"AlwaysAllow, not ready", pdb(&alwaysAllow), pod(corev1.ConditionFalse), false},
		{"AlwaysAllow, ready", pdb(&alwaysAllow), pod(corev1.ConditionTrue), true},
		{"IfHealthyBudget, not ready", pdb(&ifHealthy), pod(corev1.ConditionFalse), true},
		{"no policy, not ready", pdb(nil), pod(corev1.ConditionFalse), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := pdbBlocksEviction(tc.pdb, tc.pod); got != tc.want {
				t.Fatalf("blocks = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestPoolDisruptingNodes(t *testing.T) {
	notReady := disruptionNode(nil)
	notReady.Status.Conditions[0].Status = corev1.ConditionFalse
	deleting := disruptionNode(nil)
	deleting.DeletionTimestamp = &metav1.Time{Time: time.Now()}
	tainted := disruptionNode(nil)
	tainted.Spec.Taints = []corev1.Taint{{Key: karpenterDisruptedTaint, Effect: corev1.TaintEffectNoSchedule}}
	// Uninitialized nodes count toward neither the pool nor its budgets.
	launching := disruptionNode(nil)
	delete(launching.Labels, karpenterInitializedLabel)
	launching.Status.Conditions = nil
	if got := poolDisruptingNodes([]*corev1.Node{disruptionNode(nil), notReady, deleting, tainted, launching}); got != 3 {
		t.Fatalf("disrupting = %d, want 3", got)
	}
}

func TestPoolNodeCount(t *testing.T) {
	members := []*corev1.Node{disruptionNode(nil), disruptionNode(nil)}
	pool := func(status string) *unstructured.Unstructured {
		return mustUnstructured(t, "apiVersion: karpenter.sh/v1\nkind: NodePool\nmetadata: {name: general}\nstatus: {"+status+"}\n")
	}
	cases := []struct {
		name string
		pool *unstructured.Unstructured
		want int
	}{
		{"status.nodes (1.15+)", pool(`nodes: 7, resources: {nodes: "5"}`), 7},
		{"status.resources.nodes", pool(`resources: {nodes: "5"}`), 5},
		{"cached nodes", pool(""), 2},
		{"no NodePool", nil, 2},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := poolNodeCount(tc.pool, members); got != tc.want {
				t.Fatalf("count = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestEvaluateBudgets(t *testing.T) {
	// A budget blocking weekdays 09:00–17:00 UTC, and one of 20%.
	pool := disruptionNodePool(t, `budgets: [{nodes: "0", schedule: "0 9 * * mon-fri", duration: 8h}, {nodes: "20%", reasons: [Underutilized, Empty]}, {nodes: "1", schedule: "not a cron", duration: 1h}]`)
	thursdayNoon := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	got := evaluateBudgets(pool, 12, 0, thursdayNoon)
	if !got[0].Active || got[0].Allowed != 0 || got[0].Remaining != 0 {
		t.Fatalf("business-hours budget at noon = %+v", got[0])
	}
	if !got[1].Active || got[1].Allowed != 3 || got[1].Remaining != 3 || !reflect.DeepEqual(got[1].Reasons, []string{"Underutilized", "Empty"}) {
		t.Fatalf("20%% of 12 = %+v, want 3 (rounded up)", got[1])
	}
	// Karpenter fails closed on a schedule it cannot parse.
	if !got[2].Active || got[2].Allowed != 0 || got[2].Error == "" {
		t.Fatalf("broken schedule = %+v", got[2])
	}
	thursdayNight := time.Date(2026, 10, 15, 20, 0, 0, 0, time.UTC)
	if b := evaluateBudgets(pool, 12, 0, thursdayNight)[0]; b.Active || b.Allowed != -1 || b.Remaining != -1 {
		t.Fatalf("business-hours budget at night = %+v", b)
	}
	saturday := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	if b := evaluateBudgets(pool, 12, 0, saturday)[0]; b.Active {
		t.Fatalf("weekday budget on Saturday = %+v", b)
	}
	// Nodes already disrupting or NotReady use up allowance, never below 0.
	got = evaluateBudgets(pool, 12, 2, thursdayNoon)
	if got[1].Allowed != 3 || got[1].Remaining != 1 || got[0].Remaining != 0 {
		t.Fatalf("with 2 disrupting = %+v", got)
	}
}

func disruptionManager(t *testing.T, objs ...runtime.Object) (*ClientManager, *fake.Clientset, informers.SharedInformerFactory) {
	t.Helper()
	nodeClaimGVR := karpenterNodeClaimGR.WithVersion("v1")
	nodePoolGVR := karpenterNodePoolGR.WithVersion("v1")
	m, _ := fakeCRDManager(t, []fakeCRD{{gvr: nodeClaimGVR, kind: "NodeClaim"}, {gvr: nodePoolGVR, kind: "NodePool"}},
		disruptionNodeClaim(t, ""), disruptionNodePool(t, "consolidateAfter: Never"))
	cs := fake.NewClientset(objs...)
	f := informers.NewSharedInformerFactory(cs, 0)
	if err := f.Core().V1().Pods().Informer().AddIndexers(podIndexers); err != nil {
		t.Fatal(err)
	}
	f.Core().V1().Nodes().Informer()
	f.Policy().V1().PodDisruptionBudgets().Informer()
	w := m.watchers["ctx"]
	w.cs, w.factory = cs, f
	return m, cs, f
}

// GetKarpenterDisruption finds the NodeClaim through the node's owner
// reference, the pool through its label, and keeps only Karpenter's events.
func TestGetKarpenterDisruption(t *testing.T) {
	node := disruptionNode(nil)
	node.OwnerReferences = []metav1.OwnerReference{{APIVersion: "karpenter.sh/v1", Kind: "NodeClaim", Name: "general-x7k2p"}}
	pod := disruptionPod("db-0", map[string]string{"app": "db"}, nil, "StatefulSet")
	pod.Spec.NodeName = node.Name
	m, cs, f := disruptionManager(t,
		node, pod, disruptionPDB("db", map[string]string{"app": "db"}, 0),
		&corev1.Event{ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "a"}, Reason: "DisruptionBlocked", Message: "Cannot disrupt Node",
			InvolvedObject: corev1.ObjectReference{Kind: "Node", Name: node.Name}},
		&corev1.Event{ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "b"}, Reason: "NodeReady",
			InvolvedObject: corev1.ObjectReference{Kind: "Node", Name: node.Name}},
		&corev1.Event{ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "c"}, Reason: "DisruptionBlocked", Message: "No allowed disruptions due to blocking budget",
			InvolvedObject: corev1.ObjectReference{Kind: "NodePool", Name: "general"}},
	)
	// The PDB informer starts with the report, as it does when this tab is
	// the first to need PDBs, and its first LIST is slow: the report has to
	// wait for it instead of reading an empty cache.
	cs.PrependReactor("list", "poddisruptionbudgets", func(clienttesting.Action) (bool, runtime.Object, error) {
		time.Sleep(300 * time.Millisecond)
		return false, nil, nil
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	f.Start(ctx.Done())

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
	if len(d.Incomplete) != 0 {
		t.Fatalf("incomplete = %v with cluster-wide access", d.Incomplete)
	}

	// Opened from the NodeClaim, the node comes from status.nodeName.
	d, err = m.GetKarpenterDisruption(context.Background(), "ctx", "", "general-x7k2p")
	if err != nil || d.NodeName != node.Name {
		t.Fatalf("from NodeClaim: %+v, %v", d, err)
	}
}

// Without cluster-wide reads of Pods or PDBs the report cannot rule out
// blockers it does not see, and says so.
func TestGetKarpenterDisruptionIncomplete(t *testing.T) {
	node := disruptionNode(nil)
	node.OwnerReferences = []metav1.OwnerReference{{APIVersion: "karpenter.sh/v1", Kind: "NodeClaim", Name: "general-x7k2p"}}
	m, _, f := disruptionManager(t, node)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	f.Start(ctx.Done())
	m.watchers["ctx"].access = &contextAccess{kinds: map[string]KindAccess{
		"Node":                {Mode: AccessCluster},
		"Pod":                 {Mode: AccessNamespaced, Namespace: "shop"},
		"PodDisruptionBudget": {Mode: AccessDenied},
	}}
	d, err := m.GetKarpenterDisruption(context.Background(), "ctx", node.Name, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Incomplete) != 2 || !strings.HasPrefix(d.Incomplete[0], "Pods ") || !strings.HasPrefix(d.Incomplete[1], "PodDisruptionBudgets ") {
		t.Fatalf("incomplete = %v", d.Incomplete)
	}
}

func TestWaitForInformerIsBounded(t *testing.T) {
	// Never started, so it never syncs: the wait ends with its context.
	informer := cache.NewSharedIndexInformer(&cache.ListWatch{}, &corev1.Node{}, 0, cache.Indexers{})
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	start := time.Now()
	waitForInformer(ctx, informer)
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Fatalf("wait took %v", elapsed)
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
