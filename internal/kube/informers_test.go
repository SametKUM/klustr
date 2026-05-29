package kube

import (
	"strings"
	"testing"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestFormatLabelSelector(t *testing.T) {
	if got := formatLabelSelector(nil); got != "<all>" {
		t.Errorf("nil selector: got %q, want <all>", got)
	}
	if got := formatLabelSelector(&metav1.LabelSelector{}); got != "<all>" {
		t.Errorf("empty selector: got %q, want <all>", got)
	}

	sel := &metav1.LabelSelector{
		MatchLabels: map[string]string{"app": "web", "tier": "front"},
		MatchExpressions: []metav1.LabelSelectorRequirement{
			{Key: "env", Operator: metav1.LabelSelectorOpIn, Values: []string{"prod", "staging"}},
		},
	}
	got := formatLabelSelector(sel)
	if !strings.Contains(got, "app=web") || !strings.Contains(got, "tier=front") {
		t.Errorf("missing match label in %q", got)
	}
	if !strings.Contains(got, "env In [prod staging]") {
		t.Errorf("missing match expression in %q", got)
	}

	sel2 := &metav1.LabelSelector{MatchLabels: map[string]string{"b": "2", "a": "1"}}
	got = formatLabelSelector(sel2)
	if !strings.HasPrefix(got, "a=1") {
		t.Errorf("match labels should be sorted, got %q", got)
	}
}

func TestFormatNodeSelector(t *testing.T) {
	if got := formatNodeSelector(nil); got != "<none>" {
		t.Errorf("nil: got %q, want <none>", got)
	}
	if got := formatNodeSelector(map[string]string{}); got != "<none>" {
		t.Errorf("empty: got %q, want <none>", got)
	}
	got := formatNodeSelector(map[string]string{"zone": "a", "arch": "amd64"})
	if got != "arch=amd64,zone=a" {
		t.Errorf("want sorted output, got %q", got)
	}
}

func TestNodeStatus(t *testing.T) {
	cases := []struct {
		name string
		node *corev1.Node
		want string
	}{
		{
			"ready",
			&corev1.Node{Status: corev1.NodeStatus{Conditions: []corev1.NodeCondition{{Type: corev1.NodeReady, Status: corev1.ConditionTrue}}}},
			"Ready",
		},
		{
			"notReady",
			&corev1.Node{Status: corev1.NodeStatus{Conditions: []corev1.NodeCondition{{Type: corev1.NodeReady, Status: corev1.ConditionFalse}}}},
			"NotReady",
		},
		{
			"readyButCordoned",
			&corev1.Node{
				Spec:   corev1.NodeSpec{Unschedulable: true},
				Status: corev1.NodeStatus{Conditions: []corev1.NodeCondition{{Type: corev1.NodeReady, Status: corev1.ConditionTrue}}},
			},
			"Ready,SchedulingDisabled",
		},
		{
			"missingCondition",
			&corev1.Node{},
			"Unknown",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nodeStatus(tc.node); got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestNodeRoles(t *testing.T) {
	if got := nodeRoles(&corev1.Node{}); got != "<none>" {
		t.Errorf("no roles: got %q, want <none>", got)
	}
	n := &corev1.Node{}
	n.Labels = map[string]string{
		"node-role.kubernetes.io/worker":        "",
		"node-role.kubernetes.io/control-plane": "",
		"node-role.kubernetes.io/":              "",
		"foo":                                   "bar",
	}
	if got := nodeRoles(n); got != "control-plane,worker" {
		t.Errorf("got %q, want sorted control-plane,worker", got)
	}
}

func TestNodeInternalIP(t *testing.T) {
	n := &corev1.Node{Status: corev1.NodeStatus{Addresses: []corev1.NodeAddress{
		{Type: corev1.NodeExternalIP, Address: "1.2.3.4"},
		{Type: corev1.NodeInternalIP, Address: "10.0.0.1"},
	}}}
	if got := nodeInternalIP(n); got != "10.0.0.1" {
		t.Errorf("got %q, want 10.0.0.1", got)
	}
	if got := nodeInternalIP(&corev1.Node{}); got != "" {
		t.Errorf("missing internal IP: got %q, want empty", got)
	}
}

func TestServiceClusterIP(t *testing.T) {
	if got := serviceClusterIP(&corev1.Service{}); got != "<none>" {
		t.Errorf("got %q, want <none>", got)
	}
	s := &corev1.Service{Spec: corev1.ServiceSpec{ClusterIP: "10.0.0.5"}}
	if got := serviceClusterIP(s); got != "10.0.0.5" {
		t.Errorf("got %q, want 10.0.0.5", got)
	}
}

func TestServiceExternalIP(t *testing.T) {
	if got := serviceExternalIP(&corev1.Service{}); got != "<none>" {
		t.Errorf("default: got %q, want <none>", got)
	}

	ext := &corev1.Service{Spec: corev1.ServiceSpec{Type: corev1.ServiceTypeExternalName, ExternalName: "foo.example"}}
	if got := serviceExternalIP(ext); got != "foo.example" {
		t.Errorf("ExternalName: got %q, want foo.example", got)
	}

	lbPending := &corev1.Service{Spec: corev1.ServiceSpec{Type: corev1.ServiceTypeLoadBalancer}}
	if got := serviceExternalIP(lbPending); got != "<pending>" {
		t.Errorf("LB pending: got %q, want <pending>", got)
	}

	lbReady := &corev1.Service{
		Spec: corev1.ServiceSpec{Type: corev1.ServiceTypeLoadBalancer},
		Status: corev1.ServiceStatus{LoadBalancer: corev1.LoadBalancerStatus{Ingress: []corev1.LoadBalancerIngress{
			{IP: "1.2.3.4"}, {Hostname: "lb.example"},
		}}},
	}
	if got := serviceExternalIP(lbReady); got != "1.2.3.4,lb.example" {
		t.Errorf("LB ready: got %q", got)
	}

	withExt := &corev1.Service{Spec: corev1.ServiceSpec{Type: corev1.ServiceTypeClusterIP, ExternalIPs: []string{"5.5.5.5"}}}
	if got := serviceExternalIP(withExt); got != "5.5.5.5" {
		t.Errorf("ExternalIPs: got %q, want 5.5.5.5", got)
	}
}

func TestServicePorts(t *testing.T) {
	if got := servicePorts(&corev1.Service{}); got != "<none>" {
		t.Errorf("empty: got %q, want <none>", got)
	}
	s := &corev1.Service{Spec: corev1.ServiceSpec{Ports: []corev1.ServicePort{
		{Port: 80, Protocol: corev1.ProtocolTCP},
		{Port: 443, NodePort: 30443, Protocol: corev1.ProtocolTCP},
	}}}
	if got := servicePorts(s); got != "80/TCP,443:30443/TCP" {
		t.Errorf("got %q", got)
	}
}

func TestJobStatus(t *testing.T) {
	now := metav1.Now()

	complete := &batchv1.Job{Status: batchv1.JobStatus{Conditions: []batchv1.JobCondition{
		{Type: batchv1.JobComplete, Status: corev1.ConditionTrue},
	}}}
	if got := jobStatus(complete); got != "Complete" {
		t.Errorf("got %q, want Complete", got)
	}

	failed := &batchv1.Job{Status: batchv1.JobStatus{Conditions: []batchv1.JobCondition{
		{Type: batchv1.JobFailed, Status: corev1.ConditionTrue},
	}}}
	if got := jobStatus(failed); got != "Failed" {
		t.Errorf("got %q, want Failed", got)
	}

	suspended := &batchv1.Job{Status: batchv1.JobStatus{Conditions: []batchv1.JobCondition{
		{Type: batchv1.JobSuspended, Status: corev1.ConditionTrue},
	}}}
	if got := jobStatus(suspended); got != "Suspended" {
		t.Errorf("got %q, want Suspended", got)
	}

	running := &batchv1.Job{Status: batchv1.JobStatus{Active: 2, StartTime: &now}}
	if got := jobStatus(running); got != "Running" {
		t.Errorf("got %q, want Running", got)
	}

	pending := &batchv1.Job{}
	if got := jobStatus(pending); got != "Pending" {
		t.Errorf("got %q, want Pending", got)
	}
}

func TestJobDuration(t *testing.T) {
	if got := jobDuration(&batchv1.Job{}); got != "" {
		t.Errorf("no start time: got %q, want empty", got)
	}

	start := metav1.NewTime(time.Now().Add(-30 * time.Second))
	end := metav1.NewTime(start.Add(10 * time.Second))
	j := &batchv1.Job{Status: batchv1.JobStatus{StartTime: &start, CompletionTime: &end}}
	if got := jobDuration(j); got != "10s" {
		t.Errorf("got %q, want 10s", got)
	}
}

func TestPodResourceTotals(t *testing.T) {
	mustParse := func(s string) resource.Quantity {
		q := resource.MustParse(s)
		return q
	}
	pod := &corev1.Pod{Spec: corev1.PodSpec{
		Containers: []corev1.Container{
			{Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU:    mustParse("250m"),
					corev1.ResourceMemory: mustParse("64Mi"),
				},
				Limits: corev1.ResourceList{
					corev1.ResourceCPU:    mustParse("500m"),
					corev1.ResourceMemory: mustParse("128Mi"),
				},
			}},
			{Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU: mustParse("100m"),
				},
			}},
		},
	}}
	cpuReq, cpuLim, memReq, memLim := podResourceTotals(pod)
	if cpuReq != 350 {
		t.Errorf("cpuReq: got %d, want 350", cpuReq)
	}
	if cpuLim != 500 {
		t.Errorf("cpuLim: got %d, want 500", cpuLim)
	}
	if memReq != 64*1024*1024 {
		t.Errorf("memReq: got %d, want %d", memReq, 64*1024*1024)
	}
	if memLim != 128*1024*1024 {
		t.Errorf("memLim: got %d, want %d", memLim, 128*1024*1024)
	}
}

