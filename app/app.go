package app

import (
	"context"
	"errors"
	"os"
	"runtime/debug"
	"time"

	"klustr/internal/kube"
	"klustr/internal/update"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const eventKubeChange = "kube:change"

const (
	githubOwner = "SametKUM"
	githubRepo  = "klustr"
)

var Version = "dev"

type App struct {
	ctx     context.Context
	clients *kube.ClientManager
}

func New() *App {
	return &App{
		clients: kube.NewClientManager(),
	}
}

func (a *App) Version() string {
	if Version != "dev" {
		return Version
	}
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "dev"
	}
	var revision string
	var modified bool
	for _, s := range info.Settings {
		switch s.Key {
		case "vcs.revision":
			revision = s.Value
		case "vcs.modified":
			modified = s.Value == "true"
		}
	}
	if revision == "" {
		return "dev"
	}
	if len(revision) > 7 {
		revision = revision[:7]
	}
	if modified {
		revision += "-dirty"
	}
	return "dev-" + revision
}

func (a *App) CheckForUpdate() (update.Result, error) {
	return update.Check(a.ctx, a.Version(), githubOwner, githubRepo)
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.clients.SetOnChange(func(c kube.ContextChange) {
		runtime.EventsEmit(ctx, eventKubeChange, c.Context, c.Kind)
	})
	a.clients.SetPFChangeCallback(func() {
		runtime.EventsEmit(ctx, "pf:update")
	})
}

// Shutdown is the OnShutdown hook Wails fires when the user quits the
// app. We use it to drain ClientManager so port-forwards, log streams
// and exec sessions tear down gracefully instead of dying with the
// process.
func (a *App) Shutdown(_ context.Context) {
	a.clients.Shutdown()
}

func (a *App) ListContexts() (*kube.Kubeconfig, error) {
	return a.clients.Kubeconfig()
}

func (a *App) PingContext(name string) (*kube.ServerVersion, error) {
	return a.clients.Ping(a.ctx, name)
}

func (a *App) StartWatch(name string) error {
	return a.clients.Watch(a.ctx, name)
}

func (a *App) StopWatch(name string) {
	a.clients.StopWatch(name)
}

// SetReadOnly marks a context read-only (or clears it). When read-only, every
// mutating ClientManager method refuses with a typed error, regardless of what
// the frontend allows — a hard local guard against accidental writes.
func (a *App) SetReadOnly(name string, readOnly bool) {
	a.clients.SetReadOnly(name, readOnly)
}

func (a *App) ListNamespaces(name string) []kube.NamespaceInfo {
	return a.clients.Namespaces(name)
}

func (a *App) ListPods(name, namespace string) []kube.PodInfo {
	return a.clients.Pods(name, namespace)
}

func (a *App) PodsForOwner(contextName, kind, namespace, name string) ([]kube.PodInfo, error) {
	return a.clients.PodsForOwner(contextName, kind, namespace, name)
}

func (a *App) PodLogTargets(name, namespace string, selector map[string]string) []kube.PodLogTarget {
	return a.clients.PodLogTargets(name, namespace, selector)
}

func (a *App) GetPod(contextName, namespace, name string) (*kube.PodDetail, error) {
	return a.clients.Pod(contextName, namespace, name)
}

func (a *App) GetDeployment(contextName, namespace, name string) (*kube.DeploymentDetail, error) {
	return a.clients.Deployment(contextName, namespace, name)
}

func (a *App) GetStatefulSet(contextName, namespace, name string) (*kube.StatefulSetDetail, error) {
	return a.clients.StatefulSet(contextName, namespace, name)
}

func (a *App) GetReplicaSet(contextName, namespace, name string) (*kube.ReplicaSetDetail, error) {
	return a.clients.ReplicaSet(contextName, namespace, name)
}

func (a *App) GetPersistentVolumeClaim(contextName, namespace, name string) (*kube.PersistentVolumeClaimDetail, error) {
	return a.clients.PersistentVolumeClaim(contextName, namespace, name)
}

func (a *App) GetPersistentVolume(contextName, name string) (*kube.PersistentVolumeDetail, error) {
	return a.clients.PersistentVolume(contextName, name)
}

func (a *App) GetStorageClass(contextName, name string) (*kube.StorageClassDetail, error) {
	return a.clients.StorageClass(contextName, name)
}

func (a *App) GetNetworkPolicy(contextName, namespace, name string) (*kube.NetworkPolicyDetail, error) {
	return a.clients.NetworkPolicy(contextName, namespace, name)
}

func (a *App) GetHorizontalPodAutoscaler(contextName, namespace, name string) (*kube.HorizontalPodAutoscalerDetail, error) {
	return a.clients.HorizontalPodAutoscaler(contextName, namespace, name)
}

func (a *App) GetPodDisruptionBudget(contextName, namespace, name string) (*kube.PodDisruptionBudgetDetail, error) {
	return a.clients.PodDisruptionBudget(contextName, namespace, name)
}

func (a *App) GetEndpointSlice(contextName, namespace, name string) (*kube.EndpointSliceDetail, error) {
	return a.clients.EndpointSlice(contextName, namespace, name)
}

func (a *App) GetResourceQuota(contextName, namespace, name string) (*kube.ResourceQuotaDetail, error) {
	return a.clients.ResourceQuota(contextName, namespace, name)
}

func (a *App) GetLimitRange(contextName, namespace, name string) (*kube.LimitRangeDetail, error) {
	return a.clients.LimitRange(contextName, namespace, name)
}

func (a *App) GetIngressClass(contextName, name string) (*kube.IngressClassDetail, error) {
	return a.clients.IngressClass(contextName, name)
}

func (a *App) GetPriorityClass(contextName, name string) (*kube.PriorityClassDetail, error) {
	return a.clients.PriorityClass(contextName, name)
}

func (a *App) GetRuntimeClass(contextName, name string) (*kube.RuntimeClassDetail, error) {
	return a.clients.RuntimeClass(contextName, name)
}

