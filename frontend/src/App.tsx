import { useEffect, useMemo, useRef } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { ThemePicker } from '@/features/_shared/ThemePicker'
import { ReadOnlyToggle } from '@/features/_shared/ReadOnlyToggle'
import { ContextSwitcher } from '@/features/contexts/ContextSwitcher'
import { ContextTagPicker } from '@/features/contexts/ContextTagPicker'
import { DisconnectButton } from '@/features/contexts/DisconnectButton'
import { COLOR_PALETTE, resolveTagMeta } from '@/features/contexts/contextTagMeta'
import { ConnectionStatus } from '@/features/contexts/ConnectionStatus'
import { ConnectionsScreen } from '@/features/contexts/ConnectionsScreen'
import { CredentialSuggestionPrompt } from '@/features/contexts/CredentialSuggestionPrompt'
import { NamespaceSelector } from '@/features/contexts/NamespaceSelector'
import { PodsView } from '@/features/pods/PodsView'
import { DeploymentsView } from '@/features/deployments/DeploymentsView'
import { ServicesView } from '@/features/services/ServicesView'
import { ConfigMapsView } from '@/features/configmaps/ConfigMapsView'
import { SecretsView } from '@/features/secrets/SecretsView'
import { StatefulSetsView } from '@/features/statefulsets/StatefulSetsView'
import { DaemonSetsView } from '@/features/daemonsets/DaemonSetsView'
import { ReplicaSetsView } from '@/features/replicasets/ReplicaSetsView'
import { PersistentVolumeClaimsView } from '@/features/pvcs/PersistentVolumeClaimsView'
import { PersistentVolumesView } from '@/features/pvs/PersistentVolumesView'
import { StorageClassesView } from '@/features/storageclasses/StorageClassesView'
import { CSIDriversView } from '@/features/csidrivers/CSIDriversView'
import { CSINodesView } from '@/features/csinodes/CSINodesView'
import { VolumeAttachmentsView } from '@/features/volumeattachments/VolumeAttachmentsView'
import { NetworkPoliciesView } from '@/features/networkpolicies/NetworkPoliciesView'
import { HorizontalPodAutoscalersView } from '@/features/hpas/HorizontalPodAutoscalersView'
import { PodDisruptionBudgetsView } from '@/features/pdbs/PodDisruptionBudgetsView'
import { EndpointSlicesView } from '@/features/endpointslices/EndpointSlicesView'
import { ResourceQuotasView } from '@/features/resourcequotas/ResourceQuotasView'
import { LimitRangesView } from '@/features/limitranges/LimitRangesView'
import { IngressClassesView } from '@/features/ingressclasses/IngressClassesView'
import { PriorityClassesView } from '@/features/priorityclasses/PriorityClassesView'
import { RuntimeClassesView } from '@/features/runtimeclasses/RuntimeClassesView'
import { APIServicesView } from '@/features/apiservices/APIServicesView'
import { CSRsView } from '@/features/csrs/CSRsView'
import { FlowSchemasView } from '@/features/flowschemas/FlowSchemasView'
import { PriorityLevelsView } from '@/features/prioritylevels/PriorityLevelsView'
import { LeasesView } from '@/features/leases/LeasesView'
import { MutatingWebhookConfigurationsView } from '@/features/webhooks/MutatingWebhookConfigurationsView'
import { ValidatingWebhookConfigurationsView } from '@/features/webhooks/ValidatingWebhookConfigurationsView'
import { ValidatingAdmissionPoliciesView } from '@/features/validatingadmissionpolicies/ValidatingAdmissionPoliciesView'
import { ValidatingAdmissionPolicyBindingsView } from '@/features/validatingadmissionpolicybindings/ValidatingAdmissionPolicyBindingsView'
import { MutatingAdmissionPoliciesView } from '@/features/mutatingadmissionpolicies/MutatingAdmissionPoliciesView'
import { MutatingAdmissionPolicyBindingsView } from '@/features/mutatingadmissionpolicybindings/MutatingAdmissionPolicyBindingsView'
import { DeviceClassesView } from '@/features/deviceclasses/DeviceClassesView'
import { ResourceSlicesView } from '@/features/resourceslices/ResourceSlicesView'
import { ResourceClaimsView } from '@/features/resourceclaims/ResourceClaimsView'
import { ResourceClaimTemplatesView } from '@/features/resourceclaimtemplates/ResourceClaimTemplatesView'
import { ServiceCIDRsView } from '@/features/servicecidrs/ServiceCIDRsView'
import { IPAddressesView } from '@/features/ipaddresses/IPAddressesView'
import { EndpointsView } from '@/features/endpoints/EndpointsView'
import { ReplicationControllersView } from '@/features/replicationcontrollers/ReplicationControllersView'
import { EventsView } from '@/features/events/EventsView'
import { JobsView } from '@/features/jobs/JobsView'
import { CronJobsView } from '@/features/cronjobs/CronJobsView'
import { IngressesView } from '@/features/ingresses/IngressesView'
import { NodesView } from '@/features/nodes/NodesView'
import { NamespacesView } from '@/features/namespaces/NamespacesView'
import { ServiceAccountsView } from '@/features/serviceaccounts/ServiceAccountsView'
import { RolesView } from '@/features/roles/RolesView'
import { RoleBindingsView } from '@/features/rolebindings/RoleBindingsView'
import { ClusterRolesView } from '@/features/clusterroles/ClusterRolesView'
import { ClusterRoleBindingsView } from '@/features/clusterrolebindings/ClusterRoleBindingsView'
import { AccessReviewView } from '@/features/accessreview/AccessReviewView'
import { OverviewView } from '@/features/overview/OverviewView'
import { WorkloadsOverviewView } from '@/features/overview/WorkloadsOverviewView'
import { CustomResourceView } from '@/features/crds/CustomResourceView'
import { CRDGroups } from '@/features/crds/CRDGroups'
import { orderedCRDKeys } from '@/features/crds/crdGrouping'
import { ApplicationsView } from '@/features/argocd/ApplicationsView'
import { AppProjectsView } from '@/features/argocd/AppProjectsView'
import { ApplicationSetsView } from '@/features/argocd/ApplicationSetsView'
import { HelmReleasesView } from '@/features/helm/HelmReleasesView'
import { HelmReposView } from '@/features/helm/HelmReposView'
import { GatewaysView } from '@/features/gateways/GatewaysView'
import { HTTPRoutesView } from '@/features/httproutes/HTTPRoutesView'
import { GRPCRoutesView } from '@/features/grpcroutes/GRPCRoutesView'
import { GatewayClassesView } from '@/features/gatewayclasses/GatewayClassesView'
import { ReferenceGrantsView } from '@/features/referencegrants/ReferenceGrantsView'
import { KarpenterNodePoolsView } from '@/features/karpenter-nodepools/KarpenterNodePoolsView'
import { KarpenterNodeClaimsView } from '@/features/karpenter-nodeclaims/KarpenterNodeClaimsView'
import { FluxKustomizationsView } from '@/features/flux/FluxKustomizationsView'
import { FluxHelmReleasesView } from '@/features/flux/FluxHelmReleasesView'
import { FluxGitRepositoriesView } from '@/features/flux/FluxGitRepositoriesView'
import { FluxHelmRepositoriesView } from '@/features/flux/FluxHelmRepositoriesView'
import { FluxOCIRepositoriesView } from '@/features/flux/FluxOCIRepositoriesView'
import { FluxBucketsView } from '@/features/flux/FluxBucketsView'
import { FluxProvidersView } from '@/features/flux/FluxProvidersView'
import { FluxAlertsView } from '@/features/flux/FluxAlertsView'
import { FluxReceiversView } from '@/features/flux/FluxReceiversView'
import { IstioVirtualServicesView } from '@/features/istio/IstioVirtualServicesView'
import { IstioDestinationRulesView } from '@/features/istio/IstioDestinationRulesView'
import { IstioPeerAuthenticationsView } from '@/features/istio/IstioPeerAuthenticationsView'
import { CertificatesView } from '@/features/cert-manager/CertificatesView'
import { IssuersView } from '@/features/cert-manager/IssuersView'
import { CertificateRequestsView } from '@/features/cert-manager/CertificateRequestsView'
import { OrdersView } from '@/features/cert-manager/OrdersView'
import { ChallengesView } from '@/features/cert-manager/ChallengesView'
import { ResourceDetailPanel } from '@/features/_shared/ResourceDetailPanel'
import { ARGO_GROUP, CERT_MANAGER_GROUP_NAV, FLUX_GROUP, GATEWAY_GROUP, HELM_GROUP, ISTIO_GROUP, KARPENTER_GROUP, RESOURCE_GROUPS, type ResourceGroup } from '@/features/_shared/resourceGroups'
import { HiddenSidebarItemsButton } from '@/features/_shared/HiddenSidebarItemsButton'
import { SidebarGroup } from '@/features/_shared/SidebarGroup'
import { SidebarResizeHandle } from '@/features/_shared/SidebarResizeHandle'
import { RowActionDialogs } from '@/features/_shared/RowActionDialogs'
import { KeyboardShortcutsDialog } from '@/features/_shared/KeyboardShortcutsDialog'
import { CommandPalette } from '@/features/_shared/CommandPalette'
import { NamespaceSearchPalette } from '@/features/contexts/NamespaceSearchPalette'
import { StatusBar } from '@/features/_shared/StatusBar'
import { PodSearchPalette } from '@/features/pods/PodSearchPalette'
import { PortForwardIndicator } from '@/features/portforward/PortForwardIndicator'
import { TerminalButton } from '@/features/terminal/TerminalButton'
import { TerminalDrawer } from '@/features/terminal/TerminalDrawer'
import { Toaster } from '@/components/ui/sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type CRDInfo } from '@/lib/api'
import { onCredsUpdate, onKubeChange, onPFUpdate, resetSyncState } from '@/lib/events'
import { toast } from 'sonner'
import { useCredentialsStore } from '@/store/credentials'
import {
  useActiveContexts,
  useEffectiveHiddenSidebarItems,
  useUIStore,
  type ResourceView,
} from '@/store/ui'
import { useResources } from '@/store/resources'
import { crdKey, useCRDStore } from '@/store/crds'
import { useHelmStore } from '@/store/helm'
import { usePortForwards } from '@/store/portForwards'
import { useTerminalStore } from '@/store/terminals'
import { kindAccessibleInAny, useAccessStore } from '@/store/access'