func TestDerivePodStatus(t *testing.T) {
	now := metav1.Now()
	terminating := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{DeletionTimestamp: &now}}
	if got := derivePodStatus(terminating); got != "Terminating" {
		t.Errorf("terminating: got %q", got)
	}

	crash := &corev1.Pod{Status: corev1.PodStatus{
		Phase: corev1.PodRunning,
		ContainerStatuses: []corev1.ContainerStatus{
			{State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "CrashLoopBackOff"}}},
		},
	}}
	if got := derivePodStatus(crash); got != "CrashLoopBackOff" {
		t.Errorf("crash: got %q", got)
	}

	oom := &corev1.Pod{Status: corev1.PodStatus{
		ContainerStatuses: []corev1.ContainerStatus{
			{State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{Reason: "OOMKilled", ExitCode: 137}}},
		},
	}}
	if got := derivePodStatus(oom); got != "OOMKilled" {
		t.Errorf("oom: got %q", got)
	}

	exit := &corev1.Pod{Status: corev1.PodStatus{
		ContainerStatuses: []corev1.ContainerStatus{
			{State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{ExitCode: 2}}},
		},
	}}
	if got := derivePodStatus(exit); got != "ExitCode:2" {
		t.Errorf("exit: got %q", got)
	}

	initFail := &corev1.Pod{
		Spec: corev1.PodSpec{InitContainers: []corev1.Container{{Name: "init"}}},
		Status: corev1.PodStatus{InitContainerStatuses: []corev1.ContainerStatus{
			{State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "ImagePullBackOff"}}},
		}},
	}
	if got := derivePodStatus(initFail); got != "Init:ImagePullBackOff" {
		t.Errorf("init: got %q", got)
	}

	pending := &corev1.Pod{Status: corev1.PodStatus{Phase: corev1.PodPending}}
	if got := derivePodStatus(pending); got != "Pending" {
		t.Errorf("pending: got %q", got)
	}

	withReason := &corev1.Pod{Status: corev1.PodStatus{Reason: "Evicted"}}
	if got := derivePodStatus(withReason); got != "Evicted" {
		t.Errorf("evicted: got %q", got)
	}
}

