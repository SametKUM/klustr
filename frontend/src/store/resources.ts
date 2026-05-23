import { create } from 'zustand'
import type {
  ConfigMapInfo,
  CronJobInfo,
  DaemonSetInfo,
  ReplicaSetInfo,
  PersistentVolumeClaimInfo,
  PersistentVolumeInfo,
  StorageClassInfo,
  CSIDriverInfo,
  CSINodeInfo,
  VolumeAttachmentInfo,
  NetworkPolicyInfo,
  HorizontalPodAutoscalerInfo,
  PodDisruptionBudgetInfo,
  EndpointSliceInfo,
  ResourceQuotaInfo,
  LimitRangeInfo,
  IngressClassInfo,
  PriorityClassInfo,
  RuntimeClassInfo,
  LeaseInfo,
  WebhookConfigurationInfo,
  APIServiceInfo,
  EndpointsInfo,
  ReplicationControllerInfo,
  DeploymentInfo,
  IngressInfo,
  JobInfo,
  NamespaceInfo,
  NodeInfo,
  PodInfo,
  SecretInfo,
  ServiceInfo,
  StatefulSetInfo,
  ServiceAccountInfo,
  RoleInfo,
  RoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleBindingInfo,
  CertificateSigningRequestInfo,
  GatewayInfo,
  HTTPRouteInfo,
  GRPCRouteInfo,
  GatewayClassInfo,
  ReferenceGrantInfo,
} from '@/lib/api'

export type ByContext<T> = Record<string, T[]>