func (a *App) GetLease(contextName, namespace, name string) (*kube.LeaseDetail, error) {
	return a.clients.Lease(contextName, namespace, name)
}

func (a *App) GetMutatingWebhookConfiguration(contextName, name string) (*kube.WebhookConfigurationDetail, error) {
	return a.clients.MutatingWebhookConfiguration(contextName, name)
}

func (a *App) GetValidatingWebhookConfiguration(contextName, name string) (*kube.WebhookConfigurationDetail, error) {
	return a.clients.ValidatingWebhookConfiguration(contextName, name)
}

func (a *App) GetEndpoints(contextName, namespace, name string) (*kube.EndpointsDetail, error) {
	return a.clients.Endpoints(contextName, namespace, name)
}

func (a *App) GetReplicationController(contextName, namespace, name string) (*kube.ReplicationControllerDetail, error) {
	return a.clients.ReplicationController(contextName, namespace, name)
}

func (a *App) GetDaemonSet(contextName, namespace, name string) (*kube.DaemonSetDetail, error) {
	return a.clients.DaemonSet(contextName, namespace, name)
}

func (a *App) GetJob(contextName, namespace, name string) (*kube.JobDetail, error) {
	return a.clients.Job(contextName, namespace, name)
}

func (a *App) GetCronJob(contextName, namespace, name string) (*kube.CronJobDetail, error) {
	return a.clients.CronJob(contextName, namespace, name)
}

func (a *App) GetService(contextName, namespace, name string) (*kube.ServiceDetail, error) {
	return a.clients.Service(contextName, namespace, name)
}

func (a *App) GetConfigMap(contextName, namespace, name string) (*kube.ConfigMapDetail, error) {
	return a.clients.ConfigMap(contextName, namespace, name)
}

func (a *App) GetSecret(contextName, namespace, name string) (*kube.SecretDetail, error) {
	return a.clients.Secret(contextName, namespace, name)
}

func (a *App) RevealSecretValue(contextName, namespace, name, key string) (string, error) {
	return a.clients.SecretValue(contextName, namespace, name, key)
}

func (a *App) GetIngress(contextName, namespace, name string) (*kube.IngressDetail, error) {
	return a.clients.Ingress(contextName, namespace, name)
}

func (a *App) GetNode(contextName, name string) (*kube.NodeDetail, error) {
	return a.clients.Node(contextName, name)
}

func (a *App) GetNamespace(contextName, name string) (*kube.NamespaceDetail, error) {
	return a.clients.Namespace(contextName, name)
}

func (a *App) GetResourceYAML(contextName, kind, namespace, name string) (string, error) {
	return a.clients.GetResourceYAML(a.ctx, contextName, kind, namespace, name)
}

func (a *App) ApplyResourceYAML(contextName, yamlBody string) error {
	return a.clients.ApplyResourceYAML(a.ctx, contextName, yamlBody)
}

func (a *App) DryRunApplyResourceYAML(contextName, yamlBody string) (*kube.MutationDiff, error) {
	return a.clients.DryRunApplyResourceYAML(a.ctx, contextName, yamlBody)
}

func (a *App) DeleteResource(contextName, kind, namespace, name string) error {
	return a.clients.DeleteResource(a.ctx, contextName, kind, namespace, name)
}

func (a *App) ScaleResource(contextName, kind, namespace, name string, replicas int) error {
	return a.clients.ScaleResource(a.ctx, contextName, kind, namespace, name, int32(replicas))
}

func (a *App) PatchHPAReplicas(contextName, namespace, name string, minReplicas, maxReplicas int) error {
	return a.clients.PatchHPAReplicas(a.ctx, contextName, namespace, name, int32(minReplicas), int32(maxReplicas))
}

func (a *App) ResizePodResources(contextName, namespace, podName, container, cpuRequest, cpuLimit, memRequest, memLimit string) error {
	return a.clients.ResizePodResources(a.ctx, contextName, namespace, podName, container, cpuRequest, cpuLimit, memRequest, memLimit)
}

func (a *App) PatchDeploymentPaused(contextName, namespace, name string, paused bool) error {
	return a.clients.PatchDeploymentPaused(a.ctx, contextName, namespace, name, paused)
}

func (a *App) ListDeploymentRevisions(contextName, namespace, name string) ([]kube.WorkloadRevision, error) {
	return a.clients.DeploymentRevisions(contextName, namespace, name)
}

func (a *App) ListStatefulSetRevisions(contextName, namespace, name string) ([]kube.WorkloadRevision, error) {
	return a.clients.StatefulSetRevisions(a.ctx, contextName, namespace, name)
}

func (a *App) ListDaemonSetRevisions(contextName, namespace, name string) ([]kube.WorkloadRevision, error) {
	return a.clients.DaemonSetRevisions(a.ctx, contextName, namespace, name)
}

func (a *App) RollbackDeployment(contextName, namespace, name string, toRevision int) error {
	return a.clients.RollbackDeployment(a.ctx, contextName, namespace, name, int32(toRevision))
}

func (a *App) RollbackStatefulSet(contextName, namespace, name string, toRevision int) error {
	return a.clients.RollbackStatefulSet(a.ctx, contextName, namespace, name, int32(toRevision))
}

func (a *App) RollbackDaemonSet(contextName, namespace, name string, toRevision int) error {
	return a.clients.RollbackDaemonSet(a.ctx, contextName, namespace, name, int32(toRevision))
}

func (a *App) GetWorkloadRevisionTemplate(contextName, kind, namespace, name string, revision int) (string, error) {
	return a.clients.WorkloadRevisionTemplate(a.ctx, contextName, kind, namespace, name, int32(revision))
}

func (a *App) RestartWorkload(contextName, kind, namespace, name string) error {
	return a.clients.RestartWorkload(a.ctx, contextName, kind, namespace, name)
}

func (a *App) StartPortForward(contextName, namespace, podName string, localPort, remotePort int) (kube.PortForwardInfo, error) {
	return a.clients.StartPortForward(contextName, namespace, podName, uint16(localPort), uint16(remotePort))
}

