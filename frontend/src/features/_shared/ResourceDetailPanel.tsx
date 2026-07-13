import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, type PodDetail } from '@/lib/api'
import { useUIStore, type DetailTab, type SelectedResource } from '@/store/ui'
import { useResourceDetail } from './useResourceDetail'
import { CopyButton } from './Copyable'
import { ErrorBox } from './DetailPrimitives'
import { SkeletonDetail } from './SkeletonDetail'
import { ResourceYAMLTab } from './ResourceYAMLTab'
import { EventsTab } from './EventsTab'
import { DeleteResourceButton } from './DeleteResourceButton'
import { PauseDeploymentButton } from './PauseDeploymentButton'
import { RolloutHistoryTab } from './RolloutHistoryTab'
import { RestartWorkloadButton } from './RestartWorkloadButton'
import { ScaleResourceButton } from './ScaleResourceButton'
import { isPausable, isRestartable, isScalable } from './workloadCapabilities'
import { PortForwardButton } from '@/features/portforward/PortForwardButton'
import type { ResourceKind } from '@/store/ui'
import { PodOverviewBody } from '@/features/pods/PodOverviewBody'
import { ApplicationResourcesTab } from '@/features/argocd/ApplicationResourcesTab'
import { ApplicationHistoryTab } from '@/features/argocd/ApplicationHistoryTab'
import { AppProjectDetailBody } from '@/features/argocd/AppProjectDetailBody'
import { ApplicationSetDetailBody } from '@/features/argocd/ApplicationSetDetailBody'
import { DeleteArgoApplicationButton } from '@/features/argocd/DeleteArgoApplicationButton'
import { isArgoApplication } from '@/features/argocd/argoApplication'
import { SyncArgoApplicationButton } from '@/features/argocd/SyncArgoApplicationButton'
import { ResizePodButton } from '@/features/pods/ResizePodButton'
import { DeploymentDetailBody } from '@/features/deployments/DeploymentDetailBody'
import { StatefulSetDetailBody } from '@/features/statefulsets/StatefulSetDetailBody'
import { DaemonSetDetailBody } from '@/features/daemonsets/DaemonSetDetailBody'
import { ReplicaSetDetailBody } from '@/features/replicasets/ReplicaSetDetailBody'
import { PersistentVolumeClaimDetailBody } from '@/features/pvcs/PersistentVolumeClaimDetailBody'
import { PersistentVolumeDetailBody } from '@/features/pvs/PersistentVolumeDetailBody'
import { StorageClassDetailBody } from '@/features/storageclasses/StorageClassDetailBody'
import { CSIDriverDetailBody } from '@/features/csidrivers/CSIDriverDetailBody'
import { CSINodeDetailBody } from '@/features/csinodes/CSINodeDetailBody'
import { VolumeAttachmentDetailBody } from '@/features/volumeattachments/VolumeAttachmentDetailBody'
import { NetworkPolicyDetailBody } from '@/features/networkpolicies/NetworkPolicyDetailBody'
import { HorizontalPodAutoscalerDetailBody } from '@/features/hpas/HorizontalPodAutoscalerDetailBody'
import { PodDisruptionBudgetDetailBody } from '@/features/pdbs/PodDisruptionBudgetDetailBody'
import { EndpointSliceDetailBody } from '@/features/endpointslices/EndpointSliceDetailBody'
import { ResourceQuotaDetailBody } from '@/features/resourcequotas/ResourceQuotaDetailBody'
import { LimitRangeDetailBody } from '@/features/limitranges/LimitRangeDetailBody'
import { IngressClassDetailBody } from '@/features/ingressclasses/IngressClassDetailBody'
import { PriorityClassDetailBody } from '@/features/priorityclasses/PriorityClassDetailBody'
import { RuntimeClassDetailBody } from '@/features/runtimeclasses/RuntimeClassDetailBody'
import { APIServiceDetailBody } from '@/features/apiservices/APIServiceDetailBody'
import { CSRDetailBody } from '@/features/csrs/CSRDetailBody'
import { FlowSchemaDetailBody } from '@/features/flowschemas/FlowSchemaDetailBody'
import { PriorityLevelDetailBody } from '@/features/prioritylevels/PriorityLevelDetailBody'
import { LeaseDetailBody } from '@/features/leases/LeaseDetailBody'
import { WebhookConfigurationDetailBody } from '@/features/webhooks/WebhookConfigurationDetailBody'
import { AdmissionPolicyDetailBody } from '@/features/validatingadmissionpolicies/AdmissionPolicyDetailBody'
import { AdmissionPolicyBindingDetailBody } from '@/features/validatingadmissionpolicybindings/AdmissionPolicyBindingDetailBody'
import { DeviceClassDetailBody } from '@/features/deviceclasses/DeviceClassDetailBody'
import { ResourceSliceDetailBody } from '@/features/resourceslices/ResourceSliceDetailBody'
import { ResourceClaimDetailBody } from '@/features/resourceclaims/ResourceClaimDetailBody'
import { ResourceClaimTemplateDetailBody } from '@/features/resourceclaimtemplates/ResourceClaimTemplateDetailBody'
import { ServiceCIDRDetailBody } from '@/features/servicecidrs/ServiceCIDRDetailBody'
import { IPAddressDetailBody } from '@/features/ipaddresses/IPAddressDetailBody'
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
import { CordonNodeButton } from '@/features/nodes/CordonNodeButton'
import { DrainNodeButton } from '@/features/nodes/DrainNodeButton'
import { KarpenterNodesTab } from '@/features/karpenter-nodepools/KarpenterNodesTab'
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
import { FluxKustomizationDetailBody } from '@/features/flux/FluxKustomizationDetailBody'
import { FluxHelmReleaseDetailBody } from '@/features/flux/FluxHelmReleaseDetailBody'
import { FluxGitRepositoryDetailBody } from '@/features/flux/FluxGitRepositoryDetailBody'
import { FluxHelmRepositoryDetailBody } from '@/features/flux/FluxHelmRepositoryDetailBody'
import { FluxOCIRepositoryDetailBody } from '@/features/flux/FluxOCIRepositoryDetailBody'
import { FluxBucketDetailBody } from '@/features/flux/FluxBucketDetailBody'
import { FluxProviderDetailBody } from '@/features/flux/FluxProviderDetailBody'
import { FluxAlertDetailBody } from '@/features/flux/FluxAlertDetailBody'
import { FluxReceiverDetailBody } from '@/features/flux/FluxReceiverDetailBody'
import { IstioVirtualServiceDetailBody } from '@/features/istio/IstioVirtualServiceDetailBody'
import { IstioDestinationRuleDetailBody } from '@/features/istio/IstioDestinationRuleDetailBody'
import { IstioPeerAuthenticationDetailBody } from '@/features/istio/IstioPeerAuthenticationDetailBody'
import { CertificateDetailBody } from '@/features/cert-manager/CertificateDetailBody'
import { IssuerDetailBody } from '@/features/cert-manager/IssuerDetailBody'
import { CertificateRequestDetailBody } from '@/features/cert-manager/CertificateRequestDetailBody'
import { OrderDetailBody } from '@/features/cert-manager/OrderDetailBody'
import { ChallengeDetailBody } from '@/features/cert-manager/ChallengeDetailBody'
import { CertManagerChainTab } from '@/features/cert-manager/CertManagerChainTab'
import { CertManagerStatePill } from '@/features/cert-manager/CertManagerStatePill'
import { RenewCertificateButton } from '@/features/cert-manager/RenewCertificateButton'
import { isCertManagerCertificate } from '@/features/cert-manager/certManagerKinds'
import {
  CERT_MANAGER_ACME_GROUP,
  CERT_MANAGER_CERTIFICATEREQUEST_RESOURCE,
  CERT_MANAGER_CHALLENGE_RESOURCE,
  CERT_MANAGER_GROUP,
  CERT_MANAGER_ORDER_RESOURCE,
} from '@/features/cert-manager/certManagerKinds'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { formatAge } from '@/lib/time'
import { ReconcileFluxResourceButton } from '@/features/flux/ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from '@/features/flux/SuspendResumeFluxResourceButton'
import {
  isFluxResource,
  stripFluxKindPrefix,
} from '@/features/flux/fluxKinds'
import type { FluxKind, HelmReleaseDetail } from '@/lib/api'