type ResourcesState = {
  namespaces: ByContext<NamespaceInfo>
  pods: ByContext<PodInfo>
  deployments: ByContext<DeploymentInfo>
  services: ByContext<ServiceInfo>
  configMaps: ByContext<ConfigMapInfo>
  secrets: ByContext<SecretInfo>
  statefulSets: ByContext<StatefulSetInfo>
  daemonSets: ByContext<DaemonSetInfo>
  replicaSets: ByContext<ReplicaSetInfo>
  persistentVolumeClaims: ByContext<PersistentVolumeClaimInfo>
  persistentVolumes: ByContext<PersistentVolumeInfo>
  storageClasses: ByContext<StorageClassInfo>
  csiDrivers: ByContext<CSIDriverInfo>
  csiNodes: ByContext<CSINodeInfo>
  volumeAttachments: ByContext<VolumeAttachmentInfo>
  networkPolicies: ByContext<NetworkPolicyInfo>
  horizontalPodAutoscalers: ByContext<HorizontalPodAutoscalerInfo>
  podDisruptionBudgets: ByContext<PodDisruptionBudgetInfo>
  endpointSlices: ByContext<EndpointSliceInfo>
  resourceQuotas: ByContext<ResourceQuotaInfo>
  limitRanges: ByContext<LimitRangeInfo>
  ingressClasses: ByContext<IngressClassInfo>
  priorityClasses: ByContext<PriorityClassInfo>
  runtimeClasses: ByContext<RuntimeClassInfo>
  leases: ByContext<LeaseInfo>
  mutatingWebhookConfigurations: ByContext<WebhookConfigurationInfo>
  validatingWebhookConfigurations: ByContext<WebhookConfigurationInfo>
  apiServices: ByContext<APIServiceInfo>
  endpoints: ByContext<EndpointsInfo>
  replicationControllers: ByContext<ReplicationControllerInfo>
  jobs: ByContext<JobInfo>
  cronJobs: ByContext<CronJobInfo>
  ingresses: ByContext<IngressInfo>
  nodes: ByContext<NodeInfo>
  serviceAccounts: ByContext<ServiceAccountInfo>
  roles: ByContext<RoleInfo>
  roleBindings: ByContext<RoleBindingInfo>
  clusterRoles: ByContext<ClusterRoleInfo>
  clusterRoleBindings: ByContext<ClusterRoleBindingInfo>
  certificateSigningRequests: ByContext<CertificateSigningRequestInfo>
  gateways: ByContext<GatewayInfo>
  httpRoutes: ByContext<HTTPRouteInfo>
  grpcRoutes: ByContext<GRPCRouteInfo>
  gatewayClasses: ByContext<GatewayClassInfo>
  referenceGrants: ByContext<ReferenceGrantInfo>
  setNamespaces: (ctx: string, list: NamespaceInfo[]) => void
  setPods: (ctx: string, list: PodInfo[]) => void
  setDeployments: (ctx: string, list: DeploymentInfo[]) => void
  setServices: (ctx: string, list: ServiceInfo[]) => void
  setConfigMaps: (ctx: string, list: ConfigMapInfo[]) => void
  setSecrets: (ctx: string, list: SecretInfo[]) => void
  setStatefulSets: (ctx: string, list: StatefulSetInfo[]) => void
  setDaemonSets: (ctx: string, list: DaemonSetInfo[]) => void
  setReplicaSets: (ctx: string, list: ReplicaSetInfo[]) => void
  setPersistentVolumeClaims: (ctx: string, list: PersistentVolumeClaimInfo[]) => void
  setPersistentVolumes: (ctx: string, list: PersistentVolumeInfo[]) => void
  setStorageClasses: (ctx: string, list: StorageClassInfo[]) => void
  setCSIDrivers: (ctx: string, list: CSIDriverInfo[]) => void
  setCSINodes: (ctx: string, list: CSINodeInfo[]) => void
  setVolumeAttachments: (ctx: string, list: VolumeAttachmentInfo[]) => void
  setNetworkPolicies: (ctx: string, list: NetworkPolicyInfo[]) => void
  setHorizontalPodAutoscalers: (ctx: string, list: HorizontalPodAutoscalerInfo[]) => void
  setPodDisruptionBudgets: (ctx: string, list: PodDisruptionBudgetInfo[]) => void
  setEndpointSlices: (ctx: string, list: EndpointSliceInfo[]) => void
  setResourceQuotas: (ctx: string, list: ResourceQuotaInfo[]) => void
  setLimitRanges: (ctx: string, list: LimitRangeInfo[]) => void
  setIngressClasses: (ctx: string, list: IngressClassInfo[]) => void
  setPriorityClasses: (ctx: string, list: PriorityClassInfo[]) => void
  setRuntimeClasses: (ctx: string, list: RuntimeClassInfo[]) => void
  setLeases: (ctx: string, list: LeaseInfo[]) => void
  setMutatingWebhookConfigurations: (ctx: string, list: WebhookConfigurationInfo[]) => void
  setValidatingWebhookConfigurations: (ctx: string, list: WebhookConfigurationInfo[]) => void
  setAPIServices: (ctx: string, list: APIServiceInfo[]) => void
  setEndpoints: (ctx: string, list: EndpointsInfo[]) => void
  setReplicationControllers: (ctx: string, list: ReplicationControllerInfo[]) => void
  setJobs: (ctx: string, list: JobInfo[]) => void
  setCronJobs: (ctx: string, list: CronJobInfo[]) => void
  setIngresses: (ctx: string, list: IngressInfo[]) => void
  setNodes: (ctx: string, list: NodeInfo[]) => void
  setServiceAccounts: (ctx: string, list: ServiceAccountInfo[]) => void
  setRoles: (ctx: string, list: RoleInfo[]) => void
  setRoleBindings: (ctx: string, list: RoleBindingInfo[]) => void
  setClusterRoles: (ctx: string, list: ClusterRoleInfo[]) => void
  setClusterRoleBindings: (ctx: string, list: ClusterRoleBindingInfo[]) => void
  setCertificateSigningRequests: (ctx: string, list: CertificateSigningRequestInfo[]) => void
  setGateways: (ctx: string, list: GatewayInfo[]) => void
  setHTTPRoutes: (ctx: string, list: HTTPRouteInfo[]) => void
  setGRPCRoutes: (ctx: string, list: GRPCRouteInfo[]) => void
  setGatewayClasses: (ctx: string, list: GatewayClassInfo[]) => void
  setReferenceGrants: (ctx: string, list: ReferenceGrantInfo[]) => void
  clearContext: (ctx: string) => void
  reset: () => void
}

