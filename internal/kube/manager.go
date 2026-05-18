package kube

import (
	"context"
	"fmt"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

const pingTimeout = 5 * time.Second

type ServerVersion struct {
	GitVersion string `json:"gitVersion"`
	Platform   string `json:"platform"`
}

type ContextChange struct {
	Context string
	Kind    string
}

type ClientManager struct {
	mu       sync.Mutex
	rules    *clientcmd.ClientConfigLoadingRules
	cache    map[string]*kubernetes.Clientset
	watchers map[string]*contextWatcher
	logs     *logSessionManager
	execs    *execSessionManager
	pf       *pfManager
	metrics  *metricsCache
	onChange func(ContextChange)
}

func NewClientManager() *ClientManager {
	return &ClientManager{
		rules:    clientcmd.NewDefaultClientConfigLoadingRules(),
		cache:    make(map[string]*kubernetes.Clientset),
		watchers: make(map[string]*contextWatcher),
		logs:     newLogSessionManager(),
		execs:    newExecSessionManager(),
		pf:       newPFManager(),
		metrics:  newMetricsCache(),
	}
}

func (m *ClientManager) SetPFChangeCallback(cb func()) {
	m.pf.setOnChange(cb)
}

func (m *ClientManager) SetOnChange(cb func(ContextChange)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onChange = cb
}

func (m *ClientManager) Kubeconfig() (*Kubeconfig, error) {
	return loadRawConfig(m.rules)
}

func (m *ClientManager) Clientset(contextName string) (*kubernetes.Clientset, error) {
	m.mu.Lock()
	if cs, ok := m.cache[contextName]; ok {
		m.mu.Unlock()
		return cs, nil
	}
	m.mu.Unlock()

	cfg, err := m.restConfig(contextName)
	if err != nil {
		return nil, err
	}
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.cache[contextName] = cs
	m.mu.Unlock()
	return cs, nil
}

func (m *ClientManager) Ping(ctx context.Context, contextName string) (*ServerVersion, error) {
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return nil, err
	}
	cfgCopy := *cfg
	cfgCopy.Timeout = pingTimeout

	cs, err := kubernetes.NewForConfig(&cfgCopy)
	if err != nil {
		return nil, err
	}

	type result struct {
		v   *ServerVersion
		err error
	}
	done := make(chan result, 1)
	go func() {
		info, err := cs.Discovery().ServerVersion()
		if err != nil {
			done <- result{nil, err}
			return
		}
		done <- result{&ServerVersion{GitVersion: info.GitVersion, Platform: info.Platform}, nil}
	}()

	select {
	case r := <-done:
		return r.v, r.err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (m *ClientManager) Watch(ctx context.Context, contextName string) error {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return err
	}

	m.mu.Lock()
	if existing, ok := m.watchers[contextName]; ok {
		m.mu.Unlock()
		existing.stop()
		m.mu.Lock()
	}
	cb := m.onChange
	m.mu.Unlock()

	w := newContextWatcher(cs, dyn, func(kind string) {
		if cb != nil {
			cb(ContextChange{Context: contextName, Kind: kind})
		}
	})
	if err := w.start(ctx); err != nil {
		return err
	}

	m.mu.Lock()
	m.watchers[contextName] = w
	m.mu.Unlock()
	return nil
}

func (m *ClientManager) StopWatch(contextName string) {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	if ok {
		delete(m.watchers, contextName)
	}
	m.mu.Unlock()
	if ok {
		w.stop()
	}
}

func (m *ClientManager) Namespaces(contextName string) []NamespaceInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []NamespaceInfo{}
	}
	return w.Namespaces()
}

func (m *ClientManager) Pods(contextName, namespace string) []PodInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []PodInfo{}
	}
	return w.Pods(namespace)
}

func (m *ClientManager) PodsForOwner(contextName, kind, namespace, name string) ([]PodInfo, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PodsForOwner(kind, namespace, name)
}

func (m *ClientManager) PodLogTargets(contextName, namespace string, selector map[string]string) []PodLogTarget {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []PodLogTarget{}
	}
	return w.PodLogTargets(namespace, selector)
}

