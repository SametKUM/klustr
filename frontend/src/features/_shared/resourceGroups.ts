import type { ResourceView } from '@/store/ui'

export type NavItem = { label: string; view?: ResourceView }
export type ResourceGroup = { label: string; items: NavItem[] }

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    label: 'Cluster',
    items: [
      { label: 'Overview', view: 'overview' },
      { label: 'Nodes', view: 'nodes' },
      { label: 'Namespaces', view: 'namespaces' },
      { label: 'Events', view: 'events' },
    ],
  },
  {
    label: 'Workloads',
    items: [
      { label: 'Overview', view: 'workloadsoverview' },
      { label: 'Pods', view: 'pods' },
      { label: 'Deployments', view: 'deployments' },
      { label: 'StatefulSets', view: 'statefulsets' },
      { label: 'DaemonSets', view: 'daemonsets' },
      { label: 'ReplicaSets', view: 'replicasets' },
      { label: 'ReplicationControllers', view: 'replicationcontrollers' },
      { label: 'Jobs', view: 'jobs' },
      { label: 'CronJobs', view: 'cronjobs' },
    ],
  },
  {
    label: 'Config',
    items: [
      { label: 'ConfigMaps', view: 'configmaps' },
      { label: 'Secrets', view: 'secrets' },
      { label: 'HorizontalPodAutoscalers', view: 'horizontalpodautoscalers' },
      { label: 'PodDisruptionBudgets', view: 'poddisruptionbudgets' },
      { label: 'ResourceQuotas', view: 'resourcequotas' },
      { label: 'LimitRanges', view: 'limitranges' },
      { label: 'PriorityClasses', view: 'priorityclasses' },
      { label: 'RuntimeClasses', view: 'runtimeclasses' },
      { label: 'Leases', view: 'leases' },
      { label: 'MutatingWebhooks', view: 'mutatingwebhookconfigurations' },
      { label: 'ValidatingWebhooks', view: 'validatingwebhookconfigurations' },
    ],
  },
  {
    label: 'Network',
    items: [
      { label: 'Services', view: 'services' },
      { label: 'Ingresses', view: 'ingresses' },
      { label: 'NetworkPolicies', view: 'networkpolicies' },
      { label: 'EndpointSlices', view: 'endpointslices' },
      { label: 'Endpoints', view: 'endpoints' },
      { label: 'IngressClasses', view: 'ingressclasses' },
    ],
  },
  {
    label: 'Storage',
    items: [
      { label: 'PersistentVolumeClaims', view: 'persistentvolumeclaims' },
      { label: 'PersistentVolumes', view: 'persistentvolumes' },
      { label: 'StorageClasses', view: 'storageclasses' },
    ],
  },
  {
    label: 'Access Control',
    items: [
      { label: 'Service Accounts', view: 'serviceaccounts' },
      { label: 'Cluster Roles', view: 'clusterroles' },
      { label: 'Roles', view: 'roles' },
      { label: 'Cluster Role Bindings', view: 'clusterrolebindings' },
      { label: 'Role Bindings', view: 'rolebindings' },
    ],
  },
  {
    label: 'Helm',
    items: [
      { label: 'Releases', view: 'helmreleases' },
      { label: 'Repositories', view: 'helmrepos' },
    ],
  },
]

export const ARGO_GROUP: ResourceGroup = {
  label: 'Argo CD',
  items: [{ label: 'Applications', view: 'argocdapplications' }],
}

export const GATEWAY_GROUP: ResourceGroup = {
  label: 'Gateway API',
  items: [
    { label: 'Gateways', view: 'gateways' },
    { label: 'HTTPRoutes', view: 'httproutes' },
    { label: 'GRPCRoutes', view: 'grpcroutes' },
    { label: 'GatewayClasses', view: 'gatewayclasses' },
    { label: 'ReferenceGrants', view: 'referencegrants' },
  ],
}
