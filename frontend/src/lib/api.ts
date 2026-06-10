import {
  AddHelmRepo,
  ApplyResourceYAML,
  DryRunApplyResourceYAML,
  FetchMetricsServerManifest,
  IsMetricsServerKlustrManaged,
  RecommendInsecureKubeletTLS,
  DeleteResource,
  EnsureCustomResourceWatch,
  GetCustomResourceYAML,
  SyncArgoApplication,
  RefreshArgoApplication,
  DeleteArgoApplication,
  SetArgoApplicationAutomation,
  ListArgoApplicationHistory,
  RollbackArgoApplication,
  GetArgoApplicationOperationState,
  ListArgoApplicationResources,
  ListArgoApplications,
  ListArgoAppProjects,
  GetArgoAppProject,
  ListArgoApplicationSets,
  GetArgoApplicationSet,
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
  ListNodeMetrics,
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
  StartNodeShell,
  CordonNode,
  DrainNode,
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
  ListCSIDrivers,
  GetCSIDriver,
  ListCSINodes,
  GetCSINode,
  ListVolumeAttachments,
  GetVolumeAttachment,
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
  ListValidatingAdmissionPolicies,
  GetValidatingAdmissionPolicy,
  ListValidatingAdmissionPolicyBindings,
  GetValidatingAdmissionPolicyBinding,
  ListMutatingAdmissionPolicies,
  GetMutatingAdmissionPolicy,
  ListMutatingAdmissionPolicyBindings,
  GetMutatingAdmissionPolicyBinding,
  ListDeviceClasses,
  GetDeviceClass,
  ListResourceSlices,
  GetResourceSlice,
  ListResourceClaims,
  GetResourceClaim,
  ListResourceClaimTemplates,
  GetResourceClaimTemplate,
  ListServiceCIDRs,
  GetServiceCIDR,
  ListIPAddresses,
  GetIPAddress,
  ListAPIServices,
  GetAPIService,
  ListFlowSchemas,
  GetFlowSchema,
  ListPriorityLevelConfigurations,
  GetPriorityLevelConfiguration,
  ListEndpoints,
  ListReplicationControllers,
  ListDeployments,
  ListGateways,
  GetGateway,
  ListHTTPRoutes,
  GetHTTPRoute,
  ListGRPCRoutes,
  GetGRPCRoute,
  ListGatewayClasses,
  GetGatewayClass,
  ListReferenceGrants,
  GetReferenceGrant,
  ListIngresses,
  ListJobs,
  ListKarpenterNodePools,
  ListKarpenterNodeClaims,
  ListIstioVirtualServices,
  GetIstioVirtualService,
  ListIstioDestinationRules,
  GetIstioDestinationRule,
  ListIstioPeerAuthentications,
  GetIstioPeerAuthentication,
  ListFluxKustomizations,
  GetFluxKustomization,
  ListFluxHelmReleases,
  GetFluxHelmRelease,
  ListFluxGitRepositories,
  GetFluxGitRepository,
  ListFluxHelmRepositories,
  GetFluxHelmRepository,
  ListFluxOCIRepositories,
  GetFluxOCIRepository,
  ListFluxBuckets,
  GetFluxBucket,
  ListFluxProviders,
  GetFluxProvider,
  ListFluxAlerts,
  GetFluxAlert,
  ListFluxReceivers,
  GetFluxReceiver,
  ReconcileFluxResource,
  SetFluxResourceSuspended,
  ListCertManagerCertificates,
  GetCertManagerCertificate,
  ListCertManagerIssuers,
  GetCertManagerIssuer,
  ListCertManagerClusterIssuers,
  GetCertManagerClusterIssuer,
  RenewCertificate,
  ListCertManagerCertificateRequests,
  GetCertManagerCertificateRequest,
  CertManagerCertificateRequestsFor,
  ListCertManagerOrders,
  GetCertManagerOrder,
  CertManagerOrdersFor,
  ListCertManagerChallenges,
  GetCertManagerChallenge,
  CertManagerChallengesFor,
  ListNamespaces,
  ListNodes,
  ListNodePoolNodes,
  ListNodeClaimNode,
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
  ListCertificateSigningRequests,
  GetCertificateSigningRequest,
  ApproveCertificateSigningRequest,
  DenyCertificateSigningRequest,
  ListAccessSubjects,
  GetSubjectAccess,
  ListAccessibleKinds,
  ListPods,
  PodsForOwner,
  ListSecrets,
  ListServices,
  ListStatefulSets,
  PingContext,
  ResizeExec,
  ListDeploymentRevisions,
  ListStatefulSetRevisions,
  ListDaemonSetRevisions,
  RollbackDeployment,
  RollbackStatefulSet,
  RollbackDaemonSet,
  GetWorkloadRevisionTemplate,
  PatchDeploymentPaused,
  PatchHPAReplicas,
  ResizePodResources,
  RestartWorkload,
  ScaleResource,
  SendExecInput,
  StartExec,
  StartPodLogs,
  StartWatch,
  StopExec,
  StopPodLogs,
  StopWatch,
  SetReadOnly,
  OpenLocalTerminal,
  SendLocalTerminalInput,
  ResizeLocalTerminal,
  StopLocalTerminal,
  OpenInSystemTerminal,
  OpenPodExecInSystemTerminal,
  ListSystemTerminals,
  Version,
  CheckForUpdate,
} from '@/lib/wails/wailsjs/go/app/App'
import { kube, update } from '@/lib/wails/wailsjs/go/models'

