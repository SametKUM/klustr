import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, type PodDetail } from '@/lib/api'
import { useUIStore, type DetailTab, type SelectedResource } from '@/store/ui'
import { useResourceDetail } from './useResourceDetail'
import { CopyButton } from './Copyable'
import { ErrorBox } from './DetailPrimitives'
import { ResourceYAMLTab } from './ResourceYAMLTab'
import { MultiPodLogsTab } from './MultiPodLogsTab'
import { EventsTab } from './EventsTab'
import { DeleteResourceButton } from './DeleteResourceButton'
import { PauseDeploymentButton, isPausable } from './PauseDeploymentButton'
import { RolloutHistoryTab } from './RolloutHistoryTab'
import { RestartWorkloadButton, isRestartable } from './RestartWorkloadButton'
import { ScaleResourceButton, isScalable } from './ScaleResourceButton'
import { PortForwardButton } from '@/features/portforward/PortForwardButton'
import type { ResourceKind } from '@/store/ui'
import { PodOverviewBody } from '@/features/pods/PodOverviewBody'
import { PodLogsTab } from '@/features/pods/PodLogsTab'
import { ApplicationResourcesTab } from '@/features/argocd/ApplicationResourcesTab'
import { PodExecTab } from '@/features/pods/PodExecTab'
import { DeploymentDetailBody } from '@/features/deployments/DeploymentDetailBody'
import { StatefulSetDetailBody } from '@/features/statefulsets/StatefulSetDetailBody'
import { DaemonSetDetailBody } from '@/features/daemonsets/DaemonSetDetailBody'
import { ReplicaSetDetailBody } from '@/features/replicasets/ReplicaSetDetailBody'
import { PersistentVolumeClaimDetailBody } from '@/features/pvcs/PersistentVolumeClaimDetailBody'
import { PersistentVolumeDetailBody } from '@/features/pvs/PersistentVolumeDetailBody'
import { StorageClassDetailBody } from '@/features/storageclasses/StorageClassDetailBody'
import { NetworkPolicyDetailBody } from '@/features/networkpolicies/NetworkPolicyDetailBody'
import { HorizontalPodAutoscalerDetailBody } from '@/features/hpas/HorizontalPodAutoscalerDetailBody'
import { PodDisruptionBudgetDetailBody } from '@/features/pdbs/PodDisruptionBudgetDetailBody'
import { EndpointSliceDetailBody } from '@/features/endpointslices/EndpointSliceDetailBody'
import { ResourceQuotaDetailBody } from '@/features/resourcequotas/ResourceQuotaDetailBody'
import { LimitRangeDetailBody } from '@/features/limitranges/LimitRangeDetailBody'
import { IngressClassDetailBody } from '@/features/ingressclasses/IngressClassDetailBody'
import { PriorityClassDetailBody } from '@/features/priorityclasses/PriorityClassDetailBody'
import { RuntimeClassDetailBody } from '@/features/runtimeclasses/RuntimeClassDetailBody'
import { LeaseDetailBody } from '@/features/leases/LeaseDetailBody'
import { WebhookConfigurationDetailBody } from '@/features/webhooks/WebhookConfigurationDetailBody'
import { EndpointsDetailBody } from '@/features/endpoints/EndpointsDetailBody'
import { ReplicationControllerDetailBody } from '@/features/replicationcontrollers/ReplicationControllerDetailBody'
import { JobDetailBody } from '@/features/jobs/JobDetailBody'
import { CronJobDetailBody } from '@/features/cronjobs/CronJobDetailBody'
import { ServiceDetailBody } from '@/features/services/ServiceDetailBody'
import { ConfigMapDetailBody } from '@/features/configmaps/ConfigMapDetailBody'
import { SecretDetailBody } from '@/features/secrets/SecretDetailBody'
import { IngressDetailBody } from '@/features/ingresses/IngressDetailBody'
import { GatewayDetailBody } from '@/features/gateways/GatewayDetailBody'
import { HTTPRouteDetailBody } from '@/features/httproutes/HTTPRouteDetailBody'
import { GRPCRouteDetailBody } from '@/features/grpcroutes/GRPCRouteDetailBody'
import { GatewayClassDetailBody } from '@/features/gatewayclasses/GatewayClassDetailBody'
import { ReferenceGrantDetailBody } from '@/features/referencegrants/ReferenceGrantDetailBody'
import { NodeDetailBody } from '@/features/nodes/NodeDetailBody'
import { NamespaceDetailBody } from '@/features/namespaces/NamespaceDetailBody'
import { ServiceAccountDetailBody } from '@/features/serviceaccounts/ServiceAccountDetailBody'
import { RoleDetailBody } from '@/features/roles/RoleDetailBody'
import { RoleBindingDetailBody } from '@/features/rolebindings/RoleBindingDetailBody'
import { ClusterRoleDetailBody } from '@/features/clusterroles/ClusterRoleDetailBody'
import { ClusterRoleBindingDetailBody } from '@/features/clusterrolebindings/ClusterRoleBindingDetailBody'
import { HelmReleaseDetailBody } from '@/features/helm/HelmReleaseDetailBody'
import { HelmInstallDialog } from '@/features/helm/HelmInstallDialog'
import { HelmRollbackDialog } from '@/features/helm/HelmRollbackDialog'
import { HelmRollbackPickerDialog } from '@/features/helm/HelmRollbackPickerDialog'
import { HelmUninstallDialog } from '@/features/helm/HelmUninstallDialog'
import type { HelmReleaseDetail } from '@/lib/api'

