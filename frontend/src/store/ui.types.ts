// Pure declarative types and constants for the UI store. Lives in its own
// file so persistence helpers can reference these without pulling the whole
// Zustand store and its DOM side effects into their dependency graph.

export type SidebarMode = 'expanded' | 'icons'

export const SIDEBAR_WIDTH_MIN = 200
export const SIDEBAR_WIDTH_MAX = 400
export const SIDEBAR_WIDTH_DEFAULT = 256

export type ContextTag = string

export type TagColor =
  | 'rose'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'fuchsia'
  | 'pink'
  | 'slate'

export type CustomTagDef = {
  id: string
  label: string
  shortLabel: string
  color: TagColor
}

export type ContextGroup = {
  id: string
  name: string
  contexts: string[]
  color: TagColor
}

export type LastSession = {
  contexts: string[]
  groupId: string | null
  at: number
}

export const MAX_TAGS_PER_CONTEXT = 3

export type ResourceView =
  | 'overview'
  | 'workloadsoverview'
  | 'pods'
  | 'deployments'
  | 'services'
  | 'configmaps'
  | 'secrets'
  | 'statefulsets'
  | 'daemonsets'
  | 'replicasets'
  | 'persistentvolumeclaims'
  | 'persistentvolumes'
  | 'storageclasses'
  | 'csidrivers'
  | 'csinodes'
  | 'volumeattachments'
  | 'flowschemas'
  | 'prioritylevelconfigurations'
  | 'networkpolicies'
  | 'horizontalpodautoscalers'
  | 'poddisruptionbudgets'
  | 'endpointslices'
  | 'resourcequotas'
  | 'limitranges'
  | 'ingressclasses'
  | 'priorityclasses'
  | 'runtimeclasses'
  | 'leases'
  | 'mutatingwebhookconfigurations'
  | 'validatingwebhookconfigurations'
  | 'validatingadmissionpolicies'
  | 'validatingadmissionpolicybindings'
  | 'mutatingadmissionpolicies'
  | 'mutatingadmissionpolicybindings'
  | 'deviceclasses'
  | 'resourceslices'
  | 'resourceclaims'
  | 'resourceclaimtemplates'
  | 'servicecidrs'
  | 'ipaddresses'
  | 'apiservices'
  | 'endpoints'
  | 'replicationcontrollers'
  | 'events'
  | 'jobs'
  | 'cronjobs'
  | 'ingresses'
  | 'nodes'
  | 'namespaces'
  | 'serviceaccounts'
  | 'roles'
  | 'rolebindings'
  | 'clusterroles'
  | 'clusterrolebindings'
  | 'certificatesigningrequests'
  | 'accessreview'
  | 'helmreleases'
  | 'helmrepos'
  | 'argocdapplications'
  | 'argocdappprojects'
  | 'argocdapplicationsets'
  | 'gateways'
  | 'httproutes'
  | 'grpcroutes'
  | 'gatewayclasses'
  | 'referencegrants'
  | 'karpenternodepools'
  | 'karpenternodeclaims'
  | 'fluxkustomizations'
  | 'fluxhelmreleases'
  | 'fluxgitrepositories'
  | 'fluxhelmrepositories'
  | 'fluxocirepositories'
  | 'fluxbuckets'
  | 'fluxproviders'
  | 'fluxalerts'
  | 'fluxreceivers'
  | 'istiovirtualservices'
  | 'istiodestinationrules'
  | 'istiopeerauthentications'
  | 'certmanagercertificates'
  | 'certmanagerissuers'
  | 'certmanagerclusterissuers'
  | 'certmanagercertificaterequests'
  | 'certmanagerorders'
  | 'certmanagerchallenges'

export type ResourceKind =
  | 'Pod'
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'ReplicaSet'
  | 'PersistentVolumeClaim'
  | 'PersistentVolume'
  | 'StorageClass'
  | 'CSIDriver'
  | 'CSINode'
  | 'VolumeAttachment'
  | 'FlowSchema'
  | 'PriorityLevelConfiguration'
  | 'NetworkPolicy'
  | 'HorizontalPodAutoscaler'
  | 'PodDisruptionBudget'
  | 'EndpointSlice'
  | 'ResourceQuota'
  | 'LimitRange'
  | 'IngressClass'
  | 'PriorityClass'
  | 'RuntimeClass'
  | 'Lease'
  | 'MutatingWebhookConfiguration'
  | 'ValidatingWebhookConfiguration'
  | 'ValidatingAdmissionPolicy'
  | 'ValidatingAdmissionPolicyBinding'
  | 'MutatingAdmissionPolicy'
  | 'MutatingAdmissionPolicyBinding'
  | 'DeviceClass'
  | 'ResourceSlice'
  | 'ResourceClaim'
  | 'ResourceClaimTemplate'
  | 'ServiceCIDR'
  | 'IPAddress'
  | 'APIService'
  | 'Endpoints'
  | 'ReplicationController'
  | 'Job'
  | 'CronJob'
  | 'Service'
  | 'ConfigMap'
  | 'Secret'
  | 'Ingress'
  | 'Node'
  | 'Namespace'
  | 'ServiceAccount'
  | 'Role'
  | 'RoleBinding'
  | 'ClusterRole'
  | 'ClusterRoleBinding'
  | 'CertificateSigningRequest'
  | 'Gateway'
  | 'HTTPRoute'
  | 'GRPCRoute'
  | 'GatewayClass'
  | 'ReferenceGrant'

export type SelectedResourceGVR = {
  group: string
  version: string
  resource: string
}

export type SelectedResource = {
  kind: ResourceKind | string
  namespace: string
  name: string
  gvr?: SelectedResourceGVR
  context?: string
  // suspended carries the Flux .spec.suspend snapshot from the row click so
  // the detail dialog's Suspend/Resume button knows which label to render
  // without having to wait for the body to fetch the full detail object.
  suspended?: boolean
  // logContainer preselects a container in the Pod Logs tab when the pod is
  // opened from a per-container affordance (e.g. the Pods list container
  // squares), so the click lands straight on that container's stream.
  logContainer?: string
}

export type DetailTab = 'overview' | 'logs' | 'exec' | 'shell' | 'events' | 'history' | 'yaml'

export type PendingAction =
  | { kind: 'delete'; resource: SelectedResource }
  | { kind: 'portforward'; resource: SelectedResource }
  | { kind: 'restart'; resource: SelectedResource }