func (a *App) StopPortForward(id string) {
	a.clients.StopPortForward(id)
}

func (a *App) ListPortForwards() []kube.PortForwardInfo {
	return a.clients.ListPortForwards()
}

func (a *App) StartPodLogs(contextName, namespace, podName, container string, follow bool, tailLines int) (string, error) {
	var sessionID string
	id, err := a.clients.StartLogs(
		a.ctx,
		contextName,
		namespace,
		podName,
		container,
		follow,
		int64(tailLines),
		func(line string) {
			if sessionID == "" {
				return
			}
			runtime.EventsEmit(a.ctx, "pod:logs:line:"+sessionID, line)
		},
		func(err error) {
			if sessionID == "" {
				return
			}
			msg := ""
			if err != nil {
				msg = err.Error()
			}
			runtime.EventsEmit(a.ctx, "pod:logs:close:"+sessionID, msg)
		},
	)
	if err != nil {
		return "", err
	}
	sessionID = id
	return id, nil
}

func (a *App) StopPodLogs(sessionID string) {
	a.clients.StopLogs(sessionID)
}

func (a *App) StartExec(contextName, namespace, podName, container string, command []string) (string, error) {
	var sessionID string
	id, err := a.clients.StartExec(
		a.ctx, contextName, namespace, podName, container, command,
		func(data []byte) {
			if sessionID == "" {
				return
			}
			runtime.EventsEmit(a.ctx, "exec:out:"+sessionID, string(data))
		},
		func(err error) {
			if sessionID == "" {
				return
			}
			msg := ""
			if err != nil {
				msg = err.Error()
			}
			runtime.EventsEmit(a.ctx, "exec:close:"+sessionID, msg)
		},
	)
	if err != nil {
		return "", err
	}
	sessionID = id
	return id, nil
}

func (a *App) SendExecInput(sessionID, data string) {
	a.clients.SendExecInput(sessionID, data)
}

func (a *App) ResizeExec(sessionID string, cols, rows int) {
	a.clients.ResizeExec(sessionID, uint16(cols), uint16(rows))
}

func (a *App) StopExec(sessionID string) {
	a.clients.StopExec(sessionID)
}

func (a *App) StartNodeShell(contextName, nodeName string) (string, error) {
	var sessionID string
	id, err := a.clients.StartNodeShell(
		a.ctx, contextName, nodeName,
		func(data []byte) {
			if sessionID == "" {
				return
			}
			runtime.EventsEmit(a.ctx, "exec:out:"+sessionID, string(data))
		},
		func(err error) {
			if sessionID == "" {
				return
			}
			msg := ""
			if err != nil {
				msg = err.Error()
			}
			runtime.EventsEmit(a.ctx, "exec:close:"+sessionID, msg)
		},
	)
	if err != nil {
		return "", err
	}
	sessionID = id
	return id, nil
}

func (a *App) CordonNode(contextName, nodeName string, cordon bool) error {
	return a.clients.SetNodeCordon(a.ctx, contextName, nodeName, cordon)
}

// DrainNode returns immediately; progress streams over the
// "node:drain:<context>/<node>" event until a terminal done/error payload.
func (a *App) DrainNode(contextName, nodeName string) {
	event := "node:drain:" + contextName + "/" + nodeName
	go func() {
		ctx, cancel := context.WithTimeout(a.ctx, 15*time.Minute)
		defer cancel()
		err := a.clients.DrainNode(ctx, contextName, nodeName, func(p kube.NodeDrainProgress) {
			runtime.EventsEmit(a.ctx, event, p)
		})
		if err != nil {
			runtime.EventsEmit(a.ctx, event, kube.NodeDrainProgress{
				Node:    nodeName,
				Phase:   "error",
				Pending: []string{},
				Error:   err.Error(),
			})
		}
	}()
}

func (a *App) OpenLocalTerminal(contextName string, cols, rows int) (string, error) {
	var sessionID string
	id, err := a.clients.StartLocalTerminal(
		a.ctx, contextName, uint16(cols), uint16(rows),
		func(data []byte) {
			if sessionID == "" {
				return
			}
			runtime.EventsEmit(a.ctx, "term:out:"+sessionID, string(data))
		},
		func(err error) {
			if sessionID == "" {
				return
			}
			msg := ""
			if err != nil {
				msg = err.Error()
			}
			runtime.EventsEmit(a.ctx, "term:close:"+sessionID, msg)
		},
	)
	if err != nil {
		return "", err
	}
	sessionID = id
	return id, nil
}

func (a *App) SendLocalTerminalInput(sessionID, data string) {
	a.clients.SendLocalTerminalInput(sessionID, data)
}

func (a *App) ResizeLocalTerminal(sessionID string, cols, rows int) {
	a.clients.ResizeLocalTerminal(sessionID, uint16(cols), uint16(rows))
}

func (a *App) StopLocalTerminal(sessionID string) {
	a.clients.StopLocalTerminal(sessionID)
}

func (a *App) OpenInSystemTerminal(contextName, appID string) error {
	return a.clients.OpenInSystemTerminal(contextName, appID)
}

func (a *App) ListSystemTerminals() []kube.SystemTerminal {
	return a.clients.ListSystemTerminals()
}

func (a *App) OpenPodExecInSystemTerminal(contextName, namespace, podName, container, shellPath, appID string) error {
	return a.clients.OpenPodExecInSystemTerminal(contextName, namespace, podName, container, shellPath, appID)
}

func (a *App) ListDeployments(name, namespace string) []kube.DeploymentInfo {
	return a.clients.Deployments(name, namespace)
}

func (a *App) ListServices(name, namespace string) []kube.ServiceInfo {
	return a.clients.Services(name, namespace)
}

func (a *App) ListConfigMaps(name, namespace string) []kube.ConfigMapInfo {
	return a.clients.ConfigMaps(name, namespace)
}

func (a *App) ListSecrets(name, namespace string) []kube.SecretInfo {
	return a.clients.Secrets(name, namespace)
}

