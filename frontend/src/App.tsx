import { useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
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
import { ARGO_GROUP, GATEWAY_GROUP, HELM_GROUP, RESOURCE_GROUPS } from '@/features/_shared/resourceGroups'
import { RowActionDialogs } from '@/features/_shared/RowActionDialogs'
import { KeyboardShortcutsDialog } from '@/features/_shared/KeyboardShortcutsDialog'
import { CommandPalette } from '@/features/_shared/CommandPalette'
import { NamespaceSearchPalette } from '@/features/contexts/NamespaceSearchPalette'
import { StatusBar } from '@/features/_shared/StatusBar'
import { PodSearchPalette } from '@/features/pods/PodSearchPalette'
import { PortForwardIndicator } from '@/features/portforward/PortForwardIndicator'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
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

const NAV_VIEWS: ResourceView[] = [
  ...RESOURCE_GROUPS.flatMap((g) =>
    g.items.map((i) => i.view).filter((v): v is ResourceView => v !== undefined),
  ),
  ...GATEWAY_GROUP.items.map((i) => i.view).filter((v): v is ResourceView => v !== undefined),
  ...ARGO_GROUP.items.map((i) => i.view).filter((v): v is ResourceView => v !== undefined),
  ...HELM_GROUP.items.map((i) => i.view).filter((v): v is ResourceView => v !== undefined),
]

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      const current = NAV_VIEWS.indexOf(selectedView)
      const start = current >= 0 ? current : 0
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const next = (start + delta + NAV_VIEWS.length) % NAV_VIEWS.length
      setSelectedView(NAV_VIEWS[next])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedView, setSelectedView])

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
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-border bg-sidebar text-sidebar-foreground">
          <nav className="flex flex-col gap-3 p-3">
            {RESOURCE_GROUPS.map((group) => {
              const collapsed = collapsedNavGroups.includes(group.label)
              return (
                <div key={group.label}>
                  <button
                    type="button"
                    onClick={() => toggleNavGroup(group.label)}
                    aria-expanded={!collapsed}
                    className="flex w-full items-center gap-1 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground"
                  >
                    <ChevronRight
                      className={`size-3 shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                    />
                    <span>{group.label}</span>
                  </button>
                  {!collapsed && (
                    <ul className="flex flex-col">
                      {group.items.map((item) => {
                        const active =
                          item.view !== undefined &&
                          item.view === selectedView &&
                          selectedCRDKey === null
                        const enabled = item.view !== undefined
                        return (
                          <li
                            key={item.label}
                            aria-disabled={!enabled}
                            className={[
                              'rounded px-2 py-1 text-sm',
                              enabled
                                ? 'cursor-pointer text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                : 'cursor-default text-muted-foreground/60',
                              active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : '',
                            ].join(' ')}
                            onClick={() => {
                              if (item.view) setSelectedView(item.view)
                            }}
                          >
                            {item.label}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
            {crds.some((c) => c.group === 'gateway.networking.k8s.io') && (
              (() => {
                const collapsed = collapsedNavGroups.includes(GATEWAY_GROUP.label)
                return (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleNavGroup(GATEWAY_GROUP.label)}
                      aria-expanded={!collapsed}
                      className="flex w-full items-center gap-1 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground"
                    >
                      <ChevronRight
                        className={`size-3 shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                      />
                      <span>{GATEWAY_GROUP.label}</span>
                    </button>
                    {!collapsed && (
                      <ul className="flex flex-col">
                        {GATEWAY_GROUP.items.map((item) => {
                          const active =
                            item.view !== undefined &&
                            item.view === selectedView &&
                            selectedCRDKey === null
                          return (
                            <li
                              key={item.label}
                              className={[
                                'cursor-pointer rounded px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : '',
                              ].join(' ')}
                              onClick={() => {
                                if (item.view) setSelectedView(item.view)
                              }}
                            >
                              {item.label}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })()
            )}
            {crds.some((c) => c.group === 'argoproj.io' && c.resource === 'applications') && (
              (() => {
                const collapsed = collapsedNavGroups.includes(ARGO_GROUP.label)
                return (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleNavGroup(ARGO_GROUP.label)}
                      aria-expanded={!collapsed}
                      className="flex w-full items-center gap-1 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground"
                    >
                      <ChevronRight
                        className={`size-3 shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                      />
                      <span>{ARGO_GROUP.label}</span>
                    </button>
                    {!collapsed && (
                      <ul className="flex flex-col">
                        {ARGO_GROUP.items.map((item) => {
                          const active =
                            item.view !== undefined &&
                            item.view === selectedView &&
                            selectedCRDKey === null
                          return (
                            <li
                              key={item.label}
                              className={[
                                'cursor-pointer rounded px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : '',
                              ].join(' ')}
                              onClick={() => {
                                if (item.view) setSelectedView(item.view)
                              }}
                            >
                              {item.label}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })()
            )}
            {(() => {
              const collapsed = collapsedNavGroups.includes(HELM_GROUP.label)
              return (
                <div>
                  <button
                    type="button"
                    onClick={() => toggleNavGroup(HELM_GROUP.label)}
                    aria-expanded={!collapsed}
                    className="flex w-full items-center gap-1 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground"
                  >
                    <ChevronRight
                      className={`size-3 shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                    />
                    <span>{HELM_GROUP.label}</span>
                  </button>
                  {!collapsed && (
                    <ul className="flex flex-col">
                      {HELM_GROUP.items.map((item) => {
                        const active =
                          item.view !== undefined &&
                          item.view === selectedView &&
                          selectedCRDKey === null
                        return (
                          <li
                            key={item.label}
                            className={[
                              'cursor-pointer rounded px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                              active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : '',
                            ].join(' ')}
                            onClick={() => {
                              if (item.view) setSelectedView(item.view)
                            }}
                          >
                            {item.label}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })()}
            <CRDGroups
              crds={crds}
              expandedGroups={expandedCRDGroups}
              toggleGroup={toggleCRDGroup}
              selectedCRDKey={selectedCRDKey}
              onSelect={setSelectedCRD}
            />
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
