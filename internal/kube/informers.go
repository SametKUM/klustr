package kube

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"

	gwclient "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"
	gwinformers "sigs.k8s.io/gateway-api/pkg/client/informers/externalversions"
)

const debounceWindow = 100 * time.Millisecond

// OwnerRef is the trimmed shape of an OwnerReference embedded in Info/Detail
// payloads. We never need the full UID/Controller fields on the client.
type OwnerRef struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// ConditionDetail is the per-condition shape used across PodDetail,
// DeploymentDetail, PDB/HPA/PVC/ReplicaSet/Node detail bodies.
type ConditionDetail struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason"`
	Message string `json:"message"`
}

type ChangeFunc func(kind string)

// contextWatcher owns the per-context SharedInformerFactory plus the
// Gateway-API factory, a debounce queue and the lifecycle context. The
// per-kind type definitions and lister methods live in informers_<group>.go
// files; the handler registration that wires up every kind stays here in
// start() to keep the wiring auditable in one place.
type contextWatcher struct {
	factory   informers.SharedInformerFactory
	gwFactory gwinformers.SharedInformerFactory
	dyn       dynamic.Interface
	crd       *crdWatcher
	onChange  ChangeFunc
	cancel    context.CancelFunc

	mu      sync.Mutex
	pending map[string]struct{}
	timer   *time.Timer
}

func newContextWatcher(cs *kubernetes.Clientset, gw gwclient.Interface, dyn dynamic.Interface, onChange ChangeFunc) *contextWatcher {
	w := &contextWatcher{
		factory:  informers.NewSharedInformerFactory(cs, 0),
		dyn:      dyn,
		onChange: onChange,
		pending:  make(map[string]struct{}),
	}
	if gw != nil && hasGatewayAPIGroup(cs.Discovery()) {
		w.gwFactory = gwinformers.NewSharedInformerFactory(gw, 0)
	}
	return w
}