func (a *App) ListStatefulSets(name, namespace string) []kube.StatefulSetInfo {
	return a.clients.StatefulSets(name, namespace)
}

func (a *App) ListReplicaSets(name, namespace string) []kube.ReplicaSetInfo {
	return a.clients.ReplicaSets(name, namespace)
}

func (a *App) ListPersistentVolumeClaims(name, namespace string) []kube.PersistentVolumeClaimInfo {
	return a.clients.PersistentVolumeClaims(name, namespace)
}

func (a *App) ListPersistentVolumes(name string) []kube.PersistentVolumeInfo {
	return a.clients.PersistentVolumes(name)
}

func (a *App) ListStorageClasses(name string) []kube.StorageClassInfo {
	return a.clients.StorageClasses(name)
}

func (a *App) ListCSIDrivers(name string) []kube.CSIDriverInfo {
	return a.clients.CSIDrivers(name)
}

func (a *App) GetCSIDriver(contextName, name string) (*kube.CSIDriverDetail, error) {
	return a.clients.CSIDriver(contextName, name)
}

func (a *App) ListCSINodes(name string) []kube.CSINodeInfo {
	return a.clients.CSINodes(name)
}

func (a *App) GetCSINode(contextName, name string) (*kube.CSINodeDetail, error) {
	return a.clients.CSINode(contextName, name)
}

func (a *App) ListVolumeAttachments(name string) []kube.VolumeAttachmentInfo {
	return a.clients.VolumeAttachments(name)
}

func (a *App) GetVolumeAttachment(contextName, name string) (*kube.VolumeAttachmentDetail, error) {
	return a.clients.VolumeAttachment(contextName, name)
}

func (a *App) ListNetworkPolicies(name, namespace string) []kube.NetworkPolicyInfo {
	return a.clients.NetworkPolicies(name, namespace)
}

func (a *App) ListHorizontalPodAutoscalers(name, namespace string) []kube.HorizontalPodAutoscalerInfo {
	return a.clients.HorizontalPodAutoscalers(name, namespace)
}

func (a *App) ListPodDisruptionBudgets(name, namespace string) []kube.PodDisruptionBudgetInfo {
	return a.clients.PodDisruptionBudgets(name, namespace)
}

func (a *App) ListEndpointSlices(name, namespace string) []kube.EndpointSliceInfo {
	return a.clients.EndpointSlices(name, namespace)
}

func (a *App) ListResourceQuotas(name, namespace string) []kube.ResourceQuotaInfo {
	return a.clients.ResourceQuotas(name, namespace)
}

func (a *App) ListLimitRanges(name, namespace string) []kube.LimitRangeInfo {
	return a.clients.LimitRanges(name, namespace)
}

func (a *App) ListIngressClasses(name string) []kube.IngressClassInfo {
	return a.clients.IngressClasses(name)
}

func (a *App) ListPriorityClasses(name string) []kube.PriorityClassInfo {
	return a.clients.PriorityClasses(name)
}

func (a *App) ListRuntimeClasses(name string) []kube.RuntimeClassInfo {
	return a.clients.RuntimeClasses(name)
}

func (a *App) ListLeases(name, namespace string) []kube.LeaseInfo {
	return a.clients.Leases(name, namespace)
}

func (a *App) ListAPIServices(name string) []kube.APIServiceInfo {
	return a.clients.APIServices(name)
}

func (a *App) GetAPIService(contextName, name string) (*kube.APIServiceDetail, error) {
	return a.clients.APIService(contextName, name)
}

func (a *App) ListFlowSchemas(name string) []kube.FlowSchemaInfo {
	return a.clients.FlowSchemas(name)
}

func (a *App) GetFlowSchema(contextName, name string) (*kube.FlowSchemaDetail, error) {
	return a.clients.FlowSchema(contextName, name)
}

func (a *App) ListPriorityLevelConfigurations(name string) []kube.PriorityLevelConfigurationInfo {
	return a.clients.PriorityLevelConfigurations(name)
}

func (a *App) GetPriorityLevelConfiguration(contextName, name string) (*kube.PriorityLevelConfigurationDetail, error) {
	return a.clients.PriorityLevelConfiguration(contextName, name)
}

func (a *App) ListMutatingWebhookConfigurations(name string) []kube.WebhookConfigurationInfo {
	return a.clients.MutatingWebhookConfigurations(name)
}

func (a *App) ListValidatingWebhookConfigurations(name string) []kube.WebhookConfigurationInfo {
	return a.clients.ValidatingWebhookConfigurations(name)
}

func (a *App) ListValidatingAdmissionPolicies(name string) []kube.AdmissionPolicyInfo {
	return a.clients.ValidatingAdmissionPolicies(name)
}

func (a *App) GetValidatingAdmissionPolicy(contextName, name string) (*kube.AdmissionPolicyDetail, error) {
	return a.clients.ValidatingAdmissionPolicy(contextName, name)
}

func (a *App) ListValidatingAdmissionPolicyBindings(name string) []kube.AdmissionPolicyBindingInfo {
	return a.clients.ValidatingAdmissionPolicyBindings(name)
}

func (a *App) GetValidatingAdmissionPolicyBinding(contextName, name string) (*kube.AdmissionPolicyBindingDetail, error) {
	return a.clients.ValidatingAdmissionPolicyBinding(contextName, name)
}

func (a *App) ListMutatingAdmissionPolicies(name string) []kube.AdmissionPolicyInfo {
	return a.clients.MutatingAdmissionPolicies(name)
}

func (a *App) GetMutatingAdmissionPolicy(contextName, name string) (*kube.AdmissionPolicyDetail, error) {
	return a.clients.MutatingAdmissionPolicy(contextName, name)
}

func (a *App) ListMutatingAdmissionPolicyBindings(name string) []kube.AdmissionPolicyBindingInfo {
	return a.clients.MutatingAdmissionPolicyBindings(name)
}