func TestControllerOwnerRef(t *testing.T) {
	ctrl := true
	notCtrl := false

	if got := controllerOwnerRef(nil); got != nil {
		t.Errorf("no refs: got %+v, want nil", got)
	}

	onlyNonController := []metav1.OwnerReference{
		{Kind: "Foo", Name: "foo", Controller: &notCtrl},
		{Kind: "Bar", Name: "bar"},
	}
	if got := controllerOwnerRef(onlyNonController); got != nil {
		t.Errorf("no controller: got %+v, want nil", got)
	}

	refs := []metav1.OwnerReference{
		{Kind: "Bar", Name: "bar", Controller: &notCtrl},
		{Kind: "Deployment", Name: "web", Controller: &ctrl},
	}
	got := controllerOwnerRef(refs)
	if got == nil || got.Kind != "Deployment" || got.Name != "web" {
		t.Errorf("got %+v, want Deployment/web", got)
	}
}

func TestPodContainerBriefs(t *testing.T) {
	p := &corev1.Pod{
		Spec: corev1.PodSpec{
			Containers:     []corev1.Container{{Name: "app"}},
			InitContainers: []corev1.Container{{Name: "setup"}, {Name: "migrate"}},
		},
		Status: corev1.PodStatus{
			ContainerStatuses: []corev1.ContainerStatus{
				{Name: "app", Ready: true, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
			},
			InitContainerStatuses: []corev1.ContainerStatus{
				{Name: "setup", State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{ExitCode: 0}}},
				{Name: "migrate", State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "CrashLoopBackOff"}}},
			},
		},
	}
	got := podContainerBriefs(p)
	if len(got) != 3 {
		t.Fatalf("len: got %d, want 3", len(got))
	}
	if got[0].Name != "app" || got[0].Init || got[0].Tone != "ready" {
		t.Errorf("regular: got %+v, want app/regular/ready", got[0])
	}
	if got[1].Name != "setup" || !got[1].Init || got[1].Tone != "done" {
		t.Errorf("init done: got %+v, want setup/init/done", got[1])
	}
	if got[2].Name != "migrate" || !got[2].Init || got[2].Tone != "error" || got[2].State != "CrashLoopBackOff" {
		t.Errorf("init crash: got %+v, want migrate/init/error/CrashLoopBackOff", got[2])
	}
}