func (w *contextWatcher) start(parent context.Context) error {
	ctx, cancel := context.WithCancel(parent)
	w.cancel = cancel
	w.crd = newCRDWatcher(w.dyn, ctx.Done(), w.touch)
	if err := w.crd.start(); err != nil {
		cancel()
		return err
	}

	ns := w.factory.Core().V1().Namespaces().Informer()
	if _, err := ns.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Namespace") },
		UpdateFunc: func(any, any) { w.touch("Namespace") },
		DeleteFunc: func(any) { w.touch("Namespace") },
	}); err != nil {
		cancel()
		return err
	}

	pods := w.factory.Core().V1().Pods().Informer()
	if _, err := pods.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Pod") },
		UpdateFunc: func(any, any) { w.touch("Pod") },
		DeleteFunc: func(any) { w.touch("Pod") },
	}); err != nil {
		cancel()
		return err
	}

	deployments := w.factory.Apps().V1().Deployments().Informer()
	if _, err := deployments.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Deployment") },
		UpdateFunc: func(any, any) { w.touch("Deployment") },
		DeleteFunc: func(any) { w.touch("Deployment") },
	}); err != nil {
		cancel()
		return err
	}

	services := w.factory.Core().V1().Services().Informer()
	if _, err := services.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Service") },
		UpdateFunc: func(any, any) { w.touch("Service") },
		DeleteFunc: func(any) { w.touch("Service") },
	}); err != nil {
		cancel()
		return err
	}

	configMaps := w.factory.Core().V1().ConfigMaps().Informer()
	if _, err := configMaps.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("ConfigMap") },
		UpdateFunc: func(any, any) { w.touch("ConfigMap") },
		DeleteFunc: func(any) { w.touch("ConfigMap") },
	}); err != nil {
		cancel()
		return err
	}

	secrets := w.factory.Core().V1().Secrets().Informer()
	if _, err := secrets.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(obj any) { w.touch("Secret"); maybeTouchHelm(obj, w) },
		UpdateFunc: func(_, obj any) { w.touch("Secret"); maybeTouchHelm(obj, w) },
		DeleteFunc: func(obj any) { w.touch("Secret"); maybeTouchHelm(obj, w) },
	}); err != nil {
		cancel()
		return err
	}

	statefulSets := w.factory.Apps().V1().StatefulSets().Informer()
	if _, err := statefulSets.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("StatefulSet") },
		UpdateFunc: func(any, any) { w.touch("StatefulSet") },
		DeleteFunc: func(any) { w.touch("StatefulSet") },
	}); err != nil {
		cancel()
		return err
	}

	daemonSets := w.factory.Apps().V1().DaemonSets().Informer()
	if _, err := daemonSets.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("DaemonSet") },
		UpdateFunc: func(any, any) { w.touch("DaemonSet") },
		DeleteFunc: func(any) { w.touch("DaemonSet") },
	}); err != nil {
		cancel()
		return err
	}

	jobs := w.factory.Batch().V1().Jobs().Informer()
	if _, err := jobs.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Job") },
		UpdateFunc: func(any, any) { w.touch("Job") },
		DeleteFunc: func(any) { w.touch("Job") },
	}); err != nil {
		cancel()
		return err
	}

	cronJobs := w.factory.Batch().V1().CronJobs().Informer()
	if _, err := cronJobs.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("CronJob") },
		UpdateFunc: func(any, any) { w.touch("CronJob") },
		DeleteFunc: func(any) { w.touch("CronJob") },
	}); err != nil {
		cancel()
		return err
	}

	rcs := w.factory.Core().V1().ReplicationControllers().Informer()
	if _, err := rcs.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("ReplicationController") },
		UpdateFunc: func(any, any) { w.touch("ReplicationController") },
		DeleteFunc: func(any) { w.touch("ReplicationController") },
	}); err != nil {
		cancel()
		return err
	}

	endpoints := w.factory.Core().V1().Endpoints().Informer()
	if _, err := endpoints.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Endpoints") },
		UpdateFunc: func(any, any) { w.touch("Endpoints") },
		DeleteFunc: func(any) { w.touch("Endpoints") },
	}); err != nil {
		cancel()
		return err
	}

	vwh := w.factory.Admissionregistration().V1().ValidatingWebhookConfigurations().Informer()
	if _, err := vwh.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("ValidatingWebhookConfiguration") },
		UpdateFunc: func(any, any) { w.touch("ValidatingWebhookConfiguration") },
		DeleteFunc: func(any) { w.touch("ValidatingWebhookConfiguration") },
	}); err != nil {
		cancel()
		return err
	}

	mwh := w.factory.Admissionregistration().V1().MutatingWebhookConfigurations().Informer()
	if _, err := mwh.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("MutatingWebhookConfiguration") },
		UpdateFunc: func(any, any) { w.touch("MutatingWebhookConfiguration") },
		DeleteFunc: func(any) { w.touch("MutatingWebhookConfiguration") },
	}); err != nil {
		cancel()
		return err
	}

	leases := w.factory.Coordination().V1().Leases().Informer()
	if _, err := leases.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Lease") },
		UpdateFunc: func(any, any) { w.touch("Lease") },
		DeleteFunc: func(any) { w.touch("Lease") },
	}); err != nil {
		cancel()
		return err
	}

	runtimeClasses := w.factory.Node().V1().RuntimeClasses().Informer()
	if _, err := runtimeClasses.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("RuntimeClass") },
		UpdateFunc: func(any, any) { w.touch("RuntimeClass") },
		DeleteFunc: func(any) { w.touch("RuntimeClass") },
	}); err != nil {
		cancel()
		return err
	}

	priorityClasses := w.factory.Scheduling().V1().PriorityClasses().Informer()
	if _, err := priorityClasses.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("PriorityClass") },
		UpdateFunc: func(any, any) { w.touch("PriorityClass") },
		DeleteFunc: func(any) { w.touch("PriorityClass") },
	}); err != nil {
		cancel()
		return err
	}

	ingressClasses := w.factory.Networking().V1().IngressClasses().Informer()
	if _, err := ingressClasses.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("IngressClass") },
		UpdateFunc: func(any, any) { w.touch("IngressClass") },
		DeleteFunc: func(any) { w.touch("IngressClass") },
	}); err != nil {
		cancel()
		return err
	}

	limitRanges := w.factory.Core().V1().LimitRanges().Informer()
	if _, err := limitRanges.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("LimitRange") },
		UpdateFunc: func(any, any) { w.touch("LimitRange") },
		DeleteFunc: func(any) { w.touch("LimitRange") },
	}); err != nil {
		cancel()
		return err
	}

	resourceQuotas := w.factory.Core().V1().ResourceQuotas().Informer()
	if _, err := resourceQuotas.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("ResourceQuota") },
		UpdateFunc: func(any, any) { w.touch("ResourceQuota") },
		DeleteFunc: func(any) { w.touch("ResourceQuota") },
	}); err != nil {
		cancel()
		return err
	}

	endpointSlices := w.factory.Discovery().V1().EndpointSlices().Informer()
	if _, err := endpointSlices.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("EndpointSlice") },
		UpdateFunc: func(any, any) { w.touch("EndpointSlice") },
		DeleteFunc: func(any) { w.touch("EndpointSlice") },
	}); err != nil {
		cancel()
		return err
	}

	pdbs := w.factory.Policy().V1().PodDisruptionBudgets().Informer()
	if _, err := pdbs.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("PodDisruptionBudget") },
		UpdateFunc: func(any, any) { w.touch("PodDisruptionBudget") },
		DeleteFunc: func(any) { w.touch("PodDisruptionBudget") },
	}); err != nil {
		cancel()
		return err
	}

	hpas := w.factory.Autoscaling().V2().HorizontalPodAutoscalers().Informer()
	if _, err := hpas.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("HorizontalPodAutoscaler") },
		UpdateFunc: func(any, any) { w.touch("HorizontalPodAutoscaler") },
		DeleteFunc: func(any) { w.touch("HorizontalPodAutoscaler") },
	}); err != nil {
		cancel()
		return err
	}

	netpols := w.factory.Networking().V1().NetworkPolicies().Informer()
	if _, err := netpols.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("NetworkPolicy") },
		UpdateFunc: func(any, any) { w.touch("NetworkPolicy") },
		DeleteFunc: func(any) { w.touch("NetworkPolicy") },
	}); err != nil {
		cancel()
		return err
	}

	storageClasses := w.factory.Storage().V1().StorageClasses().Informer()
	if _, err := storageClasses.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("StorageClass") },
		UpdateFunc: func(any, any) { w.touch("StorageClass") },
		DeleteFunc: func(any) { w.touch("StorageClass") },
	}); err != nil {
		cancel()
		return err
	}

	pvs := w.factory.Core().V1().PersistentVolumes().Informer()
	if _, err := pvs.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("PersistentVolume") },
		UpdateFunc: func(any, any) { w.touch("PersistentVolume") },
		DeleteFunc: func(any) { w.touch("PersistentVolume") },
	}); err != nil {
		cancel()
		return err
	}

	pvcs := w.factory.Core().V1().PersistentVolumeClaims().Informer()
	if _, err := pvcs.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("PersistentVolumeClaim") },
		UpdateFunc: func(any, any) { w.touch("PersistentVolumeClaim") },
		DeleteFunc: func(any) { w.touch("PersistentVolumeClaim") },
	}); err != nil {
		cancel()
		return err
	}

	replicaSets := w.factory.Apps().V1().ReplicaSets().Informer()
	if _, err := replicaSets.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("ReplicaSet") },
		UpdateFunc: func(any, any) { w.touch("ReplicaSet") },
		DeleteFunc: func(any) { w.touch("ReplicaSet") },
	}); err != nil {
		cancel()
		return err
	}

	ingresses := w.factory.Networking().V1().Ingresses().Informer()
	if _, err := ingresses.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Ingress") },
		UpdateFunc: func(any, any) { w.touch("Ingress") },
		DeleteFunc: func(any) { w.touch("Ingress") },
	}); err != nil {
		cancel()
		return err
	}

	nodes := w.factory.Core().V1().Nodes().Informer()
	if _, err := nodes.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Node") },
		UpdateFunc: func(any, any) { w.touch("Node") },
		DeleteFunc: func(any) { w.touch("Node") },
	}); err != nil {
		cancel()
		return err
	}

	serviceAccounts := w.factory.Core().V1().ServiceAccounts().Informer()
	if _, err := serviceAccounts.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("ServiceAccount") },
		UpdateFunc: func(any, any) { w.touch("ServiceAccount") },
		DeleteFunc: func(any) { w.touch("ServiceAccount") },
	}); err != nil {
		cancel()
		return err
	}

	roles := w.factory.Rbac().V1().Roles().Informer()
	if _, err := roles.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("Role") },
		UpdateFunc: func(any, any) { w.touch("Role") },
		DeleteFunc: func(any) { w.touch("Role") },
	}); err != nil {
		cancel()
		return err
	}

	roleBindings := w.factory.Rbac().V1().RoleBindings().Informer()
	if _, err := roleBindings.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("RoleBinding") },
		UpdateFunc: func(any, any) { w.touch("RoleBinding") },
		DeleteFunc: func(any) { w.touch("RoleBinding") },
	}); err != nil {
		cancel()
		return err
	}

	clusterRoles := w.factory.Rbac().V1().ClusterRoles().Informer()
	if _, err := clusterRoles.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("ClusterRole") },
		UpdateFunc: func(any, any) { w.touch("ClusterRole") },
		DeleteFunc: func(any) { w.touch("ClusterRole") },
	}); err != nil {
		cancel()
		return err
	}

	clusterRoleBindings := w.factory.Rbac().V1().ClusterRoleBindings().Informer()
	if _, err := clusterRoleBindings.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("ClusterRoleBinding") },
		UpdateFunc: func(any, any) { w.touch("ClusterRoleBinding") },
		DeleteFunc: func(any) { w.touch("ClusterRoleBinding") },
	}); err != nil {
		cancel()
		return err
	}

	if err := w.startGatewayInformers(ctx); err != nil {
		cancel()
		return err
	}

	w.factory.Start(ctx.Done())
	go func() {
		w.factory.WaitForCacheSync(ctx.Done())
		for _, kind := range []string{
			"Namespace", "Pod", "Deployment", "Service", "ConfigMap", "Secret",
			"StatefulSet", "DaemonSet", "Job", "CronJob", "Ingress", "Node",
			"ReplicaSet", "PersistentVolumeClaim", "PersistentVolume", "StorageClass",
			"NetworkPolicy", "HorizontalPodAutoscaler", "PodDisruptionBudget",
			"EndpointSlice", "ResourceQuota", "LimitRange", "IngressClass",
			"PriorityClass", "RuntimeClass", "Lease",
			"MutatingWebhookConfiguration", "ValidatingWebhookConfiguration",
			"Endpoints", "ReplicationController",
			"ServiceAccount", "Role", "RoleBinding", "ClusterRole", "ClusterRoleBinding",
		} {
			w.touch(kind)
		}
	}()
	return nil
}