func (a *App) GetMutatingAdmissionPolicyBinding(contextName, name string) (*kube.AdmissionPolicyBindingDetail, error) {
	return a.clients.MutatingAdmissionPolicyBinding(contextName, name)
}

func (a *App) ListDeviceClasses(name string) []kube.DeviceClassInfo {
	return a.clients.DeviceClasses(name)
}

func (a *App) GetDeviceClass(contextName, name string) (*kube.DeviceClassDetail, error) {
	return a.clients.DeviceClass(contextName, name)
}

func (a *App) ListResourceSlices(name string) []kube.ResourceSliceInfo {
	return a.clients.ResourceSlices(name)
}

func (a *App) GetResourceSlice(contextName, name string) (*kube.ResourceSliceDetail, error) {
	return a.clients.ResourceSlice(contextName, name)
}

func (a *App) ListResourceClaims(name, namespace string) []kube.ResourceClaimInfo {
	return a.clients.ResourceClaims(name, namespace)
}

func (a *App) GetResourceClaim(contextName, namespace, name string) (*kube.ResourceClaimDetail, error) {
	return a.clients.ResourceClaim(contextName, namespace, name)
}

func (a *App) ListResourceClaimTemplates(name, namespace string) []kube.ResourceClaimTemplateInfo {
	return a.clients.ResourceClaimTemplates(name, namespace)
}

func (a *App) GetResourceClaimTemplate(contextName, namespace, name string) (*kube.ResourceClaimTemplateDetail, error) {
	return a.clients.ResourceClaimTemplate(contextName, namespace, name)
}

func (a *App) ListServiceCIDRs(name string) []kube.ServiceCIDRInfo {
	return a.clients.ServiceCIDRs(name)
}

func (a *App) GetServiceCIDR(contextName, name string) (*kube.ServiceCIDRDetail, error) {
	return a.clients.ServiceCIDR(contextName, name)
}

func (a *App) ListIPAddresses(name string) []kube.IPAddressInfo {
	return a.clients.IPAddresses(name)
}

func (a *App) GetIPAddress(contextName, name string) (*kube.IPAddressDetail, error) {
	return a.clients.IPAddress(contextName, name)
}

func (a *App) ListEndpoints(name, namespace string) []kube.EndpointsInfo {
	return a.clients.EndpointsList(name, namespace)
}

func (a *App) ListReplicationControllers(name, namespace string) []kube.ReplicationControllerInfo {
	return a.clients.ReplicationControllers(name, namespace)
}

func (a *App) ListDaemonSets(name, namespace string) []kube.DaemonSetInfo {
	return a.clients.DaemonSets(name, namespace)
}

func (a *App) ListJobs(name, namespace string) []kube.JobInfo {
	return a.clients.Jobs(name, namespace)
}

func (a *App) ListCronJobs(name, namespace string) []kube.CronJobInfo {
	return a.clients.CronJobs(name, namespace)
}

func (a *App) ListIngresses(name, namespace string) []kube.IngressInfo {
	return a.clients.Ingresses(name, namespace)
}

func (a *App) ListNodes(name string) []kube.NodeInfo {
	return a.clients.Nodes(name)
}

func (a *App) ListServiceAccounts(name, namespace string) []kube.ServiceAccountInfo {
	return a.clients.ServiceAccounts(name, namespace)
}

func (a *App) GetServiceAccount(contextName, namespace, name string) (*kube.ServiceAccountDetail, error) {
	return a.clients.ServiceAccount(contextName, namespace, name)
}

func (a *App) ListRoles(name, namespace string) []kube.RoleInfo {
	return a.clients.Roles(name, namespace)
}

func (a *App) GetRole(contextName, namespace, name string) (*kube.RoleDetail, error) {
	return a.clients.Role(contextName, namespace, name)
}

func (a *App) ListRoleBindings(name, namespace string) []kube.RoleBindingInfo {
	return a.clients.RoleBindings(name, namespace)
}

func (a *App) GetRoleBinding(contextName, namespace, name string) (*kube.RoleBindingDetail, error) {
	return a.clients.RoleBinding(contextName, namespace, name)
}

func (a *App) ListClusterRoles(name string) []kube.ClusterRoleInfo {
	return a.clients.ClusterRoles(name)
}

func (a *App) GetClusterRole(contextName, name string) (*kube.ClusterRoleDetail, error) {
	return a.clients.ClusterRole(contextName, name)
}

func (a *App) ListClusterRoleBindings(name string) []kube.ClusterRoleBindingInfo {
	return a.clients.ClusterRoleBindings(name)
}

func (a *App) GetClusterRoleBinding(contextName, name string) (*kube.ClusterRoleBindingDetail, error) {
	return a.clients.ClusterRoleBinding(contextName, name)
}

func (a *App) ListAccessSubjects(contextName string) []kube.AccessSubject {
	return a.clients.AccessSubjects(contextName)
}

func (a *App) ListCertificateSigningRequests(name string) []kube.CertificateSigningRequestInfo {
	return a.clients.CertificateSigningRequests(name)
}

func (a *App) GetCertificateSigningRequest(contextName, name string) (*kube.CertificateSigningRequestDetail, error) {
	return a.clients.CertificateSigningRequest(contextName, name)
}

func (a *App) ApproveCertificateSigningRequest(contextName, name, message string) error {
	return a.clients.ApproveCSR(a.ctx, contextName, name, message)
}

func (a *App) DenyCertificateSigningRequest(contextName, name, message string) error {
	return a.clients.DenyCSR(a.ctx, contextName, name, message)
}

func (a *App) ListAccessibleKinds(contextName string) []string {
	out := a.clients.AccessibleKinds(contextName)
	if out == nil {
		return []string{}
	}
	return out
}

func (a *App) GetSubjectAccess(contextName, kind, namespace, name string) (*kube.SubjectAccess, error) {
	return a.clients.SubjectAccess(contextName, kind, namespace, name)
}

func (a *App) ListHelmReleases(contextName, namespace string) ([]kube.HelmReleaseInfo, error) {
	return a.clients.HelmReleases(contextName, namespace)
}