export type ContextInfo = kube.ContextInfo
export type UpdateResult = update.Result
export type SystemTerminal = kube.SystemTerminal
export type Kubeconfig = kube.Kubeconfig
export type ServerVersion = kube.ServerVersion
export type NamespaceInfo = kube.NamespaceInfo
export type PodInfo = kube.PodInfo
export type PodContainerBrief = kube.PodContainerBrief
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
export type APIServiceInfo = kube.APIServiceInfo
export type APIServiceDetail = kube.APIServiceDetail
export type FlowSchemaInfo = kube.FlowSchemaInfo
export type FlowSchemaDetail = kube.FlowSchemaDetail
export type FlowSchemaRuleDetail = kube.FlowSchemaRuleDetail
export type PriorityLevelConfigurationInfo = kube.PriorityLevelConfigurationInfo
export type PriorityLevelConfigurationDetail = kube.PriorityLevelConfigurationDetail
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
export type CertificateSigningRequestInfo = kube.CertificateSigningRequestInfo
export type CertificateSigningRequestDetail = kube.CertificateSigningRequestDetail
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
export type CSIDriverInfo = kube.CSIDriverInfo
export type CSIDriverDetail = kube.CSIDriverDetail
export type CSINodeInfo = kube.CSINodeInfo
export type CSINodeDetail = kube.CSINodeDetail
export type CSINodeDriverDetail = kube.CSINodeDriverDetail
export type VolumeAttachmentInfo = kube.VolumeAttachmentInfo
export type VolumeAttachmentDetail = kube.VolumeAttachmentDetail
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
export type AdmissionPolicyInfo = kube.AdmissionPolicyInfo
export type AdmissionPolicyDetail = kube.AdmissionPolicyDetail
export type AdmissionPolicyBindingInfo = kube.AdmissionPolicyBindingInfo
export type AdmissionPolicyBindingDetail = kube.AdmissionPolicyBindingDetail
export type AdmissionPolicyValidation = kube.AdmissionPolicyValidation
export type AdmissionPolicyMutation = kube.AdmissionPolicyMutation
export type AdmissionPolicyMatchCondition = kube.AdmissionPolicyMatchCondition
export type AdmissionPolicyVariable = kube.AdmissionPolicyVariable
export type AdmissionPolicyAuditAnnotation = kube.AdmissionPolicyAuditAnnotation
export type DeviceClassInfo = kube.DeviceClassInfo
export type DeviceClassDetail = kube.DeviceClassDetail
export type DeviceSelectorDetail = kube.DeviceSelectorDetail
export type ResourceSliceInfo = kube.ResourceSliceInfo
export type ResourceSliceDetail = kube.ResourceSliceDetail
export type ResourceSliceDeviceDetail = kube.ResourceSliceDeviceDetail
export type ResourceClaimInfo = kube.ResourceClaimInfo
export type ResourceClaimDetail = kube.ResourceClaimDetail
export type ResourceClaimTemplateInfo = kube.ResourceClaimTemplateInfo
export type ResourceClaimTemplateDetail = kube.ResourceClaimTemplateDetail
export type DeviceRequestDetail = kube.DeviceRequestDetail
export type AllocatedDeviceDetail = kube.AllocatedDeviceDetail
export type ServiceCIDRInfo = kube.ServiceCIDRInfo
export type ServiceCIDRDetail = kube.ServiceCIDRDetail
export type IPAddressInfo = kube.IPAddressInfo
export type IPAddressDetail = kube.IPAddressDetail
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

