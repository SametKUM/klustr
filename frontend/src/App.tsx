import { useEffect, useMemo, useRef } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { ThemePicker } from '@/features/_shared/ThemePicker'
import { ContextSwitcher } from '@/features/contexts/ContextSwitcher'
import { ContextTagPicker } from '@/features/contexts/ContextTagPicker'
import { DisconnectButton } from '@/features/contexts/DisconnectButton'
import { COLOR_PALETTE, resolveTagMeta } from '@/features/contexts/contextTagMeta'
import { ConnectionStatus } from '@/features/contexts/ConnectionStatus'
import { ConnectionsScreen } from '@/features/contexts/ConnectionsScreen'
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
import { NetworkPoliciesView } from '@/features/networkpolicies/NetworkPoliciesView'
import { HorizontalPodAutoscalersView } from '@/features/hpas/HorizontalPodAutoscalersView'
import { PodDisruptionBudgetsView } from '@/features/pdbs/PodDisruptionBudgetsView'
import { EndpointSlicesView } from '@/features/endpointslices/EndpointSlicesView'
import { ResourceQuotasView } from '@/features/resourcequotas/ResourceQuotasView'
import { LimitRangesView } from '@/features/limitranges/LimitRangesView'
import { IngressClassesView } from '@/features/ingressclasses/IngressClassesView'
import { PriorityClassesView } from '@/features/priorityclasses/PriorityClassesView'
import { RuntimeClassesView } from '@/features/runtimeclasses/RuntimeClassesView'
import { LeasesView } from '@/features/leases/LeasesView'
import { MutatingWebhookConfigurationsView } from '@/features/webhooks/MutatingWebhookConfigurationsView'
import { ValidatingWebhookConfigurationsView } from '@/features/webhooks/ValidatingWebhookConfigurationsView'
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
import { OverviewView } from '@/features/overview/OverviewView'
import { WorkloadsOverviewView } from '@/features/overview/WorkloadsOverviewView'
import { CustomResourceView } from '@/features/crds/CustomResourceView'
import { CRDGroups } from '@/features/crds/CRDGroups'
import { ApplicationsView } from '@/features/argocd/ApplicationsView'
import { HelmReleasesView } from '@/features/helm/HelmReleasesView'
import { HelmReposView } from '@/features/helm/HelmReposView'
import { GatewaysView } from '@/features/gateways/GatewaysView'
import { HTTPRoutesView } from '@/features/httproutes/HTTPRoutesView'
import { GRPCRoutesView } from '@/features/grpcroutes/GRPCRoutesView'
import { GatewayClassesView } from '@/features/gatewayclasses/GatewayClassesView'
import { ReferenceGrantsView } from '@/features/referencegrants/ReferenceGrantsView'
import { ResourceDetailPanel } from '@/features/_shared/ResourceDetailPanel'
import { ARGO_GROUP, GATEWAY_GROUP, HELM_GROUP, RESOURCE_GROUPS, type ResourceGroup } from '@/features/_shared/resourceGroups'
import { SidebarGroup } from '@/features/_shared/SidebarGroup'
import { RowActionDialogs } from '@/features/_shared/RowActionDialogs'
import { KeyboardShortcutsDialog } from '@/features/_shared/KeyboardShortcutsDialog'
import { CommandPalette } from '@/features/_shared/CommandPalette'
import { NamespaceSearchPalette } from '@/features/contexts/NamespaceSearchPalette'
import { StatusBar } from '@/features/_shared/StatusBar'
import { PodSearchPalette } from '@/features/pods/PodSearchPalette'
import { PortForwardIndicator } from '@/features/portforward/PortForwardIndicator'
import { Toaster } from '@/components/ui/sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { onKubeChange, onPFUpdate } from '@/lib/events'
import { useActiveContexts, useUIStore, type ResourceView } from '@/store/ui'
import { useResources } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useHelmStore } from '@/store/helm'
import { usePortForwards } from '@/store/portForwards'


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
    case 'leases':
      return <LeasesView />
    case 'mutatingwebhookconfigurations':
      return <MutatingWebhookConfigurationsView />
    case 'validatingwebhookconfigurations':
      return <ValidatingWebhookConfigurationsView />
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
    case 'helmreleases':
      return <HelmReleasesView />
    case 'helmrepos':
      return <HelmReposView />
    case 'argocdapplications':
      return <ApplicationsView />
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

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function App() {
  const activeContexts = useActiveContexts()
  const selectedContext = useUIStore((s) => s.selectedContext)
  const selectedView = useUIStore((s) => s.selectedView)
  const setSelectedView = useUIStore((s) => s.setSelectedView)
  const selectedResource = useUIStore((s) => s.selectedResource)
  const collapsedNavGroups = useUIStore((s) => s.collapsedNavGroups)
  const toggleNavGroup = useUIStore((s) => s.toggleNavGroup)
  const sidebarMode = useUIStore((s) => s.sidebarMode)
  const toggleSidebarMode = useUIStore((s) => s.toggleSidebarMode)
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
  const activeNavItemRef = useRef<HTMLLIElement | null>(null)

  const hasGatewayAPI = crds.some((c) => c.group === 'gateway.networking.k8s.io')
  const hasArgoApplications = crds.some(
    (c) => c.group === 'argoproj.io' && c.resource === 'applications',
  )
  const visibleGroups = useMemo<ResourceGroup[]>(() => {
    return [
      ...RESOURCE_GROUPS,
      ...(hasGatewayAPI ? [GATEWAY_GROUP] : []),
      ...(hasArgoApplications ? [ARGO_GROUP] : []),
      HELM_GROUP,
    ]
  }, [hasGatewayAPI, hasArgoApplications])
  const navViews = useMemo<ResourceView[]>(() => visibleGroups.flatMap(groupViews), [
    visibleGroups,
  ])

  useEffect(() => {
    activeNavItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedView, selectedCRDKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      const current = navViews.indexOf(selectedView)
      const start = current >= 0 ? current : 0
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const next = (start + delta + navViews.length) % navViews.length
      setSelectedView(navViews[next])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navViews, selectedView, setSelectedView])

  useEffect(() => {
    const reload = () => {
      api.listPortForwards().then((list) => setPortForwards(list ?? []))
    }
    reload()
    return onPFUpdate(reload)
  }, [setPortForwards])

  useEffect(() => {
    if (activeContexts.length === 0) return
    resetResources()
    resetCRDs()
    resetHelm()
    for (const ctx of activeContexts) {
      api.startWatch(ctx).catch(console.error)
    }
    return () => {
      for (const ctx of activeContexts) {
        api.stopWatch(ctx).catch(console.error)
      }
      resetResources()
      resetCRDs()
      resetHelm()
    }
  }, [activeContexts, resetResources, resetCRDs, resetHelm])

  useEffect(() => {
    if (!selectedContext) {
      setCRDs([])
      return
    }
    const reload = () => {
      api
        .listCRDs(selectedContext)
        .then((list) => setCRDs(list ?? []))
        .catch(() => setCRDs([]))
    }
    reload()
    return onKubeChange('_crds', (ctx) => {
      if (ctx === selectedContext) reload()
    })
  }, [selectedContext, setCRDs])

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
          <PortForwardIndicator />
          <DisconnectButton />
          <ThemePicker />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`${
            sidebarMode === 'icons' ? 'w-12' : 'w-56'
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
        </aside>

        <main className="flex flex-1 overflow-hidden">
          <MainView />
        </main>
      </div>

      <StatusBar />

      <ResourceDetailPanel
        contextName={selectedResource?.context ?? selectedContext}
        resource={selectedResource}
      />
      <RowActionDialogs />
      <KeyboardShortcutsDialog />
      <CommandPalette />
      <NamespaceSearchPalette />
      <PodSearchPalette />
      <Toaster position="bottom-right" />
    </div>
    </TooltipProvider>
  )
}

export default App