func (a *App) GetHelmRelease(contextName, namespace, name string) (*kube.HelmReleaseDetail, error) {
	return a.clients.HelmRelease(contextName, namespace, name)
}

func (a *App) ListHelmReleaseHistory(contextName, namespace, name string) ([]kube.HelmRevisionInfo, error) {
	return a.clients.HelmReleaseHistory(contextName, namespace, name)
}

func (a *App) InstallHelmRelease(opts kube.HelmInstallOptions) (*kube.HelmDryRunResult, error) {
	return a.clients.HelmInstall(a.ctx, opts)
}

func (a *App) UpgradeHelmRelease(opts kube.HelmInstallOptions) (*kube.HelmDryRunResult, error) {
	return a.clients.HelmUpgrade(a.ctx, opts)
}

func (a *App) RollbackHelmRelease(contextName, namespace, name string, revision int, wait bool) error {
	return a.clients.HelmRollback(contextName, namespace, name, revision, wait)
}

func (a *App) UninstallHelmRelease(contextName, namespace, name string, keepHistory bool) error {
	return a.clients.HelmUninstall(contextName, namespace, name, keepHistory)
}

func (a *App) ListHelmRepos() ([]kube.HelmRepoInfo, error) {
	return a.clients.HelmRepos()
}

func (a *App) AddHelmRepo(name, url string) error {
	return a.clients.HelmAddRepo(name, url)
}

func (a *App) RemoveHelmRepo(name string) error {
	return a.clients.HelmRemoveRepo(name)
}

func (a *App) UpdateHelmRepos() error {
	return a.clients.HelmUpdateRepos()
}

func (a *App) SearchHelmCharts(query string) ([]kube.HelmChartSearchResult, error) {
	return a.clients.HelmSearchCharts(query)
}

func (a *App) HelmChartVersions(repoName, chartName string) ([]string, error) {
	return a.clients.HelmChartVersions(repoName, chartName)
}

func (a *App) ListCRDs(contextName string) []kube.CRDInfo {
	return a.clients.CRDs(contextName)
}

func (a *App) EnsureCustomResourceWatch(contextName, group, version, resource string) error {
	return a.clients.EnsureCRWatch(contextName, group, version, resource)
}

func (a *App) ListCustomResources(contextName, group, version, resource, namespace string) []kube.CustomResourceInfo {
	return a.clients.CustomResources(contextName, group, version, resource, namespace)
}

func (a *App) GetCustomResourceYAML(contextName, group, version, resource, namespace, name string) (string, error) {
	obj, err := a.clients.CustomResource(a.ctx, contextName, group, version, resource, namespace, name)
	if err != nil {
		return "", err
	}
	return kube.MarshalCustomResourceYAML(obj)
}

func (a *App) SyncArgoApplication(contextName, namespace, name string, opts kube.ArgoSyncOptions) error {
	return a.clients.SyncArgoApplication(a.ctx, contextName, namespace, name, opts)
}

func (a *App) RefreshArgoApplication(contextName, namespace, name, mode string) error {
	return a.clients.RefreshArgoApplication(a.ctx, contextName, namespace, name, mode)
}

func (a *App) DeleteArgoApplication(contextName, namespace, name, cascade string) error {
	return a.clients.DeleteArgoApplication(a.ctx, contextName, namespace, name, cascade)
}

func (a *App) SetArgoApplicationAutomation(contextName, namespace, name string, enabled bool) error {
	return a.clients.SetArgoApplicationAutomation(a.ctx, contextName, namespace, name, enabled)
}

func (a *App) ListArgoApplicationHistory(contextName, namespace, name string) ([]kube.ArgoApplicationHistoryEntry, error) {
	return a.clients.ListArgoApplicationHistory(a.ctx, contextName, namespace, name)
}

func (a *App) RollbackArgoApplication(contextName, namespace, name string, id int64, prune bool) error {
	return a.clients.RollbackArgoApplication(a.ctx, contextName, namespace, name, id, prune)
}

func (a *App) GetArgoApplicationOperationState(contextName, namespace, name string) (kube.ArgoOperationState, error) {
	return a.clients.GetArgoApplicationOperationState(a.ctx, contextName, namespace, name)
}

func (a *App) ListArgoApplicationResources(contextName, namespace, name string) ([]kube.ArgoApplicationResource, error) {
	return a.clients.ListArgoApplicationResources(a.ctx, contextName, namespace, name)
}

func (a *App) ListArgoApplications(contextName, namespace string) []kube.ArgoApplicationInfo {
	return a.clients.ListArgoApplications(contextName, namespace)
}

func (a *App) ListArgoAppProjects(contextName, namespace string) []kube.ArgoAppProjectInfo {
	return a.clients.ListArgoAppProjects(contextName, namespace)
}

func (a *App) GetArgoAppProject(contextName, namespace, name string) (*kube.ArgoAppProjectDetail, error) {
	return a.clients.GetArgoAppProject(a.ctx, contextName, namespace, name)
}

func (a *App) ListArgoApplicationSets(contextName, namespace string) []kube.ArgoApplicationSetInfo {
	return a.clients.ListArgoApplicationSets(contextName, namespace)
}

func (a *App) GetArgoApplicationSet(contextName, namespace, name string) (*kube.ArgoApplicationSetDetail, error) {
	return a.clients.GetArgoApplicationSet(a.ctx, contextName, namespace, name)
}

func (a *App) ListEvents(contextName, namespace, kind, name string) ([]kube.EventInfo, error) {
	return a.clients.ListEvents(a.ctx, contextName, namespace, kind, name)
}

func (a *App) ListClusterWarningEvents(contextName string, limit int) ([]kube.EventInfo, error) {
	return a.clients.ListClusterWarningEvents(a.ctx, contextName, limit)
}

func (a *App) GetClusterOverview(contextName string) (*kube.ClusterOverview, error) {
	return a.clients.GetClusterOverview(a.ctx, contextName)
}