const KIND_KEYS = [
  'namespaces',
  'pods',
  'deployments',
  'services',
  'configMaps',
  'secrets',
  'statefulSets',
  'daemonSets',
  'replicaSets',
  'persistentVolumeClaims',
  'persistentVolumes',
  'storageClasses',
  'csiDrivers',
  'csiNodes',
  'volumeAttachments',
  'networkPolicies',
  'horizontalPodAutoscalers',
  'podDisruptionBudgets',
  'endpointSlices',
  'resourceQuotas',
  'limitRanges',
  'ingressClasses',
  'priorityClasses',
  'runtimeClasses',
  'leases',
  'mutatingWebhookConfigurations',
  'validatingWebhookConfigurations',
  'apiServices',
  'endpoints',
  'replicationControllers',
  'jobs',
  'cronJobs',
  'ingresses',
  'nodes',
  'serviceAccounts',
  'roles',
  'roleBindings',
  'clusterRoles',
  'clusterRoleBindings',
  'certificateSigningRequests',
  'gateways',
  'httpRoutes',
  'grpcRoutes',
  'gatewayClasses',
  'referenceGrants',
] as const

type KindKey = (typeof KIND_KEYS)[number]

function emptyMaps(): Pick<ResourcesState, KindKey> {
  const out = {} as Record<KindKey, ByContext<unknown>>
  for (const k of KIND_KEYS) out[k] = {}
  return out as Pick<ResourcesState, KindKey>
}

function withCtx<T>(map: ByContext<T>, ctx: string, list: T[]): ByContext<T> {
  return { ...map, [ctx]: list }
}

function withoutCtx<T>(map: ByContext<T>, ctx: string): ByContext<T> {
  if (!(ctx in map)) return map
  const next = { ...map }
  delete next[ctx]
  return next
}

export function mergeForContexts<T>(
  byContext: ByContext<T>,
  contexts: readonly string[],
): T[] {
  const out: T[] = []
  for (const ctx of contexts) {
    const list = byContext[ctx]
    if (list && list.length > 0) {
      for (const item of list) out.push(item)
    }
  }
  return out
}