func (m *ClientManager) Pod(contextName, namespace, name string) (*PodDetail, error) {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Pod(namespace, name)
}

func (m *ClientManager) StartLogs(
	parent context.Context,
	contextName, namespace, podName, container string,
	follow bool,
	tailLines int64,
	onLine LogLineFunc,
	onClose LogCloseFunc,
) (string, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", err
	}
	return m.logs.start(parent, cs, namespace, podName, container, follow, tailLines, onLine, onClose)
}

func (m *ClientManager) StopLogs(id string) {
	m.logs.stop(id)
}

func (m *ClientManager) StartExec(
	parent context.Context,
	contextName, namespace, podName, container string,
	command []string,
	onData ExecDataFunc,
	onClose ExecCloseFunc,
) (string, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", err
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return "", err
	}
	return m.execs.start(parent, cfg, cs, namespace, podName, container, command, onData, onClose)
}

func (m *ClientManager) SendExecInput(sessionID, data string) {
	m.execs.sendInput(sessionID, data)
}

func (m *ClientManager) ResizeExec(sessionID string, cols, rows uint16) {
	m.execs.resize(sessionID, cols, rows)
}

func (m *ClientManager) StopExec(sessionID string) {
	m.execs.stop(sessionID)
}

func (m *ClientManager) Deployment(contextName, namespace, name string) (*DeploymentDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Deployment(namespace, name)
}

func (m *ClientManager) StatefulSet(contextName, namespace, name string) (*StatefulSetDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.StatefulSet(namespace, name)
}

func (m *ClientManager) ReplicationController(contextName, namespace, name string) (*ReplicationControllerDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ReplicationController(namespace, name)
}

func (m *ClientManager) Endpoints(contextName, namespace, name string) (*EndpointsDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Endpoints(namespace, name)
}

func (m *ClientManager) ValidatingWebhookConfiguration(contextName, name string) (*WebhookConfigurationDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ValidatingWebhookConfiguration(name)
}

func (m *ClientManager) MutatingWebhookConfiguration(contextName, name string) (*WebhookConfigurationDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.MutatingWebhookConfiguration(name)
}

func (m *ClientManager) Lease(contextName, namespace, name string) (*LeaseDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Lease(namespace, name)
}

func (m *ClientManager) RuntimeClass(contextName, name string) (*RuntimeClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.RuntimeClass(name)
}

func (m *ClientManager) PriorityClass(contextName, name string) (*PriorityClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PriorityClass(name)
}

func (m *ClientManager) IngressClass(contextName, name string) (*IngressClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.IngressClass(name)
}

func (m *ClientManager) LimitRange(contextName, namespace, name string) (*LimitRangeDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.LimitRange(namespace, name)
}

func (m *ClientManager) ResourceQuota(contextName, namespace, name string) (*ResourceQuotaDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ResourceQuota(namespace, name)
}

func (m *ClientManager) EndpointSlice(contextName, namespace, name string) (*EndpointSliceDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.EndpointSlice(namespace, name)
}

func (m *ClientManager) PodDisruptionBudget(contextName, namespace, name string) (*PodDisruptionBudgetDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PodDisruptionBudget(namespace, name)
}

func (m *ClientManager) HorizontalPodAutoscaler(contextName, namespace, name string) (*HorizontalPodAutoscalerDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.HorizontalPodAutoscaler(namespace, name)
}

func (m *ClientManager) NetworkPolicy(contextName, namespace, name string) (*NetworkPolicyDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.NetworkPolicy(namespace, name)
}

func (m *ClientManager) StorageClass(contextName, name string) (*StorageClassDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.StorageClass(name)
}

func (m *ClientManager) PersistentVolume(contextName, name string) (*PersistentVolumeDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PersistentVolume(name)
}

func (m *ClientManager) PersistentVolumeClaim(contextName, namespace, name string) (*PersistentVolumeClaimDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.PersistentVolumeClaim(namespace, name)
}

func (m *ClientManager) ReplicaSet(contextName, namespace, name string) (*ReplicaSetDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ReplicaSet(namespace, name)
}