func TestContainerBriefTone(t *testing.T) {
	if b := containerBrief("x", nil, false); b.Tone != "warn" || b.State != "Pending" {
		t.Errorf("nil status: got %+v, want warn/Pending", b)
	}
	creating := &corev1.ContainerStatus{State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "ContainerCreating"}}}
	if b := containerBrief("x", creating, false); b.Tone != "warn" {
		t.Errorf("creating: got %+v, want warn", b)
	}
	oom := &corev1.ContainerStatus{State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{Reason: "OOMKilled", ExitCode: 137}}}
	if b := containerBrief("x", oom, false); b.Tone != "error" || b.State != "OOMKilled" {
		t.Errorf("oom: got %+v, want error/OOMKilled", b)
	}
	notReady := &corev1.ContainerStatus{Ready: false, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}}
	if b := containerBrief("x", notReady, false); b.Tone != "warn" {
		t.Errorf("running not ready: got %+v, want warn", b)
	}
}

func TestSortByNamespaceName(t *testing.T) {
	items := []struct {
		ns, name string
	}{
		{"b", "x"},
		{"a", "y"},
		{"a", "x"},
		{"b", "a"},
	}
	sortByNamespaceName(items, func(i int) (string, string) { return items[i].ns, items[i].name })
	want := []struct{ ns, name string }{
		{"a", "x"}, {"a", "y"}, {"b", "a"}, {"b", "x"},
	}
	for i, w := range want {
		if items[i].ns != w.ns || items[i].name != w.name {
			t.Errorf("idx %d: got %+v, want %+v", i, items[i], w)
		}
	}
}