export const useResources = create<ResourcesState>((set) => ({
  ...emptyMaps(),
  setNamespaces: (ctx, list) => set((s) => ({ namespaces: withCtx(s.namespaces, ctx, list) })),
  setPods: (ctx, list) => set((s) => ({ pods: withCtx(s.pods, ctx, list) })),
  setDeployments: (ctx, list) => set((s) => ({ deployments: withCtx(s.deployments, ctx, list) })),
  setServices: (ctx, list) => set((s) => ({ services: withCtx(s.services, ctx, list) })),
  setConfigMaps: (ctx, list) => set((s) => ({ configMaps: withCtx(s.configMaps, ctx, list) })),
  setSecrets: (ctx, list) => set((s) => ({ secrets: withCtx(s.secrets, ctx, list) })),
  setStatefulSets: (ctx, list) => set((s) => ({ statefulSets: withCtx(s.statefulSets, ctx, list) })),
  setDaemonSets: (ctx, list) => set((s) => ({ daemonSets: withCtx(s.daemonSets, ctx, list) })),
  setReplicaSets: (ctx, list) => set((s) => ({ replicaSets: withCtx(s.replicaSets, ctx, list) })),
  setPersistentVolumeClaims: (ctx, list) =>
    set((s) => ({ persistentVolumeClaims: withCtx(s.persistentVolumeClaims, ctx, list) })),
  setPersistentVolumes: (ctx, list) =>
    set((s) => ({ persistentVolumes: withCtx(s.persistentVolumes, ctx, list) })),
  setStorageClasses: (ctx, list) =>
    set((s) => ({ storageClasses: withCtx(s.storageClasses, ctx, list) })),
  setCSIDrivers: (ctx, list) => set((s) => ({ csiDrivers: withCtx(s.csiDrivers, ctx, list) })),
  setCSINodes: (ctx, list) => set((s) => ({ csiNodes: withCtx(s.csiNodes, ctx, list) })),
  setVolumeAttachments: (ctx, list) =>
    set((s) => ({ volumeAttachments: withCtx(s.volumeAttachments, ctx, list) })),
  setNetworkPolicies: (ctx, list) =>
    set((s) => ({ networkPolicies: withCtx(s.networkPolicies, ctx, list) })),
  setHorizontalPodAutoscalers: (ctx, list) =>
    set((s) => ({
      horizontalPodAutoscalers: withCtx(s.horizontalPodAutoscalers, ctx, list),
    })),
  setPodDisruptionBudgets: (ctx, list) =>
    set((s) => ({ podDisruptionBudgets: withCtx(s.podDisruptionBudgets, ctx, list) })),
  setEndpointSlices: (ctx, list) =>
    set((s) => ({ endpointSlices: withCtx(s.endpointSlices, ctx, list) })),
  setResourceQuotas: (ctx, list) =>
    set((s) => ({ resourceQuotas: withCtx(s.resourceQuotas, ctx, list) })),
  setLimitRanges: (ctx, list) => set((s) => ({ limitRanges: withCtx(s.limitRanges, ctx, list) })),
  setIngressClasses: (ctx, list) =>
    set((s) => ({ ingressClasses: withCtx(s.ingressClasses, ctx, list) })),
  setPriorityClasses: (ctx, list) =>
    set((s) => ({ priorityClasses: withCtx(s.priorityClasses, ctx, list) })),
  setRuntimeClasses: (ctx, list) =>
    set((s) => ({ runtimeClasses: withCtx(s.runtimeClasses, ctx, list) })),
  setLeases: (ctx, list) => set((s) => ({ leases: withCtx(s.leases, ctx, list) })),
  setMutatingWebhookConfigurations: (ctx, list) =>
    set((s) => ({
      mutatingWebhookConfigurations: withCtx(s.mutatingWebhookConfigurations, ctx, list),
    })),
  setValidatingWebhookConfigurations: (ctx, list) =>
    set((s) => ({
      validatingWebhookConfigurations: withCtx(s.validatingWebhookConfigurations, ctx, list),
    })),
  setAPIServices: (ctx, list) => set((s) => ({ apiServices: withCtx(s.apiServices, ctx, list) })),
  setEndpoints: (ctx, list) => set((s) => ({ endpoints: withCtx(s.endpoints, ctx, list) })),
  setReplicationControllers: (ctx, list) =>
    set((s) => ({ replicationControllers: withCtx(s.replicationControllers, ctx, list) })),
  setJobs: (ctx, list) => set((s) => ({ jobs: withCtx(s.jobs, ctx, list) })),
  setCronJobs: (ctx, list) => set((s) => ({ cronJobs: withCtx(s.cronJobs, ctx, list) })),
  setIngresses: (ctx, list) => set((s) => ({ ingresses: withCtx(s.ingresses, ctx, list) })),
  setNodes: (ctx, list) => set((s) => ({ nodes: withCtx(s.nodes, ctx, list) })),
  setServiceAccounts: (ctx, list) =>
    set((s) => ({ serviceAccounts: withCtx(s.serviceAccounts, ctx, list) })),
  setRoles: (ctx, list) => set((s) => ({ roles: withCtx(s.roles, ctx, list) })),
  setRoleBindings: (ctx, list) =>
    set((s) => ({ roleBindings: withCtx(s.roleBindings, ctx, list) })),
  setClusterRoles: (ctx, list) =>
    set((s) => ({ clusterRoles: withCtx(s.clusterRoles, ctx, list) })),
  setClusterRoleBindings: (ctx, list) =>
    set((s) => ({ clusterRoleBindings: withCtx(s.clusterRoleBindings, ctx, list) })),
  setCertificateSigningRequests: (ctx, list) =>
    set((s) => ({ certificateSigningRequests: withCtx(s.certificateSigningRequests, ctx, list) })),
  setGateways: (ctx, list) => set((s) => ({ gateways: withCtx(s.gateways, ctx, list) })),
  setHTTPRoutes: (ctx, list) => set((s) => ({ httpRoutes: withCtx(s.httpRoutes, ctx, list) })),
  setGRPCRoutes: (ctx, list) => set((s) => ({ grpcRoutes: withCtx(s.grpcRoutes, ctx, list) })),
  setGatewayClasses: (ctx, list) =>
    set((s) => ({ gatewayClasses: withCtx(s.gatewayClasses, ctx, list) })),
  setReferenceGrants: (ctx, list) =>
    set((s) => ({ referenceGrants: withCtx(s.referenceGrants, ctx, list) })),
  clearContext: (ctx) =>
    set((s) => {
      const next = {} as Partial<Record<KindKey, ByContext<unknown>>>
      for (const k of KIND_KEYS) {
        const map = s[k] as ByContext<unknown>
        if (ctx in map) next[k] = withoutCtx(map, ctx)
      }
      return next as Partial<ResourcesState>
    }),
  reset: () => set(emptyMaps()),
}))
