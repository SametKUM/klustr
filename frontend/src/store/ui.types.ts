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
  | 'helmreleases'
  | 'helmrepos'
  | 'argocdapplications'
  | 'gateways'
  | 'httproutes'
  | 'grpcroutes'
  | 'gatewayclasses'
  | 'referencegrants'

export type ResourceKind =
  | 'Pod'
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'ReplicaSet'
  | 'PersistentVolumeClaim'
  | 'PersistentVolume'
  | 'StorageClass'
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
}

export type DetailTab = 'overview' | 'logs' | 'exec' | 'events' | 'history' | 'yaml'

export type PendingAction =
  | { kind: 'delete'; resource: SelectedResource }
  | { kind: 'portforward'; resource: SelectedResource }
  | { kind: 'restart'; resource: SelectedResource }