func (a *App) ListPodMetrics(contextName, namespace string) ([]kube.PodMetrics, error) {
	return a.clients.ListPodMetrics(a.ctx, contextName, namespace)
}

func (a *App) ListNodeMetrics(contextName string) ([]kube.NodeMetrics, error) {
	return a.clients.ListNodeMetrics(a.ctx, contextName)
}

func (a *App) SaveTextFile(defaultName, content string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultName,
		Title:           "Save file",
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return "", errors.New("write failed: " + err.Error())
	}
	return path, nil
}

// ---------------------------------------------------------------------------
// Gateway API bindings.
// ---------------------------------------------------------------------------

func (a *App) ListGateways(name, namespace string) []kube.GatewayInfo {
	return a.clients.Gateways(name, namespace)
}

func (a *App) GetGateway(contextName, namespace, name string) (*kube.GatewayDetail, error) {
	return a.clients.Gateway(contextName, namespace, name)
}

func (a *App) ListHTTPRoutes(name, namespace string) []kube.HTTPRouteInfo {
	return a.clients.HTTPRoutes(name, namespace)
}

func (a *App) GetHTTPRoute(contextName, namespace, name string) (*kube.HTTPRouteDetail, error) {
	return a.clients.HTTPRoute(contextName, namespace, name)
}

func (a *App) ListGRPCRoutes(name, namespace string) []kube.GRPCRouteInfo {
	return a.clients.GRPCRoutes(name, namespace)
}

func (a *App) GetGRPCRoute(contextName, namespace, name string) (*kube.GRPCRouteDetail, error) {
	return a.clients.GRPCRoute(contextName, namespace, name)
}

func (a *App) ListGatewayClasses(name string) []kube.GatewayClassInfo {
	return a.clients.GatewayClasses(name)
}

func (a *App) GetGatewayClass(contextName, name string) (*kube.GatewayClassDetail, error) {
	return a.clients.GatewayClass(contextName, name)
}

func (a *App) ListReferenceGrants(name, namespace string) []kube.ReferenceGrantInfo {
	return a.clients.ReferenceGrants(name, namespace)
}

func (a *App) GetReferenceGrant(contextName, namespace, name string) (*kube.ReferenceGrantDetail, error) {
	return a.clients.ReferenceGrant(contextName, namespace, name)
}

// ---------------------------------------------------------------------------
// Flux CD bindings.
// ---------------------------------------------------------------------------

func (a *App) ListFluxKustomizations(contextName, namespace string) []kube.FluxKustomizationInfo {
	return a.clients.ListFluxKustomizations(contextName, namespace)
}

