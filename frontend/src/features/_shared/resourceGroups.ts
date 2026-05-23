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
  Layers3,
  Plug,
  Filter,
  Gauge,
  ServerCog,
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
  ScanSearch,
  Scale,
  ScrollText,
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

import type { ResourceKind, ResourceView } from '@/store/ui'

export type SidebarIcon = ComponentType<SVGAttributes<SVGElement>>
// `kind` ties a sidebar item to its Kubernetes kind so the sidebar filter
// can hide entries the current user has no list/watch access to. Items
// without a kind (Overview, Events, Access Review, Helm Repos) always show.
export type NavItem = {
  label: string
  view?: ResourceView
  icon?: SidebarIcon
  kind?: ResourceKind
}
export type ResourceGroup = { label: string; items: NavItem[]; icon?: SidebarIcon }

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    label: 'Cluster',
    icon: Server,
    items: [
      { label: 'Overview', view: 'overview', icon: LayoutDashboard },
      { label: 'Nodes', view: 'nodes', icon: Server, kind: 'Node' },
      { label: 'Namespaces', view: 'namespaces', icon: FolderTree, kind: 'Namespace' },
      { label: 'API Services', view: 'apiservices', icon: Layers3, kind: 'APIService' },
      { label: 'Flow Schemas', view: 'flowschemas', icon: Filter, kind: 'FlowSchema' },
      {
        label: 'Priority Levels',
        view: 'prioritylevelconfigurations',
        icon: Gauge,
        kind: 'PriorityLevelConfiguration',
      },
      { label: 'Events', view: 'events', icon: BellRing },
    ],
  },
  {
    label: 'Workloads',
    icon: Layers,
    items: [
      { label: 'Overview', view: 'workloadsoverview', icon: Activity },
      { label: 'Pods', view: 'pods', icon: Box, kind: 'Pod' },
      { label: 'Deployments', view: 'deployments', icon: Rocket, kind: 'Deployment' },
      { label: 'StatefulSets', view: 'statefulsets', icon: Database, kind: 'StatefulSet' },
      { label: 'DaemonSets', view: 'daemonsets', icon: Boxes, kind: 'DaemonSet' },
      { label: 'ReplicaSets', view: 'replicasets', icon: Copy, kind: 'ReplicaSet' },
      { label: 'ReplicationControllers', view: 'replicationcontrollers', icon: CopyPlus, kind: 'ReplicationController' },
      { label: 'Jobs', view: 'jobs', icon: Briefcase, kind: 'Job' },
      { label: 'CronJobs', view: 'cronjobs', icon: CalendarClock, kind: 'CronJob' },
    ],
  },
  {
    label: 'Config',
    icon: Settings2,
    items: [
      { label: 'ConfigMaps', view: 'configmaps', icon: FileText, kind: 'ConfigMap' },
      { label: 'Secrets', view: 'secrets', icon: Lock, kind: 'Secret' },
      { label: 'HorizontalPodAutoscalers', view: 'horizontalpodautoscalers', icon: TrendingUp, kind: 'HorizontalPodAutoscaler' },
      { label: 'PodDisruptionBudgets', view: 'poddisruptionbudgets', icon: ShieldAlert, kind: 'PodDisruptionBudget' },
      { label: 'ResourceQuotas', view: 'resourcequotas', icon: Scale, kind: 'ResourceQuota' },
      { label: 'LimitRanges', view: 'limitranges', icon: Ruler, kind: 'LimitRange' },
      { label: 'PriorityClasses', view: 'priorityclasses', icon: ArrowUpDown, kind: 'PriorityClass' },
      { label: 'RuntimeClasses', view: 'runtimeclasses', icon: Cpu, kind: 'RuntimeClass' },
      { label: 'Leases', view: 'leases', icon: Handshake, kind: 'Lease' },
      { label: 'MutatingWebhooks', view: 'mutatingwebhookconfigurations', icon: Webhook, kind: 'MutatingWebhookConfiguration' },
      { label: 'ValidatingWebhooks', view: 'validatingwebhookconfigurations', icon: Webhook, kind: 'ValidatingWebhookConfiguration' },
    ],
  },
  {
    label: 'Network',
    icon: Network,
    items: [
      { label: 'Services', view: 'services', icon: Network, kind: 'Service' },
      { label: 'Ingresses', view: 'ingresses', icon: Globe, kind: 'Ingress' },
      { label: 'NetworkPolicies', view: 'networkpolicies', icon: ShieldCheck, kind: 'NetworkPolicy' },
      { label: 'EndpointSlices', view: 'endpointslices', icon: Link2, kind: 'EndpointSlice' },
      { label: 'Endpoints', view: 'endpoints', icon: Link, kind: 'Endpoints' },
      { label: 'IngressClasses', view: 'ingressclasses', icon: Compass, kind: 'IngressClass' },
    ],
  },
  {
    label: 'Storage',
    icon: Database,
    items: [
      { label: 'PersistentVolumeClaims', view: 'persistentvolumeclaims', icon: HardDrive, kind: 'PersistentVolumeClaim' },
      { label: 'PersistentVolumes', view: 'persistentvolumes', icon: HardDriveDownload, kind: 'PersistentVolume' },
      { label: 'StorageClasses', view: 'storageclasses', icon: Archive, kind: 'StorageClass' },
      { label: 'CSI Drivers', view: 'csidrivers', icon: Plug, kind: 'CSIDriver' },
      { label: 'CSI Nodes', view: 'csinodes', icon: ServerCog, kind: 'CSINode' },
      { label: 'Volume Attachments', view: 'volumeattachments', icon: Link2, kind: 'VolumeAttachment' },
    ],
  },
  {
    label: 'Access Control',
    icon: KeyRound,
    items: [
      { label: 'Access Review', view: 'accessreview', icon: ScanSearch },
      { label: 'Service Accounts', view: 'serviceaccounts', icon: User, kind: 'ServiceAccount' },
      { label: 'Cluster Roles', view: 'clusterroles', icon: ShieldCheck, kind: 'ClusterRole' },
      { label: 'Roles', view: 'roles', icon: Shield, kind: 'Role' },
      { label: 'Cluster Role Bindings', view: 'clusterrolebindings', icon: Link2, kind: 'ClusterRoleBinding' },
      { label: 'Role Bindings', view: 'rolebindings', icon: Link, kind: 'RoleBinding' },
      {
        label: 'CSRs',
        view: 'certificatesigningrequests',
        icon: ScrollText,
        kind: 'CertificateSigningRequest',
      },
    ],
  },
]

export const HELM_GROUP: ResourceGroup = {
  label: 'Helm',
  icon: Ship,
  items: [
    // Helm releases are stored as Secrets, so list access to Secrets is the
    // real gate. Repositories live in a local JSON file — always available.
    { label: 'Releases', view: 'helmreleases', icon: Package, kind: 'Secret' },
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
    { label: 'Gateways', view: 'gateways', icon: DoorOpen, kind: 'Gateway' },
    { label: 'HTTPRoutes', view: 'httproutes', icon: Route, kind: 'HTTPRoute' },
    { label: 'GRPCRoutes', view: 'grpcroutes', icon: Route, kind: 'GRPCRoute' },
    { label: 'GatewayClasses', view: 'gatewayclasses', icon: Compass, kind: 'GatewayClass' },
    { label: 'ReferenceGrants', view: 'referencegrants', icon: Stamp, kind: 'ReferenceGrant' },
  ],
}