type Props = {
  contextName: string | null
  resource: SelectedResource | null
}

export function ResourceDetailPanel({ contextName, resource }: Props) {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const goBackResource = useUIStore((s) => s.goBackResource)
  const canGoBack = useUIStore((s) => s.resourceNavStack.length > 0)
  const open = resource !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSelectedResource(null)
      }}
    >
      <DialogContent className="flex h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="flex flex-row items-start justify-between gap-4 border-b border-border px-6 py-4 pr-12">
          {canGoBack && (
            <Button
              size="icon"
              variant="ghost"
              onClick={goBackResource}
              aria-label="Back to previous resource"
              className="-ml-2 mt-0.5 size-7 shrink-0"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{resource?.kind}</div>
            <div className="group flex min-w-0 items-center gap-1.5">
              <DialogTitle className="truncate text-base">{resource?.name}</DialogTitle>
              {resource?.name && (
                <CopyButton
                  value={resource.name}
                  ariaLabel="Copy name"
                  className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                />
              )}
            </div>
            {resource?.namespace && (
              <div className="group flex min-w-0 items-center gap-1.5">
                <div className="truncate text-xs text-muted-foreground">{resource.namespace}</div>
                <CopyButton
                  value={resource.namespace}
                  ariaLabel="Copy namespace"
                  iconClassName="size-2.5"
                  className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                />
              </div>
            )}
          </div>
          {resource && resource.kind !== 'HelmRelease' && (
            <div className="flex shrink-0 items-center gap-2 pt-1">
              {resource.kind === 'Pod' && (
                <PortForwardButton contextName={contextName} resource={resource} />
              )}
              {isPausable(resource.kind) && (
                <PauseDeploymentButton contextName={contextName} resource={resource} />
              )}
              {isRestartable(resource.kind) && (
                <RestartWorkloadButton contextName={contextName} resource={resource} />
              )}
              {isScalable(resource.kind) && (
                <ScaleResourceButton contextName={contextName} resource={resource} />
              )}
              <DeleteResourceButton contextName={contextName} resource={resource} />
            </div>
          )}
        </DialogHeader>
        {resource && (
          <DetailContent
            key={`${resource.kind}/${resource.namespace}/${resource.name}`}
            contextName={contextName}
            resource={resource}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

const WORKLOAD_LOG_KINDS: ResourceKind[] = ['Deployment', 'StatefulSet', 'DaemonSet']
const ROLLOUT_HISTORY_KINDS: ResourceKind[] = ['Deployment', 'StatefulSet', 'DaemonSet']

const EVENT_BEARING_KINDS: ResourceKind[] = [
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'ReplicationController',
  'Job',
  'CronJob',
  'HorizontalPodAutoscaler',
  'PodDisruptionBudget',
  'PersistentVolumeClaim',
  'PersistentVolume',
  'Node',
  'Service',
  'Ingress',
]

function DetailContent({ contextName, resource }: { contextName: string | null; resource: SelectedResource }) {
  if (resource.kind === 'HelmRelease') {
    return <HelmReleaseTabs contextName={contextName} namespace={resource.namespace} name={resource.name} />
  }
  if (resource.gvr) {
    return <CustomResourceTabs contextName={contextName} resource={resource} />
  }
  if (resource.kind === 'Pod') {
    return <PodTabs contextName={contextName} namespace={resource.namespace} name={resource.name} />
  }
  return <NonPodTabs contextName={contextName} resource={resource} />
}

function HelmReleaseTabs({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const [detail, setDetail] = useState<HelmReleaseDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [rollbackRev, setRollbackRev] = useState<number | null>(null)
  const [rollbackPickerOpen, setRollbackPickerOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [uninstallOpen, setUninstallOpen] = useState(false)

  useEffect(() => {
    if (!contextName) return
    let cancelled = false
    setDetail(null)
    setDetailError(null)
    api
      .getHelmRelease(contextName, namespace, name)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setDetailError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [contextName, namespace, name, reloadTick])

  return (
    <>
      <HelmReleaseDetailBody
        detail={detail}
        error={detailError}
        onRequestRollback={(rev) => setRollbackRev(rev)}
        onRequestRollbackPicker={() => setRollbackPickerOpen(true)}
        onRequestUpgrade={() => setUpgradeOpen(true)}
        onRequestUninstall={() => setUninstallOpen(true)}
      />
      {rollbackRev !== null && (
        <HelmRollbackDialog
          contextName={contextName}
          namespace={namespace}
          name={name}
          revision={rollbackRev}
          open
          onOpenChange={(o) => !o && setRollbackRev(null)}
          onRolledBack={() => setReloadTick((t) => t + 1)}
        />
      )}
      {detail && (
        <HelmRollbackPickerDialog
          contextName={contextName}
          namespace={namespace}
          name={name}
          currentRevision={detail.info.revision}
          revisions={detail.revisions}
          open={rollbackPickerOpen}
          onOpenChange={setRollbackPickerOpen}
          onRolledBack={() => setReloadTick((t) => t + 1)}
        />
      )}
      <HelmInstallDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        mode="upgrade"
        initialName={name}
        initialNamespace={namespace}
        initialChartRef={detail?.chartName ?? ''}
        initialVersion={detail?.chartVersion ?? ''}
        initialValues={detail?.userValues || detail?.mergedValues || ''}
        onSuccess={() => setReloadTick((t) => t + 1)}
      />
      <HelmUninstallDialog
        contextName={contextName}
        namespace={namespace}
        name={name}
        open={uninstallOpen}
        onOpenChange={setUninstallOpen}
        onUninstalled={() => setSelectedResource(null)}
      />
    </>
  )
}

function CustomResourceTabs({ contextName, resource }: { contextName: string | null; resource: SelectedResource }) {
  const isArgoApp =
    resource.kind === 'Application' && resource.gvr?.group === 'argoproj.io'
  const [tab, setTab] = useState<string>(isArgoApp ? 'resources' : 'yaml')
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-6 mt-3 w-fit">
        {isArgoApp && <TabsTrigger value="resources">Resources</TabsTrigger>}
        <TabsTrigger value="yaml">YAML</TabsTrigger>
      </TabsList>
      {isArgoApp && (
        <TabsContent value="resources" className="min-h-0 flex-1 p-0">
          <ApplicationResourcesTab
            contextName={contextName}
            namespace={resource.namespace}
            name={resource.name}
          />
        </TabsContent>
      )}
      <TabsContent value="yaml" className="min-h-0 flex-1 p-0">
        <ResourceYAMLTab
          contextName={contextName}
          kind={resource.kind}
          namespace={resource.namespace}
          name={resource.name}
          gvr={resource.gvr}
        />
      </TabsContent>
    </Tabs>
  )
}

function NonPodTabs({ contextName, resource }: { contextName: string | null; resource: SelectedResource }) {
  const hasAggregatedLogs = (WORKLOAD_LOG_KINDS as readonly string[]).includes(resource.kind)
  const hasEvents = (EVENT_BEARING_KINDS as readonly string[]).includes(resource.kind)
  const hasHistory = (ROLLOUT_HISTORY_KINDS as readonly string[]).includes(resource.kind)
  const requestedTab = useUIStore((s) => s.requestedTab)
  const allowed: DetailTab[] = ['overview']
  if (hasAggregatedLogs) allowed.push('logs')
  if (hasEvents) allowed.push('events')
  if (hasHistory) allowed.push('history')
  allowed.push('yaml')
  const initialTab: DetailTab =
    requestedTab && allowed.includes(requestedTab) ? requestedTab : 'overview'
  const [tab, setTab] = useState<DetailTab>(initialTab)
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-6 mt-3 w-fit">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {hasAggregatedLogs && <TabsTrigger value="logs">Logs</TabsTrigger>}
        {hasEvents && <TabsTrigger value="events">Events</TabsTrigger>}
        {hasHistory && <TabsTrigger value="history">History</TabsTrigger>}
        <TabsTrigger value="yaml">YAML</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <OverviewByKind contextName={contextName} resource={resource} />
      </TabsContent>
      {hasAggregatedLogs && (
        <TabsContent value="logs" className="min-h-0 flex-1 p-0">
          <WorkloadLogs contextName={contextName} resource={resource} />
        </TabsContent>
      )}
      {hasEvents && (
        <TabsContent value="events" className="min-h-0 flex-1 p-0">
          <EventsTab
            contextName={contextName}
            namespace={resource.namespace}
            kind={resource.kind}
            name={resource.name}
          />
        </TabsContent>
      )}
      {hasHistory && (
        <TabsContent value="history" className="min-h-0 flex-1 p-0">
          <RolloutHistoryTab
            contextName={contextName}
            kind={resource.kind as 'Deployment' | 'StatefulSet' | 'DaemonSet'}
            namespace={resource.namespace}
            name={resource.name}
          />
        </TabsContent>
      )}
      <TabsContent value="yaml" className="min-h-0 flex-1 p-0">
        <ResourceYAMLTab
          contextName={contextName}
          kind={resource.kind}
          namespace={resource.namespace}
          name={resource.name}
        />
      </TabsContent>
    </Tabs>
  )
}

function WorkloadLogs({ contextName, resource }: { contextName: string | null; resource: SelectedResource }) {
  const [selector, setSelector] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!contextName) return
    let cancelled = false
    const fetcher =
      resource.kind === 'Deployment'
        ? api.getDeployment
        : resource.kind === 'StatefulSet'
          ? api.getStatefulSet
          : api.getDaemonSet
    fetcher(contextName, resource.namespace, resource.name)
      .then((d) => {
        if (cancelled) return
        setSelector(d.selector ?? {})
      })
      .catch(() => {
        if (cancelled) return
        setSelector({})
      })
    return () => {
      cancelled = true
    }
  }, [contextName, resource.kind, resource.namespace, resource.name])

  if (Object.keys(selector).length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Resolving pod selector…
      </div>
    )
  }
  return (
    <MultiPodLogsTab
      contextName={contextName}
      namespace={resource.namespace}
      selector={selector}
      title={resource.name}
    />
  )
}

function PodTabs({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getPod(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<PodDetail>(contextName, 'Pod', load)
  const requestedTab = useUIStore((s) => s.requestedTab)
  const [tab, setTab] = useState<DetailTab>(requestedTab ?? 'overview')

  useEffect(() => {
    setTab(requestedTab ?? 'overview')
  }, [namespace, name, requestedTab])

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-6 mt-3 w-fit">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="logs" disabled={!detail}>Logs</TabsTrigger>
        <TabsTrigger value="exec" disabled={!detail || detail.containers.length === 0}>Exec</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="yaml">YAML</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        {detail && <PodOverviewBody contextName={contextName} detail={detail} />}
      </TabsContent>
      <TabsContent value="logs" className="min-h-0 flex-1 p-0">
        {detail && <PodLogsTab detail={detail} contextName={contextName} />}
      </TabsContent>
      <TabsContent value="exec" className="min-h-0 flex-1 p-0">
        {detail && <PodExecTab detail={detail} contextName={contextName} />}
      </TabsContent>
      <TabsContent value="events" className="min-h-0 flex-1 p-0">
        <EventsTab contextName={contextName} namespace={namespace} kind="Pod" name={name} />
      </TabsContent>
      <TabsContent value="yaml" className="min-h-0 flex-1 p-0">
        <ResourceYAMLTab contextName={contextName} kind="Pod" namespace={namespace} name={name} />
      </TabsContent>
    </Tabs>
  )
}

function OverviewByKind({ contextName, resource }: { contextName: string | null; resource: SelectedResource }) {
  switch (resource.kind) {
    case 'Deployment':
      return <DeploymentDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'StatefulSet':
      return <StatefulSetDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'DaemonSet':
      return <DaemonSetDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'ReplicaSet':
      return <ReplicaSetDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'PersistentVolumeClaim':
      return <PersistentVolumeClaimDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'PersistentVolume':
      return <PersistentVolumeDetailBody contextName={contextName} name={resource.name} />
    case 'StorageClass':
      return <StorageClassDetailBody contextName={contextName} name={resource.name} />
    case 'NetworkPolicy':
      return <NetworkPolicyDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'HorizontalPodAutoscaler':
      return <HorizontalPodAutoscalerDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'PodDisruptionBudget':
      return <PodDisruptionBudgetDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'EndpointSlice':
      return <EndpointSliceDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'ResourceQuota':
      return <ResourceQuotaDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'LimitRange':
      return <LimitRangeDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'IngressClass':
      return <IngressClassDetailBody contextName={contextName} name={resource.name} />
    case 'PriorityClass':
      return <PriorityClassDetailBody contextName={contextName} name={resource.name} />
    case 'RuntimeClass':
      return <RuntimeClassDetailBody contextName={contextName} name={resource.name} />
    case 'Lease':
      return <LeaseDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'MutatingWebhookConfiguration':
      return (
        <WebhookConfigurationDetailBody
          contextName={contextName}
          name={resource.name}
          kind="MutatingWebhookConfiguration"
          loader={(ctx) => api.getMutatingWebhookConfiguration(ctx, resource.name)}
        />
      )
    case 'ValidatingWebhookConfiguration':
      return (
        <WebhookConfigurationDetailBody
          contextName={contextName}
          name={resource.name}
          kind="ValidatingWebhookConfiguration"
          loader={(ctx) => api.getValidatingWebhookConfiguration(ctx, resource.name)}
        />
      )
    case 'Endpoints':
      return <EndpointsDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'ReplicationController':
      return <ReplicationControllerDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'Job':
      return <JobDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'CronJob':
      return <CronJobDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'Service':
      return <ServiceDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'ConfigMap':
      return <ConfigMapDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'Secret':
      return <SecretDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'Ingress':
      return <IngressDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'Node':
      return <NodeDetailBody contextName={contextName} name={resource.name} />
    case 'Namespace':
      return <NamespaceDetailBody contextName={contextName} name={resource.name} />
    case 'ServiceAccount':
      return <ServiceAccountDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'Role':
      return <RoleDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'RoleBinding':
      return <RoleBindingDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'ClusterRole':
      return <ClusterRoleDetailBody contextName={contextName} name={resource.name} />
    case 'ClusterRoleBinding':
      return <ClusterRoleBindingDetailBody contextName={contextName} name={resource.name} />
    case 'Gateway':
      return <GatewayDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'HTTPRoute':
      return <HTTPRouteDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'GRPCRoute':
      return <GRPCRouteDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'GatewayClass':
      return <GatewayClassDetailBody contextName={contextName} name={resource.name} />
    case 'ReferenceGrant':
      return <ReferenceGrantDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    default:
      return null
  }
}