// The Logs / Exec / Shell tabs pull in xterm.js (+ its CSS). Loading them lazily
// keeps that ~86 kB-gzip chunk out of the eager startup graph for the many
// sessions that never open a terminal, mirroring how Monaco is code-split.
const PodLogsTab = lazy(() =>
  import('@/features/pods/PodLogsTab').then((m) => ({ default: m.PodLogsTab })),
)
const PodExecTab = lazy(() =>
  import('@/features/pods/PodExecTab').then((m) => ({ default: m.PodExecTab })),
)
const MultiPodLogsTab = lazy(() =>
  import('./MultiPodLogsTab').then((m) => ({ default: m.MultiPodLogsTab })),
)
const NodeShellTab = lazy(() =>
  import('@/features/nodes/NodeShellTab').then((m) => ({ default: m.NodeShellTab })),
)

function TerminalFallback() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading terminal…
    </div>
  )
}

type Props = {
  contextName: string | null
  resource: SelectedResource | null
}

export function ResourceDetailPanel({ contextName, resource }: Props) {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const goBackResource = useUIStore((s) => s.goBackResource)
  const canGoBack = useUIStore((s) => s.resourceNavStack.length > 0)
  const readOnly = useUIStore((s) => s.globalReadOnly)
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
              {!readOnly && resource.kind === 'Pod' && (
                <ResizePodButton
                  contextName={contextName}
                  namespace={resource.namespace}
                  podName={resource.name}
                />
              )}
              {resource.kind === 'Pod' && (
                <PortForwardButton contextName={contextName} resource={resource} />
              )}
              {!readOnly && resource.kind === 'Node' && (
                <>
                  <CordonNodeButton contextName={contextName} resource={resource} />
                  <DrainNodeButton contextName={contextName} resource={resource} />
                </>
              )}
              {!readOnly && isPausable(resource.kind) && (
                <PauseDeploymentButton contextName={contextName} resource={resource} />
              )}
              {!readOnly && isRestartable(resource.kind) && (
                <RestartWorkloadButton contextName={contextName} resource={resource} />
              )}
              {!readOnly && isScalable(resource.kind) && (
                <ScaleResourceButton contextName={contextName} resource={resource} />
              )}
              {!readOnly && isArgoApplication(resource) && (
                <SyncArgoApplicationButton contextName={contextName} resource={resource} />
              )}
              {!readOnly && isFluxResource(resource) && (
                <>
                  <ReconcileFluxResourceButton
                    contextName={contextName}
                    kind={resource.kind as FluxKind}
                    namespace={resource.namespace}
                    name={resource.name}
                  />
                  <SuspendResumeFluxResourceButton
                    contextName={contextName}
                    kind={resource.kind as FluxKind}
                    namespace={resource.namespace}
                    name={resource.name}
                    suspended={resource.suspended ?? false}
                  />
                </>
              )}
              {!readOnly && isCertManagerCertificate(resource) && (
                <RenewCertificateButton
                  contextName={contextName}
                  namespace={resource.namespace}
                  name={resource.name}
                />
              )}
              {!readOnly &&
                (isArgoApplication(resource) ? (
                  <DeleteArgoApplicationButton contextName={contextName} resource={resource} />
                ) : (
                  <DeleteResourceButton contextName={contextName} resource={resource} />
                ))}
            </div>
          )}
        </DialogHeader>
        {resource && (
          <DetailContent
            key={[
              resource.context ?? '',
              resource.gvr ? `${resource.gvr.group}/${resource.gvr.version}/${resource.gvr.resource}` : '',
              resource.kind,
              resource.namespace,
              resource.name,
            ].join('|')}
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Release identity invalidates the previous remote detail.
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

function customResourceOverview(contextName: string | null, resource: SelectedResource) {
  const detailProps = {
    contextName,
    namespace: resource.namespace,
    name: resource.name,
  }

  switch (resource.kind) {
    case 'AppProject':
      return resource.gvr?.group === 'argoproj.io' ? (
        <AppProjectDetailBody {...detailProps} />
      ) : null
    case 'ApplicationSet':
      return resource.gvr?.group === 'argoproj.io' ? (
        <ApplicationSetDetailBody {...detailProps} />
      ) : null
    case 'FluxKustomization':
      return <FluxKustomizationDetailBody {...detailProps} />
    case 'FluxHelmRelease':
      return <FluxHelmReleaseDetailBody {...detailProps} />
    case 'FluxGitRepository':
      return <FluxGitRepositoryDetailBody {...detailProps} />
    case 'FluxHelmRepository':
      return <FluxHelmRepositoryDetailBody {...detailProps} />
    case 'FluxOCIRepository':
      return <FluxOCIRepositoryDetailBody {...detailProps} />
    case 'FluxBucket':
      return <FluxBucketDetailBody {...detailProps} />
    case 'FluxProvider':
      return <FluxProviderDetailBody {...detailProps} />
    case 'FluxAlert':
      return <FluxAlertDetailBody {...detailProps} />
    case 'FluxReceiver':
      return <FluxReceiverDetailBody {...detailProps} />
    case 'IstioVirtualService':
      return resource.gvr?.group === 'networking.istio.io' ? (
        <IstioVirtualServiceDetailBody {...detailProps} />
      ) : null
    case 'IstioDestinationRule':
      return resource.gvr?.group === 'networking.istio.io' ? (
        <IstioDestinationRuleDetailBody {...detailProps} />
      ) : null
    case 'IstioPeerAuthentication':
      return resource.gvr?.group === 'security.istio.io' ? (
        <IstioPeerAuthenticationDetailBody {...detailProps} />
      ) : null
    case 'Certificate':
      return resource.gvr?.group === CERT_MANAGER_GROUP ? (
        <CertificateDetailBody {...detailProps} />
      ) : null
    case 'Issuer':
      return resource.gvr?.group === CERT_MANAGER_GROUP ? (
        <IssuerDetailBody {...detailProps} cluster={false} />
      ) : null
    case 'ClusterIssuer':
      return resource.gvr?.group === CERT_MANAGER_GROUP ? (
        <IssuerDetailBody {...detailProps} cluster />
      ) : null
    case 'CertificateRequest':
      return resource.gvr?.group === CERT_MANAGER_GROUP ? (
        <CertificateRequestDetailBody {...detailProps} />
      ) : null
    case 'Order':
      return resource.gvr?.group === CERT_MANAGER_ACME_GROUP ? (
        <OrderDetailBody {...detailProps} />
      ) : null
    case 'Challenge':
      return resource.gvr?.group === CERT_MANAGER_ACME_GROUP ? (
        <ChallengeDetailBody {...detailProps} />
      ) : null
    default:
      return null
  }
}

function CustomResourceTabs({ contextName, resource }: { contextName: string | null; resource: SelectedResource }) {
  const isArgoApp =
    resource.kind === 'Application' && resource.gvr?.group === 'argoproj.io'
  const isFlux = isFluxResource(resource)
  const isKarpenterNodePool =
    resource.kind === 'NodePool' && resource.gvr?.group === 'karpenter.sh'
  const isKarpenterNodeClaim =
    resource.kind === 'NodeClaim' && resource.gvr?.group === 'karpenter.sh'
  const hasKarpenterNodes = isKarpenterNodePool || isKarpenterNodeClaim
  const isCertManagerCert =
    resource.kind === 'Certificate' && resource.gvr?.group === CERT_MANAGER_GROUP
  const isCertManagerIssuer =
    resource.kind === 'Issuer' && resource.gvr?.group === CERT_MANAGER_GROUP
  const isCertManagerClusterIssuer =
    resource.kind === 'ClusterIssuer' && resource.gvr?.group === CERT_MANAGER_GROUP
  const isCertManagerRequest =
    resource.kind === 'CertificateRequest' && resource.gvr?.group === CERT_MANAGER_GROUP
  const isCertManagerOrder =
    resource.kind === 'Order' && resource.gvr?.group === CERT_MANAGER_ACME_GROUP
  const isCertManagerChallenge =
    resource.kind === 'Challenge' && resource.gvr?.group === CERT_MANAGER_ACME_GROUP
  const isCertManager =
    isCertManagerCert ||
    isCertManagerIssuer ||
    isCertManagerClusterIssuer ||
    isCertManagerRequest ||
    isCertManagerOrder ||
    isCertManagerChallenge
  const overview = customResourceOverview(contextName, resource)
  const hasOverview = overview !== null
  const hasEvents = isFlux || isCertManager
  const initialTab = isArgoApp
    ? 'resources'
    : hasKarpenterNodes
      ? 'nodes'
      : hasOverview
        ? 'overview'
        : 'yaml'
  const requestedTab = useUIStore((s) => s.requestedTab)
  const allowedTabs: string[] = []
  if (hasOverview) allowedTabs.push('overview')
  if (isArgoApp) allowedTabs.push('resources', 'history')
  if (hasKarpenterNodes) allowedTabs.push('nodes')
  if (isCertManagerCert) allowedTabs.push('requests')
  if (isCertManagerRequest) allowedTabs.push('orders')
  if (isCertManagerOrder) allowedTabs.push('challenges')
  if (hasEvents) allowedTabs.push('events')
  allowedTabs.push('yaml')
  const resolveTab = (req: string | null) => (req && allowedTabs.includes(req) ? req : initialTab)
  const [tab, setTab] = useState<string>(resolveTab(requestedTab))
  // Re-opening the same CR with a different requested tab doesn't remount this
  // component (the panel key excludes the tab), so sync like PodTabs does.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Requested navigation synchronizes the controlled tab.
    setTab(resolveTab(requestedTab))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allowedTabs/initialTab derive from the identity deps below
  }, [resource.kind, resource.namespace, resource.name, resource.gvr?.group, requestedTab])
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-6 mt-3 w-fit">
        {hasOverview && <TabsTrigger value="overview">Overview</TabsTrigger>}
        {isArgoApp && <TabsTrigger value="resources">Resources</TabsTrigger>}
        {isArgoApp && <TabsTrigger value="history">History</TabsTrigger>}
        {hasKarpenterNodes && (
          <TabsTrigger value="nodes">{isKarpenterNodeClaim ? 'Node' : 'Nodes'}</TabsTrigger>
        )}
        {isCertManagerCert && <TabsTrigger value="requests">Requests</TabsTrigger>}
        {isCertManagerRequest && <TabsTrigger value="orders">Orders</TabsTrigger>}
        {isCertManagerOrder && <TabsTrigger value="challenges">Challenges</TabsTrigger>}
        {hasEvents && <TabsTrigger value="events">Events</TabsTrigger>}
        <TabsTrigger value="yaml">YAML</TabsTrigger>
      </TabsList>
      {hasOverview && (
        <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {overview}
        </TabsContent>
      )}
      {isCertManagerCert && (
        <TabsContent value="requests" className="min-h-0 flex-1 p-0">
          <CertManagerChainTab
            contextName={contextName}
            parentNamespace={resource.namespace}
            parentName={resource.name}
            childGroup={CERT_MANAGER_GROUP}
            childResource={CERT_MANAGER_CERTIFICATEREQUEST_RESOURCE}
            childKind="CertificateRequest"
            headers={['Name', 'Approved', 'Ready', 'Issuer', 'Age']}
            load={api.certManagerCertificateRequestsFor}
            renderCells={(r) => [
              <span className="font-mono">{r.name}</span>,
              <ConditionPill status={r.approved} />,
              <ConditionPill status={r.ready} />,
              r.issuer || '—',
              formatAge(r.createdAt),
            ]}
            absentLabel="The cert-manager.io CRDs are not present."
            emptyLabel="No CertificateRequests for this Certificate yet."
          />
        </TabsContent>
      )}
      {isCertManagerRequest && (
        <TabsContent value="orders" className="min-h-0 flex-1 p-0">
          <CertManagerChainTab
            contextName={contextName}
            parentNamespace={resource.namespace}
            parentName={resource.name}
            childGroup={CERT_MANAGER_ACME_GROUP}
            childResource={CERT_MANAGER_ORDER_RESOURCE}
            childKind="Order"
            headers={['Name', 'State', 'Reason', 'Age']}
            load={api.certManagerOrdersFor}
            renderCells={(r) => [
              <span className="font-mono">{r.name}</span>,
              <CertManagerStatePill state={r.state} />,
              <span className="text-muted-foreground">{r.reason || '—'}</span>,
              formatAge(r.createdAt),
            ]}
            absentLabel="No ACME issuer — acme.cert-manager.io Orders CRD is not present."
            emptyLabel="No Orders for this request (non-ACME issuer or not yet created)."
          />
        </TabsContent>
      )}
      {isCertManagerOrder && (
        <TabsContent value="challenges" className="min-h-0 flex-1 p-0">
          <CertManagerChainTab
            contextName={contextName}
            parentNamespace={resource.namespace}
            parentName={resource.name}
            childGroup={CERT_MANAGER_ACME_GROUP}
            childResource={CERT_MANAGER_CHALLENGE_RESOURCE}
            childKind="Challenge"
            headers={['Name', 'State', 'Type', 'DNS Name', 'Reason', 'Age']}
            load={api.certManagerChallengesFor}
            renderCells={(r) => [
              <span className="font-mono">{r.name}</span>,
              <CertManagerStatePill state={r.state} />,
              r.type || '—',
              <span className="font-mono">{r.dnsName || '—'}</span>,
              <span className="text-muted-foreground">{r.reason || '—'}</span>,
              formatAge(r.createdAt),
            ]}
            absentLabel="acme.cert-manager.io Challenges CRD is not present."
            emptyLabel="No Challenges for this Order (already validated or not yet created)."
          />
        </TabsContent>
      )}
      {isArgoApp && (
        <TabsContent value="resources" className="min-h-0 flex-1 p-0">
          <ApplicationResourcesTab
            contextName={contextName}
            namespace={resource.namespace}
            name={resource.name}
          />
        </TabsContent>
      )}
      {isArgoApp && (
        <TabsContent value="history" className="min-h-0 flex-1 p-0">
          <ApplicationHistoryTab
            contextName={contextName}
            namespace={resource.namespace}
            name={resource.name}
          />
        </TabsContent>
      )}
      {hasKarpenterNodes && (
        <TabsContent value="nodes" className="min-h-0 flex-1 overflow-y-auto p-0">
          <KarpenterNodesTab
            contextName={contextName}
            name={resource.name}
            load={isKarpenterNodeClaim ? api.listNodeClaimNode : api.listNodePoolNodes}
            title={isKarpenterNodeClaim ? 'Node' : 'Nodes'}
            emptyMessage={
              isKarpenterNodeClaim
                ? 'This NodeClaim has not registered a node yet.'
                : 'No nodes are currently provisioned by this NodePool.'
            }
          />
        </TabsContent>
      )}
      {hasEvents && (
        <TabsContent value="events" className="min-h-0 flex-1 p-0">
          <EventsTab
            contextName={contextName}
            namespace={resource.namespace}
            kind={stripFluxKindPrefix(resource.kind)}
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
  const readOnly = useUIStore((s) => s.globalReadOnly)
  const hasAggregatedLogs = (WORKLOAD_LOG_KINDS as readonly string[]).includes(resource.kind)
  const hasEvents = (EVENT_BEARING_KINDS as readonly string[]).includes(resource.kind)
  const hasHistory = (ROLLOUT_HISTORY_KINDS as readonly string[]).includes(resource.kind)
  // The node shell works through a temporary privileged pod, so it is a
  // mutation and stays hidden in read-only mode.
  const hasNodeShell = resource.kind === 'Node' && !readOnly
  const requestedTab = useUIStore((s) => s.requestedTab)
  const allowed: DetailTab[] = ['overview']
  if (hasAggregatedLogs) allowed.push('logs')
  if (hasNodeShell) allowed.push('shell')
  if (hasEvents) allowed.push('events')
  if (hasHistory) allowed.push('history')
  allowed.push('yaml')
  const initialTab: DetailTab =
    requestedTab && allowed.includes(requestedTab) ? requestedTab : 'overview'
  const [tab, setTab] = useState<DetailTab>(initialTab)
  // Re-opening the same resource with a different requested tab doesn't remount
  // this component (the panel key excludes the tab), so sync like PodTabs does.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Requested navigation synchronizes the controlled tab.
    setTab(requestedTab && allowed.includes(requestedTab) ? requestedTab : 'overview')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allowed is derived from the identity deps below
  }, [resource.kind, resource.namespace, resource.name, requestedTab])
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-6 mt-3 w-fit">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {hasAggregatedLogs && <TabsTrigger value="logs">Logs</TabsTrigger>}
        {hasNodeShell && <TabsTrigger value="shell">Shell</TabsTrigger>}
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
      {hasNodeShell && (
        <TabsContent value="shell" className="min-h-0 flex-1 p-0">
          <Suspense fallback={<TerminalFallback />}>
            <NodeShellTab contextName={contextName} nodeName={resource.name} />
          </Suspense>
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
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'resolved'; selector: Record<string, string> }
  >({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!contextName) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reload starts a new remote detail lifecycle.
    setState({ status: 'loading' })
    const fetcher =
      resource.kind === 'Deployment'
        ? api.getDeployment
        : resource.kind === 'StatefulSet'
          ? api.getStatefulSet
          : api.getDaemonSet
    fetcher(contextName, resource.namespace, resource.name)
      .then((d) => {
        if (cancelled) return
        setState({ status: 'resolved', selector: d.selector ?? {} })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [contextName, resource.kind, resource.namespace, resource.name, reloadKey])

  if (state.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Resolving pod selector…
      </div>
    )
  }
  if (state.status === 'error' || Object.keys(state.selector).length === 0) {
    const message =
      state.status === 'error'
        ? `Could not resolve the pod selector: ${state.message}`
        : 'This workload has no matchLabels selector (matchExpressions-only selectors are not supported for log streaming).'
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-xs text-muted-foreground">
        <span>{message}</span>
        {state.status === 'error' && (
          <Button type="button" size="xs" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCcw />
            Retry
          </Button>
        )}
      </div>
    )
  }
  return (
    <Suspense fallback={<TerminalFallback />}>
      <MultiPodLogsTab
        contextName={contextName}
        namespace={resource.namespace}
        selector={state.selector}
        title={resource.name}
      />
    </Suspense>
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
  const { detail, error } = useResourceDetail<PodDetail>(contextName, 'Pod', namespace, name, load)
  const requestedTab = useUIStore((s) => s.requestedTab)
  const requestedContainer = useUIStore((s) => s.selectedResource?.logContainer)
  const [tab, setTab] = useState<DetailTab>(requestedTab ?? 'overview')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Requested navigation synchronizes the controlled tab.
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
        {!detail && !error && <SkeletonDetail />}
        {detail && <PodOverviewBody contextName={contextName} detail={detail} />}
      </TabsContent>
      <TabsContent value="logs" className="min-h-0 flex-1 p-0">
        {detail && (
          <Suspense fallback={<TerminalFallback />}>
            <PodLogsTab detail={detail} contextName={contextName} initialContainer={requestedContainer} />
          </Suspense>
        )}
      </TabsContent>
      <TabsContent value="exec" className="min-h-0 flex-1 p-0">
        {detail && (
          <Suspense fallback={<TerminalFallback />}>
            <PodExecTab detail={detail} contextName={contextName} />
          </Suspense>
        )}
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
    case 'CSIDriver':
      return <CSIDriverDetailBody contextName={contextName} name={resource.name} />
    case 'CSINode':
      return <CSINodeDetailBody contextName={contextName} name={resource.name} />
    case 'VolumeAttachment':
      return <VolumeAttachmentDetailBody contextName={contextName} name={resource.name} />
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
    case 'APIService':
      return <APIServiceDetailBody contextName={contextName} name={resource.name} />
    case 'CertificateSigningRequest':
      return <CSRDetailBody contextName={contextName} name={resource.name} />
    case 'FlowSchema':
      return <FlowSchemaDetailBody contextName={contextName} name={resource.name} />
    case 'PriorityLevelConfiguration':
      return <PriorityLevelDetailBody contextName={contextName} name={resource.name} />
    case 'Lease':
      return <LeaseDetailBody contextName={contextName} namespace={resource.namespace} name={resource.name} />
    case 'MutatingWebhookConfiguration':
      return (
        <WebhookConfigurationDetailBody
          contextName={contextName}
          kind="MutatingWebhookConfiguration"
          name={resource.name}
          loader={(ctx) => api.getMutatingWebhookConfiguration(ctx, resource.name)}
        />
      )
    case 'ValidatingWebhookConfiguration':
      return (
        <WebhookConfigurationDetailBody
          contextName={contextName}
          kind="ValidatingWebhookConfiguration"
          name={resource.name}
          loader={(ctx) => api.getValidatingWebhookConfiguration(ctx, resource.name)}
        />
      )
    case 'ValidatingAdmissionPolicy':
      return (
        <AdmissionPolicyDetailBody
          contextName={contextName}
          kind="ValidatingAdmissionPolicy"
          name={resource.name}
          loader={(ctx) => api.getValidatingAdmissionPolicy(ctx, resource.name)}
        />
      )
    case 'ValidatingAdmissionPolicyBinding':
      return (
        <AdmissionPolicyBindingDetailBody
          contextName={contextName}
          kind="ValidatingAdmissionPolicyBinding"
          name={resource.name}
          loader={(ctx) => api.getValidatingAdmissionPolicyBinding(ctx, resource.name)}
        />
      )
    case 'MutatingAdmissionPolicy':
      return (
        <AdmissionPolicyDetailBody
          contextName={contextName}
          kind="MutatingAdmissionPolicy"
          name={resource.name}
          loader={(ctx) => api.getMutatingAdmissionPolicy(ctx, resource.name)}
        />
      )
    case 'MutatingAdmissionPolicyBinding':
      return (
        <AdmissionPolicyBindingDetailBody
          contextName={contextName}
          kind="MutatingAdmissionPolicyBinding"
          name={resource.name}
          loader={(ctx) => api.getMutatingAdmissionPolicyBinding(ctx, resource.name)}
        />
      )
    case 'DeviceClass':
      return <DeviceClassDetailBody contextName={contextName} name={resource.name} />
    case 'ResourceSlice':
      return <ResourceSliceDetailBody contextName={contextName} name={resource.name} />
    case 'ResourceClaim':
      return (
        <ResourceClaimDetailBody
          contextName={contextName}
          namespace={resource.namespace}
          name={resource.name}
        />
      )
    case 'ResourceClaimTemplate':
      return (
        <ResourceClaimTemplateDetailBody
          contextName={contextName}
          namespace={resource.namespace}
          name={resource.name}
        />
      )
    case 'ServiceCIDR':
      return <ServiceCIDRDetailBody contextName={contextName} name={resource.name} />
    case 'IPAddress':
      return <IPAddressDetailBody contextName={contextName} name={resource.name} />
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