// Mirrors kube.NodeDrainProgress, which only travels over the
// "node:drain:<context>/<node>" Wails event and so never lands in models.ts.
export type NodeDrainProgress = {
  node: string
  phase: 'cordoning' | 'evicting' | 'waiting' | 'done' | 'error'
  total: number
  evicted: number
  pending: string[]
  error: string
}
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
export type AccessSubject = kube.AccessSubject
export type SubjectAccess = kube.SubjectAccess
export type SubjectAccessRule = kube.SubjectAccessRule
export type PortForwardInfo = kube.PortForwardInfo
export type PodLogTarget = kube.PodLogTarget
export type EventInfo = kube.EventInfo
export type PodMetrics = kube.PodMetrics
export type NodeMetrics = kube.NodeMetrics
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
export type MutationDiff = kube.MutationDiff
export type ArgoApplicationResource = kube.ArgoApplicationResource
export type ArgoApplicationInfo = kube.ArgoApplicationInfo
export type ArgoApplicationHistoryEntry = kube.ArgoApplicationHistoryEntry
export type ArgoAppProjectInfo = kube.ArgoAppProjectInfo
export type ArgoAppProjectDetail = kube.ArgoAppProjectDetail
export type ArgoAppProjectDestination = kube.ArgoAppProjectDestination
export type ArgoAppProjectGroupKind = kube.ArgoAppProjectGroupKind
export type ArgoAppProjectRole = kube.ArgoAppProjectRole
export type ArgoAppProjectSyncWindow = kube.ArgoAppProjectSyncWindow
export type ArgoApplicationSetInfo = kube.ArgoApplicationSetInfo
export type ArgoApplicationSetDetail = kube.ArgoApplicationSetDetail
export type ArgoApplicationSetGenerator = kube.ArgoApplicationSetGenerator
export type ArgoApplicationSetGeneratedApp = kube.ArgoApplicationSetGeneratedApp
export type ArgoCascadeMode = 'foreground' | 'background' | 'non-cascading'
export type ArgoSyncOptions = kube.ArgoSyncOptions
export type ArgoSyncResourceSelector = kube.ArgoSyncResourceSelector
export type ArgoSyncStrategy = 'hook' | 'apply'
export type ArgoOperationState = kube.ArgoOperationState
export type ArgoSyncResultResource = kube.ArgoSyncResultResource
export type WorkloadRevision = kube.WorkloadRevision
export type GatewayInfo = kube.GatewayInfo
export type GatewayDetail = kube.GatewayDetail
export type ListenerDetail = kube.ListenerDetail
export type HTTPRouteInfo = kube.HTTPRouteInfo
export type HTTPRouteDetail = kube.HTTPRouteDetail
export type HTTPRouteRuleDetail = kube.HTTPRouteRuleDetail
export type HTTPRouteMatchDetail = kube.HTTPRouteMatchDetail
export type GRPCRouteInfo = kube.GRPCRouteInfo
export type GRPCRouteDetail = kube.GRPCRouteDetail
export type GRPCRouteRuleDetail = kube.GRPCRouteRuleDetail
export type GRPCRouteMatchDetail = kube.GRPCRouteMatchDetail
export type GatewayClassInfo = kube.GatewayClassInfo
export type GatewayClassDetail = kube.GatewayClassDetail
export type ParentRefDetail = kube.ParentRefDetail
export type BackendRefDetail = kube.BackendRefDetail
export type RouteParentStatusDetail = kube.RouteParentStatusDetail
export type ReferenceGrantInfo = kube.ReferenceGrantInfo
export type ReferenceGrantDetail = kube.ReferenceGrantDetail
export type ReferenceGrantFromDetail = kube.ReferenceGrantFromDetail
export type ReferenceGrantToDetail = kube.ReferenceGrantToDetail
export type KarpenterNodePoolInfo = kube.KarpenterNodePoolInfo
export type KarpenterNodeClaimInfo = kube.KarpenterNodeClaimInfo
export type FluxCondition = kube.FluxCondition
export type FluxKustomizationInfo = kube.FluxKustomizationInfo
export type FluxKustomizationDetail = kube.FluxKustomizationDetail
export type FluxHelmReleaseInfo = kube.FluxHelmReleaseInfo
export type FluxHelmReleaseDetail = kube.FluxHelmReleaseDetail
export type FluxGitRepositoryInfo = kube.FluxGitRepositoryInfo
export type FluxGitRepositoryDetail = kube.FluxGitRepositoryDetail
export type FluxHelmRepositoryInfo = kube.FluxHelmRepositoryInfo
export type FluxHelmRepositoryDetail = kube.FluxHelmRepositoryDetail
export type FluxOCIRepositoryInfo = kube.FluxOCIRepositoryInfo
export type FluxOCIRepositoryDetail = kube.FluxOCIRepositoryDetail
export type FluxBucketInfo = kube.FluxBucketInfo
export type FluxBucketDetail = kube.FluxBucketDetail
export type FluxProviderInfo = kube.FluxProviderInfo
export type FluxProviderDetail = kube.FluxProviderDetail
export type FluxAlertInfo = kube.FluxAlertInfo
export type FluxAlertDetail = kube.FluxAlertDetail
export type FluxAlertSource = kube.FluxAlertSource
export type FluxReceiverInfo = kube.FluxReceiverInfo
export type FluxReceiverDetail = kube.FluxReceiverDetail
export type CertManagerCondition = kube.CertManagerCondition
export type CertManagerCertificateInfo = kube.CertManagerCertificateInfo
export type CertManagerCertificateDetail = kube.CertManagerCertificateDetail
export type CertManagerIssuerInfo = kube.CertManagerIssuerInfo
export type CertManagerIssuerDetail = kube.CertManagerIssuerDetail
export type CertManagerCertificateRequestInfo = kube.CertManagerCertificateRequestInfo
export type CertManagerCertificateRequestDetail = kube.CertManagerCertificateRequestDetail
export type CertManagerOrderInfo = kube.CertManagerOrderInfo
export type CertManagerOrderDetail = kube.CertManagerOrderDetail
export type CertManagerChallengeInfo = kube.CertManagerChallengeInfo
export type CertManagerChallengeDetail = kube.CertManagerChallengeDetail
export type IstioVirtualServiceInfo = kube.IstioVirtualServiceInfo
export type IstioVirtualServiceDetail = kube.IstioVirtualServiceDetail
export type IstioDestinationRuleInfo = kube.IstioDestinationRuleInfo
export type IstioDestinationRuleDetail = kube.IstioDestinationRuleDetail
export type IstioPeerAuthenticationInfo = kube.IstioPeerAuthenticationInfo
export type IstioPeerAuthenticationDetail = kube.IstioPeerAuthenticationDetail
export type IstioRouteRule = kube.IstioRouteRule
export type IstioDestinationWeight = kube.IstioDestinationWeight
export type IstioSubset = kube.IstioSubset
export type IstioPortMTLS = kube.IstioPortMTLS
export type FluxKind =
  | 'FluxKustomization'
  | 'FluxHelmRelease'
  | 'FluxGitRepository'
  | 'FluxHelmRepository'
  | 'FluxOCIRepository'
  | 'FluxBucket'
  | 'FluxProvider'
  | 'FluxAlert'
  | 'FluxReceiver'