func (a *App) GetFluxKustomization(contextName, namespace, name string) (*kube.FluxKustomizationDetail, error) {
	return a.clients.GetFluxKustomization(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxHelmReleases(contextName, namespace string) []kube.FluxHelmReleaseInfo {
	return a.clients.ListFluxHelmReleases(contextName, namespace)
}

func (a *App) GetFluxHelmRelease(contextName, namespace, name string) (*kube.FluxHelmReleaseDetail, error) {
	return a.clients.GetFluxHelmRelease(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxGitRepositories(contextName, namespace string) []kube.FluxGitRepositoryInfo {
	return a.clients.ListFluxGitRepositories(contextName, namespace)
}

func (a *App) GetFluxGitRepository(contextName, namespace, name string) (*kube.FluxGitRepositoryDetail, error) {
	return a.clients.GetFluxGitRepository(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxHelmRepositories(contextName, namespace string) []kube.FluxHelmRepositoryInfo {
	return a.clients.ListFluxHelmRepositories(contextName, namespace)
}

func (a *App) GetFluxHelmRepository(contextName, namespace, name string) (*kube.FluxHelmRepositoryDetail, error) {
	return a.clients.GetFluxHelmRepository(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxOCIRepositories(contextName, namespace string) []kube.FluxOCIRepositoryInfo {
	return a.clients.ListFluxOCIRepositories(contextName, namespace)
}

func (a *App) GetFluxOCIRepository(contextName, namespace, name string) (*kube.FluxOCIRepositoryDetail, error) {
	return a.clients.GetFluxOCIRepository(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxBuckets(contextName, namespace string) []kube.FluxBucketInfo {
	return a.clients.ListFluxBuckets(contextName, namespace)
}

func (a *App) GetFluxBucket(contextName, namespace, name string) (*kube.FluxBucketDetail, error) {
	return a.clients.GetFluxBucket(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxProviders(contextName, namespace string) []kube.FluxProviderInfo {
	return a.clients.ListFluxProviders(contextName, namespace)
}

func (a *App) GetFluxProvider(contextName, namespace, name string) (*kube.FluxProviderDetail, error) {
	return a.clients.GetFluxProvider(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxAlerts(contextName, namespace string) []kube.FluxAlertInfo {
	return a.clients.ListFluxAlerts(contextName, namespace)
}

func (a *App) GetFluxAlert(contextName, namespace, name string) (*kube.FluxAlertDetail, error) {
	return a.clients.GetFluxAlert(a.ctx, contextName, namespace, name)
}

func (a *App) ListFluxReceivers(contextName, namespace string) []kube.FluxReceiverInfo {
	return a.clients.ListFluxReceivers(contextName, namespace)
}

func (a *App) GetFluxReceiver(contextName, namespace, name string) (*kube.FluxReceiverDetail, error) {
	return a.clients.GetFluxReceiver(a.ctx, contextName, namespace, name)
}

func (a *App) ReconcileFluxResource(contextName, kind, namespace, name string) error {
	return a.clients.ReconcileFluxResource(a.ctx, contextName, kind, namespace, name)
}

func (a *App) SetFluxResourceSuspended(contextName, kind, namespace, name string, suspended bool) error {
	return a.clients.SetFluxResourceSuspended(a.ctx, contextName, kind, namespace, name, suspended)
}

// ---------------------------------------------------------------------------
// Istio bindings.
// ---------------------------------------------------------------------------

func (a *App) ListIstioVirtualServices(contextName, namespace string) []kube.IstioVirtualServiceInfo {
	return a.clients.ListIstioVirtualServices(contextName, namespace)
}

func (a *App) GetIstioVirtualService(contextName, namespace, name string) (*kube.IstioVirtualServiceDetail, error) {
	return a.clients.GetIstioVirtualService(a.ctx, contextName, namespace, name)
}

func (a *App) ListIstioDestinationRules(contextName, namespace string) []kube.IstioDestinationRuleInfo {
	return a.clients.ListIstioDestinationRules(contextName, namespace)
}

func (a *App) GetIstioDestinationRule(contextName, namespace, name string) (*kube.IstioDestinationRuleDetail, error) {
	return a.clients.GetIstioDestinationRule(a.ctx, contextName, namespace, name)
}

func (a *App) ListIstioPeerAuthentications(contextName, namespace string) []kube.IstioPeerAuthenticationInfo {
	return a.clients.ListIstioPeerAuthentications(contextName, namespace)
}

func (a *App) GetIstioPeerAuthentication(contextName, namespace, name string) (*kube.IstioPeerAuthenticationDetail, error) {
	return a.clients.GetIstioPeerAuthentication(a.ctx, contextName, namespace, name)
}

// ---------------------------------------------------------------------------
// cert-manager bindings.
// ---------------------------------------------------------------------------

func (a *App) ListCertManagerCertificates(contextName, namespace string) []kube.CertManagerCertificateInfo {
	return a.clients.ListCertManagerCertificates(contextName, namespace)
}

func (a *App) GetCertManagerCertificate(contextName, namespace, name string) (*kube.CertManagerCertificateDetail, error) {
	return a.clients.GetCertManagerCertificate(a.ctx, contextName, namespace, name)
}

func (a *App) ListCertManagerIssuers(contextName, namespace string) []kube.CertManagerIssuerInfo {
	return a.clients.ListCertManagerIssuers(contextName, namespace)
}

func (a *App) GetCertManagerIssuer(contextName, namespace, name string) (*kube.CertManagerIssuerDetail, error) {
	return a.clients.GetCertManagerIssuer(a.ctx, contextName, namespace, name)
}

func (a *App) ListCertManagerClusterIssuers(contextName string) []kube.CertManagerIssuerInfo {
	return a.clients.ListCertManagerClusterIssuers(contextName)
}

func (a *App) GetCertManagerClusterIssuer(contextName, name string) (*kube.CertManagerIssuerDetail, error) {
	return a.clients.GetCertManagerClusterIssuer(a.ctx, contextName, name)
}

func (a *App) RenewCertificate(contextName, namespace, name string) error {
	return a.clients.RenewCertificate(a.ctx, contextName, namespace, name)
}

func (a *App) ListCertManagerCertificateRequests(contextName, namespace string) []kube.CertManagerCertificateRequestInfo {
	return a.clients.ListCertManagerCertificateRequests(contextName, namespace)
}

func (a *App) GetCertManagerCertificateRequest(contextName, namespace, name string) (*kube.CertManagerCertificateRequestDetail, error) {
	return a.clients.GetCertManagerCertificateRequest(a.ctx, contextName, namespace, name)
}

func (a *App) CertManagerCertificateRequestsFor(contextName, namespace, certName string) []kube.CertManagerCertificateRequestInfo {
	return a.clients.CertManagerCertificateRequestsFor(contextName, namespace, certName)
}

func (a *App) ListCertManagerOrders(contextName, namespace string) []kube.CertManagerOrderInfo {
	return a.clients.ListCertManagerOrders(contextName, namespace)
}

func (a *App) GetCertManagerOrder(contextName, namespace, name string) (*kube.CertManagerOrderDetail, error) {
	return a.clients.GetCertManagerOrder(a.ctx, contextName, namespace, name)
}

func (a *App) CertManagerOrdersFor(contextName, namespace, requestName string) []kube.CertManagerOrderInfo {
	return a.clients.CertManagerOrdersFor(contextName, namespace, requestName)
}

func (a *App) ListCertManagerChallenges(contextName, namespace string) []kube.CertManagerChallengeInfo {
	return a.clients.ListCertManagerChallenges(contextName, namespace)
}

func (a *App) GetCertManagerChallenge(contextName, namespace, name string) (*kube.CertManagerChallengeDetail, error) {
	return a.clients.GetCertManagerChallenge(a.ctx, contextName, namespace, name)
}

func (a *App) CertManagerChallengesFor(contextName, namespace, orderName string) []kube.CertManagerChallengeInfo {
	return a.clients.CertManagerChallengesFor(contextName, namespace, orderName)
}

// ---------------------------------------------------------------------------
// Karpenter bindings.
// ---------------------------------------------------------------------------

func (a *App) ListKarpenterNodePools(contextName string) []kube.KarpenterNodePoolInfo {
	return a.clients.ListKarpenterNodePools(contextName)
}

func (a *App) ListKarpenterNodeClaims(contextName string) []kube.KarpenterNodeClaimInfo {
	return a.clients.ListKarpenterNodeClaims(contextName)
}

func (a *App) ListNodePoolNodes(contextName, nodePoolName string) []kube.NodeInfo {
	return a.clients.NodesForNodePool(contextName, nodePoolName)
}

func (a *App) ListNodeClaimNode(contextName, nodeClaimName string) []kube.NodeInfo {
	return a.clients.NodeForNodeClaim(contextName, nodeClaimName)
}

func (a *App) FetchMetricsServerManifest() (string, error) {
	return kube.FetchMetricsServerManifest(a.ctx)
}

func (a *App) RecommendInsecureKubeletTLS(contextName string) (bool, error) {
	return a.clients.RecommendInsecureKubeletTLS(a.ctx, contextName)
}

func (a *App) IsMetricsServerKlustrManaged(contextName string) (bool, error) {
	return a.clients.IsMetricsServerKlustrManaged(a.ctx, contextName)
}