function MainView() {
  const view = useUIStore((s) => s.selectedView)
  const selectedCRDKey = useUIStore((s) => s.selectedCRDKey)
  const crd = useCRDStore((s) => (selectedCRDKey ? s.byKey[selectedCRDKey] : null))
  if (selectedCRDKey) {
    if (!crd) {
      return (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Loading CRD…
        </div>
      )
    }
    return <CustomResourceView crd={crd} />
  }
  switch (view) {
    case 'overview':
      return <OverviewView />
    case 'workloadsoverview':
      return <WorkloadsOverviewView />
    case 'pods':
      return <PodsView />
    case 'deployments':
      return <DeploymentsView />
    case 'services':
      return <ServicesView />
    case 'configmaps':
      return <ConfigMapsView />
    case 'secrets':
      return <SecretsView />
    case 'statefulsets':
      return <StatefulSetsView />
    case 'daemonsets':
      return <DaemonSetsView />
    case 'replicasets':
      return <ReplicaSetsView />
    case 'persistentvolumeclaims':
      return <PersistentVolumeClaimsView />
    case 'persistentvolumes':
      return <PersistentVolumesView />
    case 'storageclasses':
      return <StorageClassesView />
    case 'csidrivers':
      return <CSIDriversView />
    case 'csinodes':
      return <CSINodesView />
    case 'volumeattachments':
      return <VolumeAttachmentsView />
    case 'networkpolicies':
      return <NetworkPoliciesView />
    case 'horizontalpodautoscalers':
      return <HorizontalPodAutoscalersView />
    case 'poddisruptionbudgets':
      return <PodDisruptionBudgetsView />
    case 'endpointslices':
      return <EndpointSlicesView />
    case 'resourcequotas':
      return <ResourceQuotasView />
    case 'limitranges':
      return <LimitRangesView />
    case 'ingressclasses':
      return <IngressClassesView />
    case 'priorityclasses':
      return <PriorityClassesView />
    case 'runtimeclasses':
      return <RuntimeClassesView />
    case 'apiservices':
      return <APIServicesView />
    case 'certificatesigningrequests':
      return <CSRsView />
    case 'flowschemas':
      return <FlowSchemasView />
    case 'prioritylevelconfigurations':
      return <PriorityLevelsView />
    case 'leases':
      return <LeasesView />
    case 'mutatingwebhookconfigurations':
      return <MutatingWebhookConfigurationsView />
    case 'validatingwebhookconfigurations':
      return <ValidatingWebhookConfigurationsView />
    case 'validatingadmissionpolicies':
      return <ValidatingAdmissionPoliciesView />
    case 'validatingadmissionpolicybindings':
      return <ValidatingAdmissionPolicyBindingsView />
    case 'mutatingadmissionpolicies':
      return <MutatingAdmissionPoliciesView />
    case 'mutatingadmissionpolicybindings':
      return <MutatingAdmissionPolicyBindingsView />
    case 'deviceclasses':
      return <DeviceClassesView />
    case 'resourceslices':
      return <ResourceSlicesView />
    case 'resourceclaims':
      return <ResourceClaimsView />
    case 'resourceclaimtemplates':
      return <ResourceClaimTemplatesView />
    case 'servicecidrs':
      return <ServiceCIDRsView />
    case 'ipaddresses':
      return <IPAddressesView />
    case 'endpoints':
      return <EndpointsView />
    case 'replicationcontrollers':
      return <ReplicationControllersView />
    case 'events':
      return <EventsView />
    case 'jobs':
      return <JobsView />
    case 'cronjobs':
      return <CronJobsView />
    case 'ingresses':
      return <IngressesView />
    case 'nodes':
      return <NodesView />
    case 'namespaces':
      return <NamespacesView />
    case 'serviceaccounts':
      return <ServiceAccountsView />
    case 'roles':
      return <RolesView />
    case 'rolebindings':
      return <RoleBindingsView />
    case 'clusterroles':
      return <ClusterRolesView />
    case 'clusterrolebindings':
      return <ClusterRoleBindingsView />
    case 'accessreview':
      return <AccessReviewView />
    case 'helmreleases':
      return <HelmReleasesView />
    case 'helmrepos':
      return <HelmReposView />
    case 'argocdapplications':
      return <ApplicationsView />
    case 'argocdappprojects':
      return <AppProjectsView />
    case 'argocdapplicationsets':
      return <ApplicationSetsView />
    case 'gateways':
      return <GatewaysView />
    case 'httproutes':
      return <HTTPRoutesView />
    case 'grpcroutes':
      return <GRPCRoutesView />
    case 'gatewayclasses':
      return <GatewayClassesView />
    case 'referencegrants':
      return <ReferenceGrantsView />
    case 'karpenternodepools':
      return <KarpenterNodePoolsView />
    case 'karpenternodeclaims':
      return <KarpenterNodeClaimsView />
    case 'fluxkustomizations':
      return <FluxKustomizationsView />
    case 'fluxhelmreleases':
      return <FluxHelmReleasesView />
    case 'fluxgitrepositories':
      return <FluxGitRepositoriesView />
    case 'fluxhelmrepositories':
      return <FluxHelmRepositoriesView />
    case 'fluxocirepositories':
      return <FluxOCIRepositoriesView />
    case 'fluxbuckets':
      return <FluxBucketsView />
    case 'fluxproviders':
      return <FluxProvidersView />
    case 'fluxalerts':
      return <FluxAlertsView />
    case 'fluxreceivers':
      return <FluxReceiversView />
    case 'istiovirtualservices':
      return <IstioVirtualServicesView />
    case 'istiodestinationrules':
      return <IstioDestinationRulesView />
    case 'istiopeerauthentications':
      return <IstioPeerAuthenticationsView />
    case 'certmanagercertificates':
      return <CertificatesView />
    case 'certmanagerissuers':
      return <IssuersView cluster={false} />
    case 'certmanagerclusterissuers':
      return <IssuersView cluster={true} />
    case 'certmanagercertificaterequests':
      return <CertificateRequestsView />
    case 'certmanagerorders':
      return <OrdersView />
    case 'certmanagerchallenges':
      return <ChallengesView />
    default:
      return (
        <div className="flex flex-1 items-center justify-center">
          <ConnectionStatus />
        </div>
      )
  }
}

