import {
  AddHelmRepo,
  ApplyResourceYAML,
  DeleteResource,
  EnsureCustomResourceWatch,
  GetCustomResourceYAML,
  SyncArgoApplication,
  RefreshArgoApplication,
  ListArgoApplicationResources,
  ListArgoApplications,
  GetHelmRelease,
  HelmChartVersions,
  InstallHelmRelease,
  ListCRDs,
  ListCustomResources,
  ListHelmReleaseHistory,
  ListHelmReleases,
  ListHelmRepos,
  RemoveHelmRepo,
  RollbackHelmRelease,
  SearchHelmCharts,
  UninstallHelmRelease,
  UpdateHelmRepos,
  UpgradeHelmRelease,
  ListEvents,
  ListClusterWarningEvents,
  GetClusterOverview,
  ListPodMetrics,
  ListPortForwards,
  PodLogTargets,
  SaveTextFile,
  StartPortForward,
  StopPortForward,
  GetConfigMap,
  GetCronJob,
  GetDaemonSet,
  GetReplicaSet,
  GetPersistentVolumeClaim,
  GetPersistentVolume,
  GetStorageClass,
  GetNetworkPolicy,
  GetHorizontalPodAutoscaler,
  GetPodDisruptionBudget,
  GetEndpointSlice,
  GetResourceQuota,
  GetLimitRange,
  GetIngressClass,
  GetPriorityClass,
  GetRuntimeClass,
  GetLease,
  GetMutatingWebhookConfiguration,
  GetValidatingWebhookConfiguration,
  GetEndpoints,
  GetReplicationController,
  GetDeployment,
  GetIngress,
  GetJob,
  GetNamespace,
  GetNode,
  GetPod,
  GetResourceYAML,
  GetSecret,
  RevealSecretValue,
  GetService,
  GetStatefulSet,
  ListConfigMaps,
  ListContexts,
  ListCronJobs,
  ListDaemonSets,
  ListReplicaSets,
  ListPersistentVolumeClaims,
  ListPersistentVolumes,
  ListStorageClasses,
  ListNetworkPolicies,
  ListHorizontalPodAutoscalers,
  ListPodDisruptionBudgets,
  ListEndpointSlices,
  ListResourceQuotas,
  ListLimitRanges,
  ListIngressClasses,
  ListPriorityClasses,
  ListRuntimeClasses,
  ListLeases,
  ListMutatingWebhookConfigurations,
  ListValidatingWebhookConfigurations,
  ListEndpoints,
  ListReplicationControllers,
  ListDeployments,
  ListIngresses,
  ListJobs,
  ListNamespaces,
  ListNodes,
  ListServiceAccounts,
  GetServiceAccount,
  ListRoles,
  GetRole,
  ListRoleBindings,
  GetRoleBinding,
  ListClusterRoles,
  GetClusterRole,
  ListClusterRoleBindings,
  GetClusterRoleBinding,
  ListPods,
  PodsForOwner,
  ListSecrets,
  ListServices,
  ListStatefulSets,
  PingContext,
  ResizeExec,
  PatchDeploymentPaused,
  PatchHPAReplicas,
  RestartWorkload,
  ScaleResource,
  SendExecInput,
  StartExec,
  StartPodLogs,
  StartWatch,
  StopExec,
  StopPodLogs,
  StopWatch,
  Version,
} from '@/lib/wails/wailsjs/go/app/App'
import { kube } from '@/lib/wails/wailsjs/go/models'

