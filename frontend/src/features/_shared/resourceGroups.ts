import type { ComponentType, SVGAttributes } from 'react'

import {
  Activity,
  Archive,
  ArrowUpDown,
  BellRing,
  Box,
  Boxes,
  Briefcase,
  CalendarClock,
  Compass,
  Copy,
  CopyPlus,
  Cpu,
  Database,
  DoorOpen,
  FileText,
  FolderTree,
  GitBranch,
  Globe,
  Handshake,
  HardDrive,
  HardDriveDownload,
  KeyRound,
  Layers,
  LayoutDashboard,
  Library,
  Link,
  Link2,
  Lock,
  Network,
  Package,
  Rocket,
  Route,
  Ruler,
  Scale,
  Server,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Stamp,
  TrendingUp,
  User,
  Waypoints,
  Webhook,
} from 'lucide-react'
import { SiArgo } from 'react-icons/si'

import type { ResourceView } from '@/store/ui'

export type SidebarIcon = ComponentType<SVGAttributes<SVGElement>>
export type NavItem = { label: string; view?: ResourceView; icon?: SidebarIcon }
export type ResourceGroup = { label: string; items: NavItem[]; icon?: SidebarIcon }

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    label: 'Cluster',
    icon: Server,
    items: [
      { label: 'Overview', view: 'overview', icon: LayoutDashboard },
      { label: 'Nodes', view: 'nodes', icon: Server },
      { label: 'Namespaces', view: 'namespaces', icon: FolderTree },
      { label: 'Events', view: 'events', icon: BellRing },
    ],
  },
  {
    label: 'Workloads',
    icon: Layers,
    items: [
      { label: 'Overview', view: 'workloadsoverview', icon: Activity },
      { label: 'Pods', view: 'pods', icon: Box },
      { label: 'Deployments', view: 'deployments', icon: Rocket },
      { label: 'StatefulSets', view: 'statefulsets', icon: Database },
      { label: 'DaemonSets', view: 'daemonsets', icon: Boxes },
      { label: 'ReplicaSets', view: 'replicasets', icon: Copy },
      { label: 'ReplicationControllers', view: 'replicationcontrollers', icon: CopyPlus },
      { label: 'Jobs', view: 'jobs', icon: Briefcase },
      { label: 'CronJobs', view: 'cronjobs', icon: CalendarClock },
    ],
  },
  {
    label: 'Config',
    icon: Settings2,
    items: [
      { label: 'ConfigMaps', view: 'configmaps', icon: FileText },
      { label: 'Secrets', view: 'secrets', icon: Lock },
      { label: 'HorizontalPodAutoscalers', view: 'horizontalpodautoscalers', icon: TrendingUp },
      { label: 'PodDisruptionBudgets', view: 'poddisruptionbudgets', icon: ShieldAlert },
      { label: 'ResourceQuotas', view: 'resourcequotas', icon: Scale },
      { label: 'LimitRanges', view: 'limitranges', icon: Ruler },
      { label: 'PriorityClasses', view: 'priorityclasses', icon: ArrowUpDown },
      { label: 'RuntimeClasses', view: 'runtimeclasses', icon: Cpu },
      { label: 'Leases', view: 'leases', icon: Handshake },
      { label: 'MutatingWebhooks', view: 'mutatingwebhookconfigurations', icon: Webhook },
      { label: 'ValidatingWebhooks', view: 'validatingwebhookconfigurations', icon: Webhook },
    ],
  },
  {
    label: 'Network',
    icon: Network,
    items: [
      { label: 'Services', view: 'services', icon: Network },
      { label: 'Ingresses', view: 'ingresses', icon: Globe },
      { label: 'NetworkPolicies', view: 'networkpolicies', icon: ShieldCheck },
      { label: 'EndpointSlices', view: 'endpointslices', icon: Link2 },
      { label: 'Endpoints', view: 'endpoints', icon: Link },
      { label: 'IngressClasses', view: 'ingressclasses', icon: Compass },
    ],
  },
  {
    label: 'Storage',
    icon: Database,
    items: [
      { label: 'PersistentVolumeClaims', view: 'persistentvolumeclaims', icon: HardDrive },
      { label: 'PersistentVolumes', view: 'persistentvolumes', icon: HardDriveDownload },
      { label: 'StorageClasses', view: 'storageclasses', icon: Archive },
    ],
  },
  {
    label: 'Access Control',
    icon: KeyRound,
    items: [
      { label: 'Service Accounts', view: 'serviceaccounts', icon: User },
      { label: 'Cluster Roles', view: 'clusterroles', icon: ShieldCheck },
      { label: 'Roles', view: 'roles', icon: Shield },
      { label: 'Cluster Role Bindings', view: 'clusterrolebindings', icon: Link2 },
      { label: 'Role Bindings', view: 'rolebindings', icon: Link },
    ],
  },
]

export const HELM_GROUP: ResourceGroup = {
  label: 'Helm',
  icon: Ship,
  items: [
    { label: 'Releases', view: 'helmreleases', icon: Package },
    { label: 'Repositories', view: 'helmrepos', icon: Library },
  ],
}

export const ARGO_GROUP: ResourceGroup = {
  label: 'Argo CD',
  icon: SiArgo,
  items: [{ label: 'Applications', view: 'argocdapplications', icon: GitBranch }],
}

export const GATEWAY_GROUP: ResourceGroup = {
  label: 'Gateway API',
  icon: Waypoints,
  items: [
    { label: 'Gateways', view: 'gateways', icon: DoorOpen },
    { label: 'HTTPRoutes', view: 'httproutes', icon: Route },
    { label: 'GRPCRoutes', view: 'grpcroutes', icon: Route },
    { label: 'GatewayClasses', view: 'gatewayclasses', icon: Compass },
    { label: 'ReferenceGrants', view: 'referencegrants', icon: Stamp },
  ],
}
