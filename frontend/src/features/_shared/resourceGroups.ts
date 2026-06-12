import type { ComponentType, SVGAttributes } from 'react'

import {
  Activity,
  Archive,
  ArrowUpDown,
  BellRing,
  Box,
  Binary,
  Boxes,
  Briefcase,
  CalendarClock,
  CircuitBoard,
  Cog,
  ClipboardList,
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
  Sprout,
  Stamp,
  TrendingUp,
  User,
  Waypoints,
  Webhook,
} from 'lucide-react'
import { Karpenter, SiArgo, SiHelm, SiIstio } from './brandIcons'

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
      {
        label: 'ValidatingAdmissionPolicies',
        view: 'validatingadmissionpolicies',
        icon: ShieldCheck,
        kind: 'ValidatingAdmissionPolicy',
      },
      {
        label: 'VAP Bindings',
        view: 'validatingadmissionpolicybindings',
        icon: Link2,
        kind: 'ValidatingAdmissionPolicyBinding',
      },
      {
        label: 'MutatingAdmissionPolicies',
        view: 'mutatingadmissionpolicies',
        icon: Cog,
        kind: 'MutatingAdmissionPolicy',
      },
      {
        label: 'MAP Bindings',
        view: 'mutatingadmissionpolicybindings',
        icon: Link2,
        kind: 'MutatingAdmissionPolicyBinding',
      },
    ],
  },
  {
    label: 'Devices',
    icon: CircuitBoard,
    items: [
      { label: 'Device Classes', view: 'deviceclasses', icon: Layers3, kind: 'DeviceClass' },
      { label: 'Resource Slices', view: 'resourceslices', icon: Layers, kind: 'ResourceSlice' },
      { label: 'Resource Claims', view: 'resourceclaims', icon: ClipboardList, kind: 'ResourceClaim' },
      {
        label: 'Claim Templates',
        view: 'resourceclaimtemplates',
        icon: Binary,
        kind: 'ResourceClaimTemplate',
      },
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
      { label: 'Service CIDRs', view: 'servicecidrs', icon: Waypoints, kind: 'ServiceCIDR' },
      { label: 'IP Addresses', view: 'ipaddresses', icon: Network, kind: 'IPAddress' },
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
  icon: SiHelm,
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
  items: [
    { label: 'Applications', view: 'argocdapplications', icon: GitBranch },
    { label: 'Projects', view: 'argocdappprojects', icon: FolderTree },
    { label: 'ApplicationSets', view: 'argocdapplicationsets', icon: Layers3 },
  ],
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

// Karpenter custom resources are cluster-scoped; the group is rendered
// conditionally when the karpenter.sh CRDs are detected in App.tsx, same as
// Gateway/Argo. NodePool/NodeClaim are not gated on SSAR per-kind access —
// the CR list is empty if RBAC denies, which is the correct fallback.
export const KARPENTER_GROUP: ResourceGroup = {
  label: 'Karpenter',
  icon: Karpenter,
  items: [
    { label: 'NodePools', view: 'karpenternodepools', icon: Sprout },
    { label: 'NodeClaims', view: 'karpenternodeclaims', icon: Server },
  ],
}

// Flux CD CRs are watched via the dynamic CR informer (same path Argo CD
// uses). The group is rendered conditionally when the
// kustomize.toolkit.fluxcd.io CRDs are present in App.tsx.
export const FLUX_GROUP: ResourceGroup = {
  label: 'Flux CD',
  icon: GitBranch,
  items: [
    { label: 'Kustomizations', view: 'fluxkustomizations', icon: Layers3 },
    { label: 'HelmReleases', view: 'fluxhelmreleases', icon: Package },
    { label: 'GitRepositories', view: 'fluxgitrepositories', icon: GitBranch },
    { label: 'HelmRepositories', view: 'fluxhelmrepositories', icon: Library },
    { label: 'OCIRepositories', view: 'fluxocirepositories', icon: Ship },
    { label: 'Buckets', view: 'fluxbuckets', icon: Archive },
    { label: 'Providers', view: 'fluxproviders', icon: Plug },
    { label: 'Alerts', view: 'fluxalerts', icon: BellRing },
    { label: 'Receivers', view: 'fluxreceivers', icon: Webhook },
  ],
}

// Istio CRs are watched via the dynamic CR informer like Argo CD / Flux. The
// group is rendered conditionally when the networking.istio.io CRDs are present
// in App.tsx. Versions vary by install, so the views read the served version
// from the discovered CRD rather than hardcoding one.
export const ISTIO_GROUP: ResourceGroup = {
  label: 'Istio',
  icon: SiIstio,
  items: [
    { label: 'VirtualServices', view: 'istiovirtualservices', icon: Route },
    { label: 'DestinationRules', view: 'istiodestinationrules', icon: Waypoints },
    { label: 'PeerAuthentications', view: 'istiopeerauthentications', icon: Lock },
  ],
}

// cert-manager CRs are watched via the dynamic CR informer like Argo CD /
// Flux. The group is rendered conditionally when the cert-manager.io CRDs are
// present in App.tsx. ClusterIssuers are cluster-scoped; the rest namespaced.
export const CERT_MANAGER_GROUP_NAV: ResourceGroup = {
  label: 'cert-manager',
  icon: ShieldCheck,
  items: [
    { label: 'Certificates', view: 'certmanagercertificates', icon: ShieldCheck },
    { label: 'Requests', view: 'certmanagercertificaterequests', icon: ClipboardList },
    { label: 'Orders', view: 'certmanagerorders', icon: ScrollText },
    { label: 'Challenges', view: 'certmanagerchallenges', icon: ScanSearch },
    { label: 'Issuers', view: 'certmanagerissuers', icon: Stamp },
    { label: 'ClusterIssuers', view: 'certmanagerclusterissuers', icon: Globe },
  ],
}