export type ContextInfo = kube.ContextInfo
export type Kubeconfig = kube.Kubeconfig
export type ServerVersion = kube.ServerVersion
export type NamespaceInfo = kube.NamespaceInfo
export type PodInfo = kube.PodInfo
export type DeploymentInfo = kube.DeploymentInfo
export type ServiceInfo = kube.ServiceInfo
export type ConfigMapInfo = kube.ConfigMapInfo
export type SecretInfo = kube.SecretInfo
export type StatefulSetInfo = kube.StatefulSetInfo
export type DaemonSetInfo = kube.DaemonSetInfo
export type ReplicaSetInfo = kube.ReplicaSetInfo
export type PersistentVolumeClaimInfo = kube.PersistentVolumeClaimInfo
export type PersistentVolumeInfo = kube.PersistentVolumeInfo
export type StorageClassInfo = kube.StorageClassInfo
export type NetworkPolicyInfo = kube.NetworkPolicyInfo
export type HorizontalPodAutoscalerInfo = kube.HorizontalPodAutoscalerInfo
export type HPAMetricTarget = kube.HPAMetricTarget
export type PodDisruptionBudgetInfo = kube.PodDisruptionBudgetInfo
export type EndpointSliceInfo = kube.EndpointSliceInfo
export type ResourceQuotaInfo = kube.ResourceQuotaInfo
export type LimitRangeInfo = kube.LimitRangeInfo
export type IngressClassInfo = kube.IngressClassInfo
export type PriorityClassInfo = kube.PriorityClassInfo
export type RuntimeClassInfo = kube.RuntimeClassInfo
export type LeaseInfo = kube.LeaseInfo
export type WebhookConfigurationInfo = kube.WebhookConfigurationInfo
export type EndpointsInfo = kube.EndpointsInfo
export type ReplicationControllerInfo = kube.ReplicationControllerInfo
export type JobInfo = kube.JobInfo
export type CronJobInfo = kube.CronJobInfo
export type IngressInfo = kube.IngressInfo
export type NodeInfo = kube.NodeInfo
export type ServiceAccountInfo = kube.ServiceAccountInfo
export type RoleInfo = kube.RoleInfo
export type RoleBindingInfo = kube.RoleBindingInfo
export type ClusterRoleInfo = kube.ClusterRoleInfo
export type ClusterRoleBindingInfo = kube.ClusterRoleBindingInfo
export type PodDetail = kube.PodDetail
export type ContainerDetail = kube.ContainerDetail
export type ContainerEnvVar = kube.ContainerEnvVar
export type ContainerEnvFrom = kube.ContainerEnvFrom
export type EnvVarRef = kube.EnvVarRef
export type ContainerPort = kube.ContainerPort
export type ConditionDetail = kube.ConditionDetail
export type OwnerRef = kube.OwnerRef
export type ContainerSummary = kube.ContainerSummary
export type DeploymentDetail = kube.DeploymentDetail
export type StatefulSetDetail = kube.StatefulSetDetail
export type DaemonSetDetail = kube.DaemonSetDetail
export type ReplicaSetDetail = kube.ReplicaSetDetail
export type PersistentVolumeClaimDetail = kube.PersistentVolumeClaimDetail
export type PersistentVolumeDetail = kube.PersistentVolumeDetail
export type StorageClassDetail = kube.StorageClassDetail
export type NetworkPolicyDetail = kube.NetworkPolicyDetail
export type HorizontalPodAutoscalerDetail = kube.HorizontalPodAutoscalerDetail
export type PodDisruptionBudgetDetail = kube.PodDisruptionBudgetDetail
export type EndpointSliceDetail = kube.EndpointSliceDetail
export type EndpointSliceEndpoint = kube.EndpointSliceEndpoint
export type EndpointSlicePort = kube.EndpointSlicePort
export type ResourceQuotaDetail = kube.ResourceQuotaDetail
export type ResourceQuotaEntry = kube.ResourceQuotaEntry
export type LimitRangeDetail = kube.LimitRangeDetail
export type LimitRangeItem = kube.LimitRangeItem
export type IngressClassDetail = kube.IngressClassDetail
export type PriorityClassDetail = kube.PriorityClassDetail
export type RuntimeClassDetail = kube.RuntimeClassDetail
export type LeaseDetail = kube.LeaseDetail
export type WebhookConfigurationDetail = kube.WebhookConfigurationDetail
export type WebhookSummary = kube.WebhookSummary
export type EndpointsDetail = kube.EndpointsDetail
export type EndpointsSubset = kube.EndpointsSubset
export type EndpointsSubsetAddress = kube.EndpointsSubsetAddress
export type EndpointsSubsetPort = kube.EndpointsSubsetPort
export type ReplicationControllerDetail = kube.ReplicationControllerDetail
export type JobDetail = kube.JobDetail
export type CronJobDetail = kube.CronJobDetail
export type ServiceDetail = kube.ServiceDetail
export type ServicePortDetail = kube.ServicePortDetail
export type ConfigMapDetail = kube.ConfigMapDetail
export type SecretDetail = kube.SecretDetail
export type SecretKeyInfo = kube.SecretKeyInfo
export type IngressDetail = kube.IngressDetail
export type IngressRuleDetail = kube.IngressRuleDetail
export type IngressPathDetail = kube.IngressPathDetail
export type IngressTLSDetail = kube.IngressTLSDetail
export type NodeDetail = kube.NodeDetail
export type NodeTaintDetail = kube.NodeTaintDetail
export type NamespaceDetail = kube.NamespaceDetail
export type ServiceAccountDetail = kube.ServiceAccountDetail
export type ObjectRefDetail = kube.ObjectRefDetail
export type RoleDetail = kube.RoleDetail
export type RoleBindingDetail = kube.RoleBindingDetail
export type ClusterRoleDetail = kube.ClusterRoleDetail
export type ClusterRoleBindingDetail = kube.ClusterRoleBindingDetail
export type PolicyRuleDetail = kube.PolicyRuleDetail
export type SubjectDetail = kube.SubjectDetail
export type RoleRefDetail = kube.RoleRefDetail
export type PortForwardInfo = kube.PortForwardInfo
export type PodLogTarget = kube.PodLogTarget
export type EventInfo = kube.EventInfo
export type PodMetrics = kube.PodMetrics
export type ClusterOverview = kube.ClusterOverview
export type ClusterResource = kube.ClusterResource
export type ClusterPods = kube.ClusterPods
export type CRDInfo = kube.CRDInfo
export type CustomResourceInfo = kube.CustomResourceInfo
export type HelmReleaseInfo = kube.HelmReleaseInfo
export type HelmReleaseDetail = kube.HelmReleaseDetail
export type HelmRevisionInfo = kube.HelmRevisionInfo
export type HelmRepoInfo = kube.HelmRepoInfo
export type HelmChartSearchResult = kube.HelmChartSearchResult
export type HelmInstallOptions = kube.HelmInstallOptions
export type HelmDryRunResult = kube.HelmDryRunResult
export type ArgoApplicationResource = kube.ArgoApplicationResource
export type ArgoApplicationInfo = kube.ArgoApplicationInfo

