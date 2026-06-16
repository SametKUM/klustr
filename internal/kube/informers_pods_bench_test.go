package kube

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
)

// These benchmarks measure the hot list path that runs on every kube:change:
// walk the informer cache -> project each object into a PodInfo -> sort -> (the
// Wails layer then JSON-serializes the result). BenchmarkMarshalPodInfos is the
// proxy for that bridge serialization cost — the number a delta protocol must
// beat, since today the whole list is re-marshalled even when one pod changed.

var benchPodSizes = []int{500, 1500, 5000}

// makeManagedFields returns a realistic, non-trivial managedFields block so the
// fixture object's byte footprint mirrors a real cached pod (kubelet,
// kube-controller-manager and a couple of controllers all leave entries).
func makeManagedFields() []metav1.ManagedFieldsEntry {
	raw := []byte(`{"f:metadata":{"f:labels":{".":{},"f:app":{},"f:pod-template-hash":{}},` +
		`"f:ownerReferences":{".":{},"k:{\"uid\":\"x\"}":{}}},` +
		`"f:spec":{"f:containers":{"k:{\"name\":\"app\"}":{".":{},"f:image":{},` +
		`"f:resources":{"f:requests":{".":{},"f:cpu":{},"f:memory":{}}}}}},` +
		`"f:status":{"f:conditions":{"k:{\"type\":\"Ready\"}":{".":{},"f:status":{}}}}}`)
	mgrs := []string{"kubelet", "kube-controller-manager", "kube-scheduler", "deployment-controller"}
	out := make([]metav1.ManagedFieldsEntry, 0, len(mgrs))
	for _, m := range mgrs {
		out = append(out, metav1.ManagedFieldsEntry{
			Manager:    m,
			Operation:  metav1.ManagedFieldsOperationUpdate,
			APIVersion: "v1",
			Time:       &metav1.Time{Time: time.Now()},
			FieldsType: "FieldsV1",
			FieldsV1:   &metav1.FieldsV1{Raw: raw},
		})
	}
	return out
}

func makePod(i int) *corev1.Pod {
	name := fmt.Sprintf("pod-%05d", i)
	ns := fmt.Sprintf("ns-%02d", i%20)
	qcpu := resource.MustParse("100m")
	qmem := resource.MustParse("128Mi")
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         ns,
			CreationTimestamp: metav1.NewTime(time.Now().Add(-time.Hour)),
			Labels: map[string]string{
				"app":               fmt.Sprintf("app-%d", i%50),
				"pod-template-hash": "5f9c8b7d6c",
			},
			OwnerReferences: []metav1.OwnerReference{{Kind: "ReplicaSet", Name: name + "-rs"}},
			ManagedFields:   makeManagedFields(),
		},
		Spec: corev1.PodSpec{
			NodeName:       fmt.Sprintf("node-%03d", i%150),
			InitContainers: []corev1.Container{{Name: "init", Image: "busybox:1.36"}},
			Containers: []corev1.Container{
				{
					Name:  "app",
					Image: "registry.example.com/app:v1.2.3",
					Ports: []corev1.ContainerPort{{ContainerPort: 8080}},
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{corev1.ResourceCPU: qcpu, corev1.ResourceMemory: qmem},
						Limits:   corev1.ResourceList{corev1.ResourceCPU: qcpu, corev1.ResourceMemory: qmem},
					},
				},
				{Name: "sidecar", Image: "envoyproxy/envoy:v1.29"},
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			PodIP: fmt.Sprintf("10.%d.%d.%d", i/256%256, i%256, i%200+1),
			Conditions: []corev1.PodCondition{
				{Type: corev1.PodReady, Status: corev1.ConditionTrue},
			},
			ContainerStatuses: []corev1.ContainerStatus{
				{Name: "app", Ready: true, RestartCount: int32(i % 4),
					State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{StartedAt: metav1.Now()}}},
				{Name: "sidecar", Ready: true,
					State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{StartedAt: metav1.Now()}}},
			},
			InitContainerStatuses: []corev1.ContainerStatus{
				{Name: "init", State: corev1.ContainerState{
					Terminated: &corev1.ContainerStateTerminated{ExitCode: 0, Reason: "Completed"}}},
			},
		},
	}
}

func makePods(n int) []*corev1.Pod {
	pods := make([]*corev1.Pod, n)
	for i := range pods {
		pods[i] = makePod(i)
	}
	return pods
}

// newBenchPodWatcher builds a contextWatcher whose Pod informer store is
// pre-loaded with n pods. "Pod" is marked started and access is nil, so
// factoryFor -> ensureKind is a no-op and routedFactory returns the factory:
// the benchmark measures only the read + projection path, not informer sync.
func newBenchPodWatcher(tb testing.TB, n int) *contextWatcher {
	tb.Helper()
	cs := fake.NewClientset()
	f := informers.NewSharedInformerFactory(cs, 0)
	store := f.Core().V1().Pods().Informer().GetStore()
	for _, p := range makePods(n) {
		if err := store.Add(p); err != nil {
			tb.Fatal(err)
		}
	}
	w := &contextWatcher{cs: cs, factory: f, started: map[string]bool{"Pod": true}}
	w.bindings = kindBindings(w)
	return w
}

func BenchmarkPods(b *testing.B) {
	for _, n := range benchPodSizes {
		w := newBenchPodWatcher(b, n)
		b.Run(fmt.Sprintf("N=%d", n), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				_ = w.Pods("")
			}
		})
	}
}

func BenchmarkPodInfosFrom(b *testing.B) {
	for _, n := range benchPodSizes {
		pods := makePods(n)
		b.Run(fmt.Sprintf("N=%d", n), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				_ = podInfosFrom(pods)
			}
		})
	}
}

func BenchmarkPodInfoFrom(b *testing.B) {
	p := makePod(0)
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = podInfoFrom(p)
	}
}

func BenchmarkMarshalPodInfos(b *testing.B) {
	for _, n := range benchPodSizes {
		out := podInfosFrom(makePods(n))
		b.Run(fmt.Sprintf("N=%d", n), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				data, err := json.Marshal(out)
				if err != nil {
					b.Fatal(err)
				}
				_ = data
			}
		})
	}
}

// BenchmarkMarshalPodDelta marshals a small KindDelta (the per-churn-window
// payload the delta protocol emits) so it can be compared head-to-head against
// BenchmarkMarshalPodInfos/N=5000 — the full-list payload it replaces. The point
// is that the delta cost tracks the change count, not the cluster size.
func BenchmarkMarshalPodDelta(b *testing.B) {
	infos := podInfosFrom(makePods(25))
	ups := make([]any, len(infos))
	for i := range infos {
		ups[i] = infos[i]
	}
	d := &KindDelta{
		Upserts: ups,
		Removed: []string{"ns-01/pod-00001", "ns-02/pod-00002", "ns-03/pod-00003"},
		Gen:     1,
	}
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		data, err := json.Marshal(d)
		if err != nil {
			b.Fatal(err)
		}
		_ = data
	}
}