func (w *contextWatcher) stop() {
	if w.cancel != nil {
		w.cancel()
	}
	w.mu.Lock()
	if w.timer != nil {
		w.timer.Stop()
		w.timer = nil
	}
	w.pending = make(map[string]struct{})
	w.mu.Unlock()
}

func (w *contextWatcher) touch(kind string) {
	w.mu.Lock()
	w.pending[kind] = struct{}{}
	if w.timer == nil {
		w.timer = time.AfterFunc(debounceWindow, w.flush)
	}
	w.mu.Unlock()
}

func (w *contextWatcher) flush() {
	w.mu.Lock()
	kinds := make([]string, 0, len(w.pending))
	for k := range w.pending {
		kinds = append(kinds, k)
	}
	w.pending = make(map[string]struct{})
	w.timer = nil
	cb := w.onChange
	w.mu.Unlock()

	if cb == nil {
		return
	}
	for _, k := range kinds {
		cb(k)
	}
}

// sortByNamespaceName sorts an arbitrary slice in place by (namespace, name)
// using a supplied accessor. Cluster-scoped Info types use plain sort.Slice
// on Name directly instead of this generic helper.
func sortByNamespaceName[T any](slice []T, key func(int) (string, string)) {
	sort.Slice(slice, func(i, j int) bool {
		ni, n := key(i)
		nj, m := key(j)
		if ni != nj {
			return ni < nj
		}
		return n < m
	})
}

func formatLabelSelector(sel *metav1.LabelSelector) string {
	if sel == nil || (len(sel.MatchLabels) == 0 && len(sel.MatchExpressions) == 0) {
		return "<all>"
	}
	parts := make([]string, 0, len(sel.MatchLabels)+len(sel.MatchExpressions))
	for k, v := range sel.MatchLabels {
		parts = append(parts, k+"="+v)
	}
	sort.Strings(parts)
	for _, m := range sel.MatchExpressions {
		parts = append(parts, fmt.Sprintf("%s %s %v", m.Key, m.Operator, m.Values))
	}
	return strings.Join(parts, ",")
}

func formatNodeSelector(sel map[string]string) string {
	if len(sel) == 0 {
		return "<none>"
	}
	parts := make([]string, 0, len(sel))
	for k, v := range sel {
		parts = append(parts, k+"="+v)
	}
	sort.Strings(parts)
	return strings.Join(parts, ",")
}