export const api = {
  listContexts: (): Promise<Kubeconfig> => ListContexts(),
  pingContext: (name: string): Promise<ServerVersion> => PingContext(name),
  startWatch: (name: string): Promise<void> => StartWatch(name),
  stopWatch: (name: string): Promise<void> => StopWatch(name),
  listNamespaces: (name: string): Promise<NamespaceInfo[]> => ListNamespaces(name),
  listPods: (name: string, namespace: string): Promise<PodInfo[]> => ListPods(name, namespace),
  podsForOwner: (
    contextName: string,
    kind: string,
    namespace: string,
    name: string,
  ): Promise<PodInfo[]> => PodsForOwner(contextName, kind, namespace, name),
  listDeployments: (name: string, namespace: string): Promise<DeploymentInfo[]> =>
    ListDeployments(name, namespace),
  listServices: (name: string, namespace: string): Promise<ServiceInfo[]> =>
    ListServices(name, namespace),
  listConfigMaps: (name: string, namespace: string): Promise<ConfigMapInfo[]> =>
    ListConfigMaps(name, namespace),
  listSecrets: (name: string, namespace: string): Promise<SecretInfo[]> =>
    ListSecrets(name, namespace),
  listStatefulSets: (name: string, namespace: string): Promise<StatefulSetInfo[]> =>
    ListStatefulSets(name, namespace),
  listDaemonSets: (name: string, namespace: string): Promise<DaemonSetInfo[]> =>
    ListDaemonSets(name, namespace),
  listReplicaSets: (name: string, namespace: string): Promise<ReplicaSetInfo[]> =>
    ListReplicaSets(name, namespace),
  listPersistentVolumeClaims: (name: string, namespace: string): Promise<PersistentVolumeClaimInfo[]> =>
    ListPersistentVolumeClaims(name, namespace),
  listPersistentVolumes: (name: string): Promise<PersistentVolumeInfo[]> =>
    ListPersistentVolumes(name),
  listStorageClasses: (name: string): Promise<StorageClassInfo[]> => ListStorageClasses(name),
  listNetworkPolicies: (name: string, namespace: string): Promise<NetworkPolicyInfo[]> =>
    ListNetworkPolicies(name, namespace),
  listHorizontalPodAutoscalers: (name: string, namespace: string): Promise<HorizontalPodAutoscalerInfo[]> =>
    ListHorizontalPodAutoscalers(name, namespace),
  listPodDisruptionBudgets: (name: string, namespace: string): Promise<PodDisruptionBudgetInfo[]> =>
    ListPodDisruptionBudgets(name, namespace),
  listEndpointSlices: (name: string, namespace: string): Promise<EndpointSliceInfo[]> =>
    ListEndpointSlices(name, namespace),
  listResourceQuotas: (name: string, namespace: string): Promise<ResourceQuotaInfo[]> =>
    ListResourceQuotas(name, namespace),
  listLimitRanges: (name: string, namespace: string): Promise<LimitRangeInfo[]> =>
    ListLimitRanges(name, namespace),
  listIngressClasses: (name: string): Promise<IngressClassInfo[]> => ListIngressClasses(name),
  listPriorityClasses: (name: string): Promise<PriorityClassInfo[]> => ListPriorityClasses(name),
  listRuntimeClasses: (name: string): Promise<RuntimeClassInfo[]> => ListRuntimeClasses(name),
  listLeases: (name: string, namespace: string): Promise<LeaseInfo[]> =>
    ListLeases(name, namespace),
  listMutatingWebhookConfigurations: (name: string): Promise<WebhookConfigurationInfo[]> =>
    ListMutatingWebhookConfigurations(name),
  listValidatingWebhookConfigurations: (name: string): Promise<WebhookConfigurationInfo[]> =>
    ListValidatingWebhookConfigurations(name),
  listEndpoints: (name: string, namespace: string): Promise<EndpointsInfo[]> =>
    ListEndpoints(name, namespace),
  listReplicationControllers: (name: string, namespace: string): Promise<ReplicationControllerInfo[]> =>
    ListReplicationControllers(name, namespace),
  listJobs: (name: string, namespace: string): Promise<JobInfo[]> => ListJobs(name, namespace),
  listCronJobs: (name: string, namespace: string): Promise<CronJobInfo[]> =>
    ListCronJobs(name, namespace),
  listIngresses: (name: string, namespace: string): Promise<IngressInfo[]> =>
    ListIngresses(name, namespace),
  listNodes: (name: string): Promise<NodeInfo[]> => ListNodes(name),
  listServiceAccounts: (name: string, namespace: string): Promise<ServiceAccountInfo[]> =>
    ListServiceAccounts(name, namespace),
  listRoles: (name: string, namespace: string): Promise<RoleInfo[]> =>
    ListRoles(name, namespace),
  listRoleBindings: (name: string, namespace: string): Promise<RoleBindingInfo[]> =>
    ListRoleBindings(name, namespace),
  listClusterRoles: (name: string): Promise<ClusterRoleInfo[]> => ListClusterRoles(name),
  listClusterRoleBindings: (name: string): Promise<ClusterRoleBindingInfo[]> =>
    ListClusterRoleBindings(name),
  getServiceAccount: (ctx: string, ns: string, name: string): Promise<ServiceAccountDetail> =>
    GetServiceAccount(ctx, ns, name),
  getRole: (ctx: string, ns: string, name: string): Promise<RoleDetail> => GetRole(ctx, ns, name),
  getRoleBinding: (ctx: string, ns: string, name: string): Promise<RoleBindingDetail> =>
    GetRoleBinding(ctx, ns, name),
  getClusterRole: (ctx: string, name: string): Promise<ClusterRoleDetail> =>
    GetClusterRole(ctx, name),
  getClusterRoleBinding: (ctx: string, name: string): Promise<ClusterRoleBindingDetail> =>
    GetClusterRoleBinding(ctx, name),
  getPod: (contextName: string, namespace: string, name: string): Promise<PodDetail> =>
    GetPod(contextName, namespace, name),
  startPodLogs: (
    contextName: string,
    namespace: string,
    podName: string,
    container: string,
    follow: boolean,
    tailLines: number,
  ): Promise<string> =>
    StartPodLogs(contextName, namespace, podName, container, follow, tailLines),
  stopPodLogs: (sessionId: string): Promise<void> => StopPodLogs(sessionId),
  startExec: (
    contextName: string,
    namespace: string,
    podName: string,
    container: string,
    command: string[],
  ): Promise<string> => StartExec(contextName, namespace, podName, container, command),
  sendExecInput: (sessionId: string, data: string): Promise<void> => SendExecInput(sessionId, data),
  resizeExec: (sessionId: string, cols: number, rows: number): Promise<void> =>
    ResizeExec(sessionId, cols, rows),
  stopExec: (sessionId: string): Promise<void> => StopExec(sessionId),
  getDeployment: (ctx: string, ns: string, name: string): Promise<DeploymentDetail> =>
    GetDeployment(ctx, ns, name),
  getStatefulSet: (ctx: string, ns: string, name: string): Promise<StatefulSetDetail> =>
    GetStatefulSet(ctx, ns, name),
  getDaemonSet: (ctx: string, ns: string, name: string): Promise<DaemonSetDetail> =>
    GetDaemonSet(ctx, ns, name),
  getReplicaSet: (ctx: string, ns: string, name: string): Promise<ReplicaSetDetail> =>
    GetReplicaSet(ctx, ns, name),
  getPersistentVolumeClaim: (ctx: string, ns: string, name: string): Promise<PersistentVolumeClaimDetail> =>
    GetPersistentVolumeClaim(ctx, ns, name),
  getPersistentVolume: (ctx: string, name: string): Promise<PersistentVolumeDetail> =>
    GetPersistentVolume(ctx, name),
  getStorageClass: (ctx: string, name: string): Promise<StorageClassDetail> =>
    GetStorageClass(ctx, name),
  getNetworkPolicy: (ctx: string, ns: string, name: string): Promise<NetworkPolicyDetail> =>
    GetNetworkPolicy(ctx, ns, name),
  getHorizontalPodAutoscaler: (ctx: string, ns: string, name: string): Promise<HorizontalPodAutoscalerDetail> =>
    GetHorizontalPodAutoscaler(ctx, ns, name),
  getPodDisruptionBudget: (ctx: string, ns: string, name: string): Promise<PodDisruptionBudgetDetail> =>
    GetPodDisruptionBudget(ctx, ns, name),
  getEndpointSlice: (ctx: string, ns: string, name: string): Promise<EndpointSliceDetail> =>
    GetEndpointSlice(ctx, ns, name),
  getResourceQuota: (ctx: string, ns: string, name: string): Promise<ResourceQuotaDetail> =>
    GetResourceQuota(ctx, ns, name),
  getLimitRange: (ctx: string, ns: string, name: string): Promise<LimitRangeDetail> =>
    GetLimitRange(ctx, ns, name),
  getIngressClass: (ctx: string, name: string): Promise<IngressClassDetail> =>
    GetIngressClass(ctx, name),
  getPriorityClass: (ctx: string, name: string): Promise<PriorityClassDetail> =>
    GetPriorityClass(ctx, name),
  getRuntimeClass: (ctx: string, name: string): Promise<RuntimeClassDetail> =>
    GetRuntimeClass(ctx, name),
  getLease: (ctx: string, ns: string, name: string): Promise<LeaseDetail> =>
    GetLease(ctx, ns, name),
  getMutatingWebhookConfiguration: (ctx: string, name: string): Promise<WebhookConfigurationDetail> =>
    GetMutatingWebhookConfiguration(ctx, name),
  getValidatingWebhookConfiguration: (ctx: string, name: string): Promise<WebhookConfigurationDetail> =>
    GetValidatingWebhookConfiguration(ctx, name),
  getEndpoints: (ctx: string, ns: string, name: string): Promise<EndpointsDetail> =>
    GetEndpoints(ctx, ns, name),
  getReplicationController: (ctx: string, ns: string, name: string): Promise<ReplicationControllerDetail> =>
    GetReplicationController(ctx, ns, name),
  getJob: (ctx: string, ns: string, name: string): Promise<JobDetail> => GetJob(ctx, ns, name),
  getCronJob: (ctx: string, ns: string, name: string): Promise<CronJobDetail> =>
    GetCronJob(ctx, ns, name),
  getService: (ctx: string, ns: string, name: string): Promise<ServiceDetail> =>
    GetService(ctx, ns, name),
  getConfigMap: (ctx: string, ns: string, name: string): Promise<ConfigMapDetail> =>
    GetConfigMap(ctx, ns, name),
  getSecret: (ctx: string, ns: string, name: string): Promise<SecretDetail> =>
    GetSecret(ctx, ns, name),
  revealSecretValue: (ctx: string, ns: string, name: string, key: string): Promise<string> =>
    RevealSecretValue(ctx, ns, name, key),
  getIngress: (ctx: string, ns: string, name: string): Promise<IngressDetail> =>
    GetIngress(ctx, ns, name),
  getNode: (ctx: string, name: string): Promise<NodeDetail> => GetNode(ctx, name),
  getNamespace: (ctx: string, name: string): Promise<NamespaceDetail> => GetNamespace(ctx, name),
  getResourceYAML: (ctx: string, kind: string, ns: string, name: string): Promise<string> =>
    GetResourceYAML(ctx, kind, ns, name),
  applyResourceYAML: (ctx: string, yamlBody: string): Promise<void> =>
    ApplyResourceYAML(ctx, yamlBody),
  deleteResource: (ctx: string, kind: string, ns: string, name: string): Promise<void> =>
    DeleteResource(ctx, kind, ns, name),
  scaleResource: (ctx: string, kind: string, ns: string, name: string, replicas: number): Promise<void> =>
    ScaleResource(ctx, kind, ns, name, replicas),
  patchHPAReplicas: (
    ctx: string,
    ns: string,
    name: string,
    minReplicas: number,
    maxReplicas: number,
  ): Promise<void> => PatchHPAReplicas(ctx, ns, name, minReplicas, maxReplicas),
  patchDeploymentPaused: (ctx: string, ns: string, name: string, paused: boolean): Promise<void> =>
    PatchDeploymentPaused(ctx, ns, name, paused),
  restartWorkload: (ctx: string, kind: string, ns: string, name: string): Promise<void> =>
    RestartWorkload(ctx, kind, ns, name),
  startPortForward: (
    ctx: string,
    namespace: string,
    podName: string,
    localPort: number,
    remotePort: number,
  ): Promise<PortForwardInfo> => StartPortForward(ctx, namespace, podName, localPort, remotePort),
  stopPortForward: (id: string): Promise<void> => StopPortForward(id),
  listPortForwards: (): Promise<PortForwardInfo[]> => ListPortForwards(),
  saveTextFile: (defaultName: string, content: string): Promise<string> =>
    SaveTextFile(defaultName, content),
  podLogTargets: (
    contextName: string,
    namespace: string,
    selector: Record<string, string>,
  ): Promise<PodLogTarget[]> => PodLogTargets(contextName, namespace, selector),
  listEvents: (
    contextName: string,
    namespace: string,
    kind: string,
    name: string,
  ): Promise<EventInfo[]> => ListEvents(contextName, namespace, kind, name),
  listPodMetrics: (contextName: string, namespace: string): Promise<PodMetrics[]> =>
    ListPodMetrics(contextName, namespace),
  getClusterOverview: (contextName: string): Promise<ClusterOverview> =>
    GetClusterOverview(contextName),
  listClusterWarningEvents: (contextName: string, limit: number): Promise<EventInfo[]> =>
    ListClusterWarningEvents(contextName, limit),
  listHelmReleases: (contextName: string, namespace: string): Promise<HelmReleaseInfo[]> =>
    ListHelmReleases(contextName, namespace),
  getHelmRelease: (contextName: string, namespace: string, name: string): Promise<HelmReleaseDetail> =>
    GetHelmRelease(contextName, namespace, name),
  listHelmReleaseHistory: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<HelmRevisionInfo[]> => ListHelmReleaseHistory(contextName, namespace, name),
  installHelmRelease: (opts: HelmInstallOptions): Promise<HelmDryRunResult> =>
    InstallHelmRelease(opts),
  upgradeHelmRelease: (opts: HelmInstallOptions): Promise<HelmDryRunResult> =>
    UpgradeHelmRelease(opts),
  rollbackHelmRelease: (
    contextName: string,
    namespace: string,
    name: string,
    revision: number,
    wait: boolean,
  ): Promise<void> => RollbackHelmRelease(contextName, namespace, name, revision, wait),
  uninstallHelmRelease: (
    contextName: string,
    namespace: string,
    name: string,
    keepHistory: boolean,
  ): Promise<void> => UninstallHelmRelease(contextName, namespace, name, keepHistory),
  listHelmRepos: (): Promise<HelmRepoInfo[]> => ListHelmRepos(),
  addHelmRepo: (name: string, url: string): Promise<void> => AddHelmRepo(name, url),
  removeHelmRepo: (name: string): Promise<void> => RemoveHelmRepo(name),
  updateHelmRepos: (): Promise<void> => UpdateHelmRepos(),
  searchHelmCharts: (query: string): Promise<HelmChartSearchResult[]> => SearchHelmCharts(query),
  helmChartVersions: (repoName: string, chartName: string): Promise<string[]> =>
    HelmChartVersions(repoName, chartName),
  listCRDs: (contextName: string): Promise<CRDInfo[]> => ListCRDs(contextName),
  ensureCustomResourceWatch: (
    contextName: string,
    group: string,
    version: string,
    resource: string,
  ): Promise<void> => EnsureCustomResourceWatch(contextName, group, version, resource),
  listCustomResources: (
    contextName: string,
    group: string,
    version: string,
    resource: string,
    namespace: string,
  ): Promise<CustomResourceInfo[]> =>
    ListCustomResources(contextName, group, version, resource, namespace),
  getCustomResourceYAML: (
    contextName: string,
    group: string,
    version: string,
    resource: string,
    namespace: string,
    name: string,
  ): Promise<string> =>
    GetCustomResourceYAML(contextName, group, version, resource, namespace, name),
  syncArgoApplication: (
    contextName: string,
    namespace: string,
    name: string,
    revision: string,
    prune: boolean,
  ): Promise<void> => SyncArgoApplication(contextName, namespace, name, revision, prune),
  refreshArgoApplication: (
    contextName: string,
    namespace: string,
    name: string,
    mode: string,
  ): Promise<void> => RefreshArgoApplication(contextName, namespace, name, mode),
  listArgoApplicationResources: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<ArgoApplicationResource[]> =>
    ListArgoApplicationResources(contextName, namespace, name),
  listArgoApplications: (
    contextName: string,
    namespace: string,
  ): Promise<ArgoApplicationInfo[]> => ListArgoApplications(contextName, namespace),
  version: (): Promise<string> => Version(),
}