export const api = {
  listContexts: (): Promise<Kubeconfig> => ListContexts(),
  pingContext: (name: string): Promise<ServerVersion> => PingContext(name),
  startWatch: (name: string): Promise<void> => StartWatch(name),
  stopWatch: (name: string): Promise<void> => StopWatch(name),
  setReadOnly: (contextName: string, readOnly: boolean): Promise<void> =>
    SetReadOnly(contextName, readOnly),
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
  listCSIDrivers: (name: string): Promise<CSIDriverInfo[]> => ListCSIDrivers(name),
  getCSIDriver: (ctx: string, name: string): Promise<CSIDriverDetail> => GetCSIDriver(ctx, name),
  listCSINodes: (name: string): Promise<CSINodeInfo[]> => ListCSINodes(name),
  getCSINode: (ctx: string, name: string): Promise<CSINodeDetail> => GetCSINode(ctx, name),
  listVolumeAttachments: (name: string): Promise<VolumeAttachmentInfo[]> =>
    ListVolumeAttachments(name),
  getVolumeAttachment: (ctx: string, name: string): Promise<VolumeAttachmentDetail> =>
    GetVolumeAttachment(ctx, name),
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
  listValidatingAdmissionPolicies: (name: string): Promise<AdmissionPolicyInfo[]> =>
    ListValidatingAdmissionPolicies(name),
  getValidatingAdmissionPolicy: (ctx: string, name: string): Promise<AdmissionPolicyDetail> =>
    GetValidatingAdmissionPolicy(ctx, name),
  listValidatingAdmissionPolicyBindings: (name: string): Promise<AdmissionPolicyBindingInfo[]> =>
    ListValidatingAdmissionPolicyBindings(name),
  getValidatingAdmissionPolicyBinding: (
    ctx: string,
    name: string,
  ): Promise<AdmissionPolicyBindingDetail> => GetValidatingAdmissionPolicyBinding(ctx, name),
  listMutatingAdmissionPolicies: (name: string): Promise<AdmissionPolicyInfo[]> =>
    ListMutatingAdmissionPolicies(name),
  getMutatingAdmissionPolicy: (ctx: string, name: string): Promise<AdmissionPolicyDetail> =>
    GetMutatingAdmissionPolicy(ctx, name),
  listMutatingAdmissionPolicyBindings: (name: string): Promise<AdmissionPolicyBindingInfo[]> =>
    ListMutatingAdmissionPolicyBindings(name),
  getMutatingAdmissionPolicyBinding: (
    ctx: string,
    name: string,
  ): Promise<AdmissionPolicyBindingDetail> => GetMutatingAdmissionPolicyBinding(ctx, name),
  listDeviceClasses: (name: string): Promise<DeviceClassInfo[]> => ListDeviceClasses(name),
  getDeviceClass: (ctx: string, name: string): Promise<DeviceClassDetail> =>
    GetDeviceClass(ctx, name),
  listResourceSlices: (name: string): Promise<ResourceSliceInfo[]> => ListResourceSlices(name),
  getResourceSlice: (ctx: string, name: string): Promise<ResourceSliceDetail> =>
    GetResourceSlice(ctx, name),
  listResourceClaims: (name: string, namespace: string): Promise<ResourceClaimInfo[]> =>
    ListResourceClaims(name, namespace),
  getResourceClaim: (ctx: string, ns: string, name: string): Promise<ResourceClaimDetail> =>
    GetResourceClaim(ctx, ns, name),
  listResourceClaimTemplates: (
    name: string,
    namespace: string,
  ): Promise<ResourceClaimTemplateInfo[]> => ListResourceClaimTemplates(name, namespace),
  getResourceClaimTemplate: (
    ctx: string,
    ns: string,
    name: string,
  ): Promise<ResourceClaimTemplateDetail> => GetResourceClaimTemplate(ctx, ns, name),
  listServiceCIDRs: (name: string): Promise<ServiceCIDRInfo[]> => ListServiceCIDRs(name),
  getServiceCIDR: (ctx: string, name: string): Promise<ServiceCIDRDetail> =>
    GetServiceCIDR(ctx, name),
  listIPAddresses: (name: string): Promise<IPAddressInfo[]> => ListIPAddresses(name),
  getIPAddress: (ctx: string, name: string): Promise<IPAddressDetail> => GetIPAddress(ctx, name),
  listAPIServices: (name: string): Promise<APIServiceInfo[]> => ListAPIServices(name),
  getAPIService: (ctx: string, name: string): Promise<APIServiceDetail> => GetAPIService(ctx, name),
  listFlowSchemas: (name: string): Promise<FlowSchemaInfo[]> => ListFlowSchemas(name),
  getFlowSchema: (ctx: string, name: string): Promise<FlowSchemaDetail> =>
    GetFlowSchema(ctx, name),
  listPriorityLevelConfigurations: (name: string): Promise<PriorityLevelConfigurationInfo[]> =>
    ListPriorityLevelConfigurations(name),
  getPriorityLevelConfiguration: (
    ctx: string,
    name: string,
  ): Promise<PriorityLevelConfigurationDetail> => GetPriorityLevelConfiguration(ctx, name),
  listEndpoints: (name: string, namespace: string): Promise<EndpointsInfo[]> =>
    ListEndpoints(name, namespace),
  listReplicationControllers: (name: string, namespace: string): Promise<ReplicationControllerInfo[]> =>
    ListReplicationControllers(name, namespace),
  listJobs: (name: string, namespace: string): Promise<JobInfo[]> => ListJobs(name, namespace),
  listCronJobs: (name: string, namespace: string): Promise<CronJobInfo[]> =>
    ListCronJobs(name, namespace),
  listIngresses: (name: string, namespace: string): Promise<IngressInfo[]> =>
    ListIngresses(name, namespace),
  listGateways: (name: string, namespace: string): Promise<GatewayInfo[]> =>
    ListGateways(name, namespace),
  getGateway: (ctx: string, ns: string, name: string): Promise<GatewayDetail> =>
    GetGateway(ctx, ns, name),
  listHTTPRoutes: (name: string, namespace: string): Promise<HTTPRouteInfo[]> =>
    ListHTTPRoutes(name, namespace),
  getHTTPRoute: (ctx: string, ns: string, name: string): Promise<HTTPRouteDetail> =>
    GetHTTPRoute(ctx, ns, name),
  listGRPCRoutes: (name: string, namespace: string): Promise<GRPCRouteInfo[]> =>
    ListGRPCRoutes(name, namespace),
  getGRPCRoute: (ctx: string, ns: string, name: string): Promise<GRPCRouteDetail> =>
    GetGRPCRoute(ctx, ns, name),
  listGatewayClasses: (name: string): Promise<GatewayClassInfo[]> => ListGatewayClasses(name),
  getGatewayClass: (ctx: string, name: string): Promise<GatewayClassDetail> =>
    GetGatewayClass(ctx, name),
  listReferenceGrants: (name: string, namespace: string): Promise<ReferenceGrantInfo[]> =>
    ListReferenceGrants(name, namespace),
  getReferenceGrant: (ctx: string, ns: string, name: string): Promise<ReferenceGrantDetail> =>
    GetReferenceGrant(ctx, ns, name),
  listNodes: (name: string): Promise<NodeInfo[]> => ListNodes(name),
  listNodePoolNodes: (contextName: string, nodePoolName: string): Promise<NodeInfo[]> =>
    ListNodePoolNodes(contextName, nodePoolName),
  listNodeClaimNode: (contextName: string, nodeClaimName: string): Promise<NodeInfo[]> =>
    ListNodeClaimNode(contextName, nodeClaimName),
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
  listCertificateSigningRequests: (name: string): Promise<CertificateSigningRequestInfo[]> =>
    ListCertificateSigningRequests(name),
  getCertificateSigningRequest: (
    ctx: string,
    name: string,
  ): Promise<CertificateSigningRequestDetail> => GetCertificateSigningRequest(ctx, name),
  approveCertificateSigningRequest: (ctx: string, name: string, message: string): Promise<void> =>
    ApproveCertificateSigningRequest(ctx, name, message),
  denyCertificateSigningRequest: (ctx: string, name: string, message: string): Promise<void> =>
    DenyCertificateSigningRequest(ctx, name, message),
  listAccessSubjects: (ctx: string): Promise<AccessSubject[]> => ListAccessSubjects(ctx),
  getSubjectAccess: (
    ctx: string,
    kind: string,
    namespace: string,
    name: string,
  ): Promise<SubjectAccess> => GetSubjectAccess(ctx, kind, namespace, name),
  listAccessibleKinds: (ctx: string): Promise<string[]> => ListAccessibleKinds(ctx),
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
  startNodeShell: (contextName: string, nodeName: string): Promise<string> =>
    StartNodeShell(contextName, nodeName),
  cordonNode: (ctx: string, nodeName: string, cordon: boolean): Promise<void> =>
    CordonNode(ctx, nodeName, cordon),
  drainNode: (ctx: string, nodeName: string): Promise<void> => DrainNode(ctx, nodeName),
  openLocalTerminal: (contextName: string, cols: number, rows: number): Promise<string> =>
    OpenLocalTerminal(contextName, cols, rows),
  sendLocalTerminalInput: (sessionId: string, data: string): Promise<void> =>
    SendLocalTerminalInput(sessionId, data),
  resizeLocalTerminal: (sessionId: string, cols: number, rows: number): Promise<void> =>
    ResizeLocalTerminal(sessionId, cols, rows),
  stopLocalTerminal: (sessionId: string): Promise<void> => StopLocalTerminal(sessionId),
  openInSystemTerminal: (contextName: string, appID: string): Promise<void> =>
    OpenInSystemTerminal(contextName, appID),
  openPodExecInSystemTerminal: (
    contextName: string,
    namespace: string,
    podName: string,
    container: string,
    shellPath: string,
    appID: string,
  ): Promise<void> =>
    OpenPodExecInSystemTerminal(contextName, namespace, podName, container, shellPath, appID),
  listSystemTerminals: (): Promise<SystemTerminal[]> => ListSystemTerminals(),
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
  dryRunApplyResourceYAML: (ctx: string, yamlBody: string): Promise<MutationDiff> =>
    DryRunApplyResourceYAML(ctx, yamlBody),
  fetchMetricsServerManifest: (): Promise<string> => FetchMetricsServerManifest(),
  recommendInsecureKubeletTLS: (ctx: string): Promise<boolean> =>
    RecommendInsecureKubeletTLS(ctx),
  isMetricsServerKlustrManaged: (ctx: string): Promise<boolean> =>
    IsMetricsServerKlustrManaged(ctx),
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
  resizePodResources: (
    ctx: string,
    ns: string,
    podName: string,
    container: string,
    cpuRequest: string,
    cpuLimit: string,
    memRequest: string,
    memLimit: string,
  ): Promise<void> =>
    ResizePodResources(ctx, ns, podName, container, cpuRequest, cpuLimit, memRequest, memLimit),
  patchDeploymentPaused: (ctx: string, ns: string, name: string, paused: boolean): Promise<void> =>
    PatchDeploymentPaused(ctx, ns, name, paused),
  listDeploymentRevisions: (ctx: string, ns: string, name: string): Promise<WorkloadRevision[]> =>
    ListDeploymentRevisions(ctx, ns, name),
  listStatefulSetRevisions: (ctx: string, ns: string, name: string): Promise<WorkloadRevision[]> =>
    ListStatefulSetRevisions(ctx, ns, name),
  listDaemonSetRevisions: (ctx: string, ns: string, name: string): Promise<WorkloadRevision[]> =>
    ListDaemonSetRevisions(ctx, ns, name),
  rollbackDeployment: (ctx: string, ns: string, name: string, toRevision: number): Promise<void> =>
    RollbackDeployment(ctx, ns, name, toRevision),
  rollbackStatefulSet: (ctx: string, ns: string, name: string, toRevision: number): Promise<void> =>
    RollbackStatefulSet(ctx, ns, name, toRevision),
  rollbackDaemonSet: (ctx: string, ns: string, name: string, toRevision: number): Promise<void> =>
    RollbackDaemonSet(ctx, ns, name, toRevision),
  getWorkloadRevisionTemplate: (
    ctx: string,
    kind: string,
    ns: string,
    name: string,
    revision: number,
  ): Promise<string> => GetWorkloadRevisionTemplate(ctx, kind, ns, name, revision),
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
  listNodeMetrics: (contextName: string): Promise<NodeMetrics[]> => ListNodeMetrics(contextName),
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
  listIstioVirtualServices: (
    contextName: string,
    namespace: string,
  ): Promise<IstioVirtualServiceInfo[]> => ListIstioVirtualServices(contextName, namespace),
  getIstioVirtualService: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<IstioVirtualServiceDetail> => GetIstioVirtualService(contextName, namespace, name),
  listIstioDestinationRules: (
    contextName: string,
    namespace: string,
  ): Promise<IstioDestinationRuleInfo[]> => ListIstioDestinationRules(contextName, namespace),
  getIstioDestinationRule: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<IstioDestinationRuleDetail> => GetIstioDestinationRule(contextName, namespace, name),
  listIstioPeerAuthentications: (
    contextName: string,
    namespace: string,
  ): Promise<IstioPeerAuthenticationInfo[]> => ListIstioPeerAuthentications(contextName, namespace),
  getIstioPeerAuthentication: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<IstioPeerAuthenticationDetail> => GetIstioPeerAuthentication(contextName, namespace, name),
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
    opts: ArgoSyncOptions,
  ): Promise<void> => SyncArgoApplication(contextName, namespace, name, opts),
  refreshArgoApplication: (
    contextName: string,
    namespace: string,
    name: string,
    mode: string,
  ): Promise<void> => RefreshArgoApplication(contextName, namespace, name, mode),
  deleteArgoApplication: (
    contextName: string,
    namespace: string,
    name: string,
    cascade: ArgoCascadeMode,
  ): Promise<void> => DeleteArgoApplication(contextName, namespace, name, cascade),
  setArgoApplicationAutomation: (
    contextName: string,
    namespace: string,
    name: string,
    enabled: boolean,
  ): Promise<void> => SetArgoApplicationAutomation(contextName, namespace, name, enabled),
  listArgoApplicationHistory: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<ArgoApplicationHistoryEntry[]> =>
    ListArgoApplicationHistory(contextName, namespace, name),
  rollbackArgoApplication: (
    contextName: string,
    namespace: string,
    name: string,
    id: number,
    prune: boolean,
  ): Promise<void> => RollbackArgoApplication(contextName, namespace, name, id, prune),
  getArgoApplicationOperationState: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<ArgoOperationState> =>
    GetArgoApplicationOperationState(contextName, namespace, name),
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
  listArgoAppProjects: (
    contextName: string,
    namespace: string,
  ): Promise<ArgoAppProjectInfo[]> => ListArgoAppProjects(contextName, namespace),
  getArgoAppProject: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<ArgoAppProjectDetail> => GetArgoAppProject(contextName, namespace, name),
  listArgoApplicationSets: (
    contextName: string,
    namespace: string,
  ): Promise<ArgoApplicationSetInfo[]> => ListArgoApplicationSets(contextName, namespace),
  getArgoApplicationSet: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<ArgoApplicationSetDetail> => GetArgoApplicationSet(contextName, namespace, name),
  listKarpenterNodePools: (contextName: string): Promise<KarpenterNodePoolInfo[]> =>
    ListKarpenterNodePools(contextName),
  listKarpenterNodeClaims: (contextName: string): Promise<KarpenterNodeClaimInfo[]> =>
    ListKarpenterNodeClaims(contextName),
  listFluxKustomizations: (
    contextName: string,
    namespace: string,
  ): Promise<FluxKustomizationInfo[]> => ListFluxKustomizations(contextName, namespace),
  getFluxKustomization: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<FluxKustomizationDetail> => GetFluxKustomization(contextName, namespace, name),
  listFluxHelmReleases: (
    contextName: string,
    namespace: string,
  ): Promise<FluxHelmReleaseInfo[]> => ListFluxHelmReleases(contextName, namespace),
  getFluxHelmRelease: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<FluxHelmReleaseDetail> => GetFluxHelmRelease(contextName, namespace, name),
  listFluxGitRepositories: (
    contextName: string,
    namespace: string,
  ): Promise<FluxGitRepositoryInfo[]> => ListFluxGitRepositories(contextName, namespace),
  getFluxGitRepository: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<FluxGitRepositoryDetail> => GetFluxGitRepository(contextName, namespace, name),
  listFluxHelmRepositories: (
    contextName: string,
    namespace: string,
  ): Promise<FluxHelmRepositoryInfo[]> => ListFluxHelmRepositories(contextName, namespace),
  getFluxHelmRepository: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<FluxHelmRepositoryDetail> => GetFluxHelmRepository(contextName, namespace, name),
  listFluxOCIRepositories: (
    contextName: string,
    namespace: string,
  ): Promise<FluxOCIRepositoryInfo[]> => ListFluxOCIRepositories(contextName, namespace),
  getFluxOCIRepository: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<FluxOCIRepositoryDetail> => GetFluxOCIRepository(contextName, namespace, name),
  listFluxBuckets: (
    contextName: string,
    namespace: string,
  ): Promise<FluxBucketInfo[]> => ListFluxBuckets(contextName, namespace),
  getFluxBucket: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<FluxBucketDetail> => GetFluxBucket(contextName, namespace, name),
  listFluxProviders: (
    contextName: string,
    namespace: string,
  ): Promise<FluxProviderInfo[]> => ListFluxProviders(contextName, namespace),
  getFluxProvider: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<FluxProviderDetail> => GetFluxProvider(contextName, namespace, name),
  listFluxAlerts: (contextName: string, namespace: string): Promise<FluxAlertInfo[]> =>
    ListFluxAlerts(contextName, namespace),
  getFluxAlert: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<FluxAlertDetail> => GetFluxAlert(contextName, namespace, name),
  listFluxReceivers: (
    contextName: string,
    namespace: string,
  ): Promise<FluxReceiverInfo[]> => ListFluxReceivers(contextName, namespace),
  getFluxReceiver: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<FluxReceiverDetail> => GetFluxReceiver(contextName, namespace, name),
  reconcileFluxResource: (
    contextName: string,
    kind: FluxKind,
    namespace: string,
    name: string,
  ): Promise<void> => ReconcileFluxResource(contextName, kind, namespace, name),
  setFluxResourceSuspended: (
    contextName: string,
    kind: FluxKind,
    namespace: string,
    name: string,
    suspended: boolean,
  ): Promise<void> => SetFluxResourceSuspended(contextName, kind, namespace, name, suspended),
  listCertManagerCertificates: (
    contextName: string,
    namespace: string,
  ): Promise<CertManagerCertificateInfo[]> =>
    ListCertManagerCertificates(contextName, namespace),
  getCertManagerCertificate: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<CertManagerCertificateDetail> =>
    GetCertManagerCertificate(contextName, namespace, name),
  listCertManagerIssuers: (
    contextName: string,
    namespace: string,
  ): Promise<CertManagerIssuerInfo[]> => ListCertManagerIssuers(contextName, namespace),
  getCertManagerIssuer: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<CertManagerIssuerDetail> => GetCertManagerIssuer(contextName, namespace, name),
  listCertManagerClusterIssuers: (
    contextName: string,
  ): Promise<CertManagerIssuerInfo[]> => ListCertManagerClusterIssuers(contextName),
  getCertManagerClusterIssuer: (
    contextName: string,
    name: string,
  ): Promise<CertManagerIssuerDetail> => GetCertManagerClusterIssuer(contextName, name),
  renewCertificate: (contextName: string, namespace: string, name: string): Promise<void> =>
    RenewCertificate(contextName, namespace, name),
  listCertManagerCertificateRequests: (
    contextName: string,
    namespace: string,
  ): Promise<CertManagerCertificateRequestInfo[]> =>
    ListCertManagerCertificateRequests(contextName, namespace),
  getCertManagerCertificateRequest: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<CertManagerCertificateRequestDetail> =>
    GetCertManagerCertificateRequest(contextName, namespace, name),
  certManagerCertificateRequestsFor: (
    contextName: string,
    namespace: string,
    certName: string,
  ): Promise<CertManagerCertificateRequestInfo[]> =>
    CertManagerCertificateRequestsFor(contextName, namespace, certName),
  listCertManagerOrders: (
    contextName: string,
    namespace: string,
  ): Promise<CertManagerOrderInfo[]> => ListCertManagerOrders(contextName, namespace),
  getCertManagerOrder: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<CertManagerOrderDetail> => GetCertManagerOrder(contextName, namespace, name),
  certManagerOrdersFor: (
    contextName: string,
    namespace: string,
    requestName: string,
  ): Promise<CertManagerOrderInfo[]> =>
    CertManagerOrdersFor(contextName, namespace, requestName),
  listCertManagerChallenges: (
    contextName: string,
    namespace: string,
  ): Promise<CertManagerChallengeInfo[]> => ListCertManagerChallenges(contextName, namespace),
  getCertManagerChallenge: (
    contextName: string,
    namespace: string,
    name: string,
  ): Promise<CertManagerChallengeDetail> =>
    GetCertManagerChallenge(contextName, namespace, name),
  certManagerChallengesFor: (
    contextName: string,
    namespace: string,
    orderName: string,
  ): Promise<CertManagerChallengeInfo[]> =>
    CertManagerChallengesFor(contextName, namespace, orderName),
  version: (): Promise<string> => Version(),
  checkForUpdate: (): Promise<UpdateResult> => CheckForUpdate(),
}