func (m *ClientManager) DaemonSet(contextName, namespace, name string) (*DaemonSetDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.DaemonSet(namespace, name)
}

func (m *ClientManager) Job(contextName, namespace, name string) (*JobDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Job(namespace, name)
}

func (m *ClientManager) CronJob(contextName, namespace, name string) (*CronJobDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.CronJob(namespace, name)
}

func (m *ClientManager) Service(contextName, namespace, name string) (*ServiceDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Service(namespace, name)
}

func (m *ClientManager) ConfigMap(contextName, namespace, name string) (*ConfigMapDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ConfigMap(namespace, name)
}

func (m *ClientManager) Secret(contextName, namespace, name string) (*SecretDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Secret(namespace, name)
}

func (m *ClientManager) SecretValue(contextName, namespace, name, key string) (string, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return "", fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.SecretValue(namespace, name, key)
}

func (m *ClientManager) Ingress(contextName, namespace, name string) (*IngressDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Ingress(namespace, name)
}

func (m *ClientManager) Node(contextName, name string) (*NodeDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Node(name)
}

func (m *ClientManager) Namespace(contextName, name string) (*NamespaceDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Namespace(name)
}

func (m *ClientManager) CRDs(contextName string) []CRDInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []CRDInfo{}
	}
	return w.crd.CRDs()
}

func (m *ClientManager) EnsureCRWatch(contextName, group, version, resource string) error {
	w, ok := m.watcher(contextName)
	if !ok {
		return fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.crd.EnsureCRWatch(schema.GroupVersionResource{Group: group, Version: version, Resource: resource})
}

func (m *ClientManager) CustomResources(contextName, group, version, resource, namespace string) []CustomResourceInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []CustomResourceInfo{}
	}
	return w.crd.ListCustomResources(schema.GroupVersionResource{Group: group, Version: version, Resource: resource}, namespace)
}

func (m *ClientManager) CustomResource(ctx context.Context, contextName, group, version, resource, namespace, name string) (*unstructured.Unstructured, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.crd.GetCustomResource(ctx, schema.GroupVersionResource{Group: group, Version: version, Resource: resource}, namespace, name)
}

func (m *ClientManager) watcher(contextName string) (*contextWatcher, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	w, ok := m.watchers[contextName]
	return w, ok
}

func (m *ClientManager) Deployments(contextName, namespace string) []DeploymentInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []DeploymentInfo{}
	}
	return w.Deployments(namespace)
}

func (m *ClientManager) Services(contextName, namespace string) []ServiceInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []ServiceInfo{}
	}
	return w.Services(namespace)
}

func (m *ClientManager) ConfigMaps(contextName, namespace string) []ConfigMapInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []ConfigMapInfo{}
	}
	return w.ConfigMaps(namespace)
}

func (m *ClientManager) Secrets(contextName, namespace string) []SecretInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []SecretInfo{}
	}
	return w.Secrets(namespace)
}

func (m *ClientManager) StatefulSets(contextName, namespace string) []StatefulSetInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []StatefulSetInfo{}
	}
	return w.StatefulSets(namespace)
}

func (m *ClientManager) ReplicationControllers(contextName, namespace string) []ReplicationControllerInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []ReplicationControllerInfo{}
	}
	return w.ReplicationControllers(namespace)
}

func (m *ClientManager) EndpointsList(contextName, namespace string) []EndpointsInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []EndpointsInfo{}
	}
	return w.ListEndpoints(namespace)
}

func (m *ClientManager) ValidatingWebhookConfigurations(contextName string) []WebhookConfigurationInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []WebhookConfigurationInfo{}
	}
	return w.ValidatingWebhookConfigurations()
}

func (m *ClientManager) MutatingWebhookConfigurations(contextName string) []WebhookConfigurationInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []WebhookConfigurationInfo{}
	}
	return w.MutatingWebhookConfigurations()
}

func (m *ClientManager) Leases(contextName, namespace string) []LeaseInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []LeaseInfo{}
	}
	return w.Leases(namespace)
}