function groupViews(group: ResourceGroup): ResourceView[] {
  return group.items.map((i) => i.view).filter((v): v is ResourceView => v !== undefined)
}

type NavEntry = { kind: 'view'; view: ResourceView } | { kind: 'crd'; key: string }

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function App() {
  const activeContexts = useActiveContexts()
  const globalReadOnly = useUIStore((s) => s.globalReadOnly)
  const selectedContext = useUIStore((s) => s.selectedContext)
  const selectedView = useUIStore((s) => s.selectedView)
  const setSelectedView = useUIStore((s) => s.setSelectedView)
  const selectedResource = useUIStore((s) => s.selectedResource)
  const collapsedNavGroups = useUIStore((s) => s.collapsedNavGroups)
  const toggleNavGroup = useUIStore((s) => s.toggleNavGroup)
  const sidebarMode = useUIStore((s) => s.sidebarMode)
  const toggleSidebarMode = useUIStore((s) => s.toggleSidebarMode)
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth)
  const expandedCRDGroups = useUIStore((s) => s.expandedCRDGroups)
  const toggleCRDGroup = useUIStore((s) => s.toggleCRDGroup)
  const primaryTagId = useUIStore((s) =>
    s.selectedContext ? (s.contextTags[s.selectedContext]?.[0] ?? null) : null,
  )
  const customTags = useUIStore((s) => s.customTags)
  const currentTagMeta = resolveTagMeta(primaryTagId, customTags)
  const activeGroupId = useUIStore((s) => s.activeGroupId)
  const contextGroups = useUIStore((s) => s.contextGroups)
  const activeGroup = activeGroupId ? contextGroups.find((g) => g.id === activeGroupId) : null
  const activeGroupBarClass = activeGroup ? COLOR_PALETTE[activeGroup.color]?.barClass ?? null : null
  const topBarClass = currentTagMeta?.barClass ?? activeGroupBarClass ?? null
  const resetResources = useResources((s) => s.reset)
  const setPortForwards = usePortForwards((s) => s.setList)
  const crds = useCRDStore((s) => s.crds)
  const setCRDs = useCRDStore((s) => s.setCRDs)
  const resetCRDs = useCRDStore((s) => s.reset)
  const resetHelm = useHelmStore((s) => s.reset)
  const selectedCRDKey = useUIStore((s) => s.selectedCRDKey)
  const setSelectedCRD = useUIStore((s) => s.setSelectedCRD)
  const setAccess = useAccessStore((s) => s.set)
  const resetAccess = useAccessStore((s) => s.reset)
  const accessByContext = useAccessStore((s) => s.byContext)
  const hiddenSidebarItems = useEffectiveHiddenSidebarItems()
  const hideSidebarItem = useUIStore((s) => s.hideSidebarItem)
  const showSidebarItem = useUIStore((s) => s.showSidebarItem)
  const clearHiddenSidebarItems = useUIStore((s) => s.clearHiddenSidebarItems)
  const activeNavItemRef = useRef<HTMLLIElement | null>(null)

  const isAggregated = activeContexts.length >= 2
  const hasGatewayAPI = !isAggregated && crds.some((c) => c.group === 'gateway.networking.k8s.io')
  const hasArgoApplications =
    !isAggregated &&
    crds.some((c) => c.group === 'argoproj.io' && c.resource === 'applications')
  const hasKarpenter = !isAggregated && crds.some((c) => c.group === 'karpenter.sh')
  const hasFluxCD =
    !isAggregated &&
    crds.some((c) => c.group === 'kustomize.toolkit.fluxcd.io' && c.resource === 'kustomizations')
  const hasIstio = !isAggregated && crds.some((c) => c.group === 'networking.istio.io')
  const hasCertManager =
    !isAggregated &&
    crds.some((c) => c.group === 'cert-manager.io' && c.resource === 'certificates')
  const visibleGroups = useMemo<ResourceGroup[]>(() => {
    const allGroups: ResourceGroup[] = [
      ...RESOURCE_GROUPS,
      ...(hasGatewayAPI ? [GATEWAY_GROUP] : []),
      ...(hasIstio ? [ISTIO_GROUP] : []),
      ...(hasCertManager ? [CERT_MANAGER_GROUP_NAV] : []),
      ...(hasArgoApplications ? [ARGO_GROUP] : []),
      ...(hasKarpenter ? [KARPENTER_GROUP] : []),
      ...(hasFluxCD ? [FLUX_GROUP] : []),
      HELM_GROUP,
    ]
    // Filter each group's items by per-context RBAC reach. Items without a
    // `kind` (Overview, Events, Access Review, Helm Repos) always survive
    // because they aren't gated on a single kind. Drop groups that empty out.
    // The user-hide filter runs after RBAC so the "Show hidden" popover
    // never offers an item the current contexts can't see anyway.
    const hidden = new Set<string>(hiddenSidebarItems)
    return allGroups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            (!i.kind || kindAccessibleInAny(accessByContext, activeContexts, i.kind)) &&
            (!i.view || !hidden.has(i.view)),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [
    hasGatewayAPI,
    hasArgoApplications,
    hasKarpenter,
    hasFluxCD,
    hasIstio,
    hasCertManager,
    accessByContext,
    activeContexts,
    hiddenSidebarItems,
  ])
  const navViews = useMemo<ResourceView[]>(() => visibleGroups.flatMap(groupViews), [
    visibleGroups,
  ])
  // Builtin views followed by the currently-visible CRD entries, in sidebar
  // order, so arrow navigation is continuous across both and stays anchored to
  // the active CRD instead of a stale builtin view.
  const navEntries = useMemo<NavEntry[]>(() => {
    const views: NavEntry[] = navViews.map((view) => ({ kind: 'view', view }))
    const crdKeys: NavEntry[] =
      sidebarMode === 'expanded'
        ? orderedCRDKeys(crds, expandedCRDGroups).map((key) => ({ kind: 'crd', key }))
        : []
    return [...views, ...crdKeys]
  }, [navViews, crds, expandedCRDGroups, sidebarMode])

  useEffect(() => {
    activeNavItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedView, selectedCRDKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      if (isEditableTarget(e.target)) return
      if (navEntries.length === 0) return
      e.preventDefault()
      const current = selectedCRDKey
        ? navEntries.findIndex((en) => en.kind === 'crd' && en.key === selectedCRDKey)
        : navEntries.findIndex((en) => en.kind === 'view' && en.view === selectedView)
      const start = current >= 0 ? current : 0
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const next = navEntries[(start + delta + navEntries.length) % navEntries.length]
      if (next.kind === 'view') setSelectedView(next.view)
      else setSelectedCRD(next.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navEntries, selectedView, selectedCRDKey, setSelectedView, setSelectedCRD])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`') return
      if (!e.metaKey && !e.ctrlKey) return
      if (e.altKey || e.shiftKey) return
      e.preventDefault()
      useTerminalStore.getState().toggleDrawer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const reload = () => {
      api.listPortForwards().then((list) => setPortForwards(list ?? []))
    }
    reload()
    return onPFUpdate(reload)
  }, [setPortForwards])

  useEffect(() => {
    const { setProviders, setStatuses } = useCredentialsStore.getState()
    api
      .listCredentialProviders()
      .then((p) => setProviders(p ?? []))
      .catch(() => {})
    api
      .listCredentialStatuses()
      .then((s) => setStatuses(s ?? []))
      .catch(() => {})
    return onCredsUpdate((status) => {
      useCredentialsStore.getState().applyStatus(status)
      if (status.state === 'error') {
        toast.error(`Credential capture failed for ${status.context}`, {
          description: status.error,
          action: {
            label: 'Retry',
            onClick: () => void api.captureCredentials(status.context),
          },
        })
      }
    })
  }, [])

  useEffect(() => {
    for (const ctx of activeContexts) {
      api.setReadOnly(ctx, globalReadOnly).catch(console.error)
    }
  }, [activeContexts, globalReadOnly])

  // Watches are diffed against the previous context set instead of being torn
  // down in the effect cleanup: Wails runs each bound call in its own
  // goroutine, so a cleanup StopWatch(A) racing the re-run's StartWatch(A)
  // could land after it and silently tear down the fresh watcher. Only
  // contexts actually leaving the set are stopped, which also keeps the
  // "already-attached contexts aren't restarted" invariant.
  const watchedContextsRef = useRef<string[]>([])
  useEffect(() => {
    const prev = watchedContextsRef.current
    const removed = prev.filter((ctx) => !activeContexts.includes(ctx))
    const added = activeContexts.filter((ctx) => !prev.includes(ctx))
    watchedContextsRef.current = activeContexts
    for (const ctx of removed) {
      api.stopWatch(ctx).catch(console.error)
    }
    resetResources()
    resetCRDs()
    resetHelm()
    resetAccess()
    if (activeContexts.length === 0) return
    resetSyncState(added)
    const fetchAccess = (ctx: string) =>
      api
        .listAccessibleKinds(ctx)
        .then((kinds) => setAccess(ctx, kinds ?? []))
        .catch(() => setAccess(ctx, []))
    for (const ctx of activeContexts) {
      if (added.includes(ctx)) {
        api
          .startWatch(ctx)
          .then(() => fetchAccess(ctx))
          .catch(console.error)
      } else {
        // Retained contexts keep their live watcher; only the access snapshot
        // was reset above and needs a re-fetch.
        void fetchAccess(ctx)
      }
    }
    // A backend-internal watch rebuild (credential capture/refresh) re-runs
    // access discovery; re-fetch our snapshot when it announces the swap.
    const unsubAccess = onKubeChange('_access', (ctx) => {
      if (!activeContexts.includes(ctx)) return
      api
        .listAccessibleKinds(ctx)
        .then((kinds) => setAccess(ctx, kinds ?? []))
        .catch(() => {})
    })
    return () => {
      unsubAccess()
    }
  }, [activeContexts, resetResources, resetCRDs, resetHelm, resetAccess, setAccess])

  useEffect(() => {
    if (activeContexts.length === 0) {
      setCRDs([])
      return
    }
    let cancelled = false
    const reload = () => {
      Promise.all(
        activeContexts.map((ctx) => api.listCRDs(ctx).catch(() => [] as CRDInfo[])),
      ).then((lists) => {
        if (cancelled) return
        const seen = new Map<string, CRDInfo>()
        for (const list of lists) {
          for (const c of list ?? []) seen.set(crdKey(c), c)
        }
        setCRDs(Array.from(seen.values()))
      })
    }
    reload()
    const unsub = onKubeChange('_crds', (ctx) => {
      if (activeContexts.includes(ctx)) reload()
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [activeContexts, setCRDs])

  if (activeContexts.length === 0) {
    return (
      <TooltipProvider delayDuration={250}>
        <ConnectionsScreen />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={250}>
    <div className="flex h-screen flex-col bg-background text-foreground">
      {topBarClass && (
        <div
          className={`h-[3px] w-full shrink-0 ${topBarClass}`}
          aria-hidden
        />
      )}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">Klustr</span>
          <ContextSwitcher />
          <NamespaceSelector />
          <ContextTagPicker />
        </div>
        <div className="flex items-center gap-1">
          {/* Cluster session tools */}
          <TerminalButton />
          <PortForwardIndicator />
          <ReadOnlyToggle />
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          {/* App preferences & leaving the cluster */}
          <ThemePicker />
          <DisconnectButton />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          style={sidebarMode === 'expanded' ? { width: sidebarWidth } : undefined}
          className={`${
            sidebarMode === 'icons' ? 'w-12' : ''
          } relative flex shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground`}
        >
          {sidebarMode === 'icons' && (
            <div className="flex shrink-0 justify-center p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleSidebarMode}
                    aria-label="Expand sidebar"
                    className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <PanelLeftOpen className="size-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  Expand sidebar
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          {sidebarMode === 'expanded' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleSidebarMode}
                  aria-label="Collapse sidebar"
                  className="absolute right-1 top-1 z-10 flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <PanelLeftClose className="size-4" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6}>
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          )}
          <nav
            className={`flex flex-1 flex-col overflow-y-auto ${
              sidebarMode === 'icons' ? 'items-center gap-1 p-1' : 'gap-3 p-3'
            }`}
          >
            {visibleGroups.map((group) => (
              <SidebarGroup
                key={group.label}
                group={group}
                mode={sidebarMode}
                collapsed={collapsedNavGroups.includes(group.label)}
                onToggleCollapse={() => toggleNavGroup(group.label)}
                selectedView={selectedView}
                selectedCRDKey={selectedCRDKey}
                onSelectView={setSelectedView}
                onHideItem={hideSidebarItem}
                activeItemRef={activeNavItemRef}
              />
            ))}
            {sidebarMode === 'expanded' && (
              <CRDGroups
                crds={crds}
                expandedGroups={expandedCRDGroups}
                toggleGroup={toggleCRDGroup}
                selectedCRDKey={selectedCRDKey}
                onSelect={setSelectedCRD}
              />
            )}
          </nav>
          {hiddenSidebarItems.length > 0 && (
            <div
              className={
                sidebarMode === 'icons'
                  ? 'flex justify-center border-t border-sidebar-border/60 p-1'
                  : 'border-t border-sidebar-border/60 px-2 py-1.5'
              }
            >
              <HiddenSidebarItemsButton
                hiddenItems={hiddenSidebarItems}
                mode={sidebarMode}
                onShowItem={showSidebarItem}
                onClearAll={clearHiddenSidebarItems}
              />
            </div>
          )}
          {sidebarMode === 'expanded' && (
            <SidebarResizeHandle width={sidebarWidth} onResize={setSidebarWidth} />
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <main className="flex min-h-0 flex-1 overflow-hidden">
            <MainView />
          </main>
          <TerminalDrawer />
        </div>
      </div>

      <StatusBar />

      <ResourceDetailPanel
        contextName={selectedResource?.context ?? selectedContext}
        resource={selectedResource}
      />
      <RowActionDialogs />
      <KeyboardShortcutsDialog />
      <CredentialSuggestionPrompt />
      <CommandPalette />
      <NamespaceSearchPalette />
      <PodSearchPalette />
      <Toaster position="bottom-right" />
    </div>
    </TooltipProvider>
  )
}

export default App