func (m *ClientManager) RuntimeClasses(contextName string) []RuntimeClassInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []RuntimeClassInfo{}
	}
	return w.RuntimeClasses()
}

func (m *ClientManager) PriorityClasses(contextName string) []PriorityClassInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []PriorityClassInfo{}
	}
	return w.PriorityClasses()
}

func (m *ClientManager) IngressClasses(contextName string) []IngressClassInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []IngressClassInfo{}
	}
	return w.IngressClasses()
}

func (m *ClientManager) LimitRanges(contextName, namespace string) []LimitRangeInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []LimitRangeInfo{}
	}
	return w.LimitRanges(namespace)
}

func (m *ClientManager) ResourceQuotas(contextName, namespace string) []ResourceQuotaInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []ResourceQuotaInfo{}
	}
	return w.ResourceQuotas(namespace)
}

func (m *ClientManager) EndpointSlices(contextName, namespace string) []EndpointSliceInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []EndpointSliceInfo{}
	}
	return w.EndpointSlices(namespace)
}

func (m *ClientManager) PodDisruptionBudgets(contextName, namespace string) []PodDisruptionBudgetInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []PodDisruptionBudgetInfo{}
	}
	return w.PodDisruptionBudgets(namespace)
}

func (m *ClientManager) HorizontalPodAutoscalers(contextName, namespace string) []HorizontalPodAutoscalerInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []HorizontalPodAutoscalerInfo{}
	}
	return w.HorizontalPodAutoscalers(namespace)
}

func (m *ClientManager) NetworkPolicies(contextName, namespace string) []NetworkPolicyInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []NetworkPolicyInfo{}
	}
	return w.NetworkPolicies(namespace)
}

func (m *ClientManager) StorageClasses(contextName string) []StorageClassInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []StorageClassInfo{}
	}
	return w.StorageClasses()
}

func (m *ClientManager) PersistentVolumes(contextName string) []PersistentVolumeInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []PersistentVolumeInfo{}
	}
	return w.PersistentVolumes()
}

func (m *ClientManager) PersistentVolumeClaims(contextName, namespace string) []PersistentVolumeClaimInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []PersistentVolumeClaimInfo{}
	}
	return w.PersistentVolumeClaims(namespace)
}

func (m *ClientManager) ReplicaSets(contextName, namespace string) []ReplicaSetInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []ReplicaSetInfo{}
	}
	return w.ReplicaSets(namespace)
}

func (m *ClientManager) DaemonSets(contextName, namespace string) []DaemonSetInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []DaemonSetInfo{}
	}
	return w.DaemonSets(namespace)
}

func (m *ClientManager) Jobs(contextName, namespace string) []JobInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []JobInfo{}
	}
	return w.Jobs(namespace)
}

func (m *ClientManager) CronJobs(contextName, namespace string) []CronJobInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []CronJobInfo{}
	}
	return w.CronJobs(namespace)
}

func (m *ClientManager) Ingresses(contextName, namespace string) []IngressInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []IngressInfo{}
	}
	return w.Ingresses(namespace)
}

func (m *ClientManager) Nodes(contextName string) []NodeInfo {
	m.mu.Lock()
	w, ok := m.watchers[contextName]
	m.mu.Unlock()
	if !ok {
		return []NodeInfo{}
	}
	return w.Nodes()
}

func (m *ClientManager) StartPortForward(contextName, namespace, podName string, localPort, remotePort uint16) (PortForwardInfo, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return PortForwardInfo{}, err
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return PortForwardInfo{}, err
	}
	return m.pf.start(contextName, cs, cfg, namespace, podName, localPort, remotePort)
}

func (m *ClientManager) StopPortForward(id string) {
	m.pf.stop(id)
}

func (m *ClientManager) ListPortForwards() []PortForwardInfo {
	return m.pf.list()
}

func (m *ClientManager) restConfig(contextName string) (*rest.Config, error) {
	overrides := &clientcmd.ConfigOverrides{CurrentContext: contextName}
	return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(m.rules, overrides).ClientConfig()
}
