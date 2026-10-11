import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  api,
  type FluxImageRepositoryInfo,
  type FluxImagePolicyInfo,
  type FluxImageUpdateAutomationInfo,
  type FluxKind,
} from '@/lib/api'
import type { FluxImageStatus } from './fluxImageTypes'
import { formatAge } from '@/lib/time'
import { useCRDStore } from '@/store/crds'
import { useUIStore } from '@/store/ui'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { CustomResourceReference } from '@/features/_shared/CustomResourceReference'
import { resourceContext } from '@/features/_shared/resourceContext'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import {
  FLUX_IMAGE_GROUP,
  FLUX_IMAGE_REPOSITORY_RESOURCE,
  FLUX_IMAGE_POLICY_RESOURCE,
  FLUX_IMAGE_UPDATE_AUTOMATION_RESOURCE,
  canReconcileFluxKind,
  canSuspendFluxKind,
} from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

function imageColumns<T extends FluxImageStatus>(kind: FluxKind, resource: string) {
  const helper = createColumnHelper<T>()
  return {
    leading: [
      helper.accessor((row) => row.namespace, {
        id: 'namespace',
        header: 'Namespace',
        size: COL_MD,
      }),
      helper.accessor((row) => row.name, { id: 'name', header: 'Name' }),
      helper.accessor((row) => row.ready, {
        id: 'ready',
        header: 'Ready',
        size: 110,
        cell: (info) => (
          <span title={info.row.original.status}>
            <FluxReadyPill value={info.getValue()} suspended={info.row.original.suspended} />
          </span>
        ),
      }),
    ],
    trailing: [
      helper.display({
        id: 'actions',
        header: 'Actions',
        size: 220,
        cell: (info) => (
          <FluxImageRowActions row={info.row.original} kind={kind} resource={resource} />
        ),
      }),
      helper.accessor((row) => row.createdAt, {
        id: 'createdAt',
        header: 'Age',
        size: COL_SM,
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
  }
}

function FluxImageRowActions({
  row,
  kind,
  resource,
}: {
  row: FluxImageStatus
  kind: FluxKind
  resource: string
}) {
  const contextName = resourceContext(row)
  const readOnly = useUIStore((state) => state.globalReadOnly)
  const version = useCRDStore((state) =>
    contextName
      ? state.byContext[contextName]?.find(
          (crd) => crd.group === FLUX_IMAGE_GROUP && crd.resource === resource,
        )?.version
      : undefined,
  )
  if (!contextName || readOnly) return null
  return (
    <div className="flex items-center gap-1">
      {canReconcileFluxKind(kind) && (
        <ReconcileFluxResourceButton
          contextName={contextName}
          kind={kind}
          namespace={row.namespace}
          name={row.name}
          variant="row"
        />
      )}
      {canSuspendFluxKind(kind, version) && (
        <SuspendResumeFluxResourceButton
          contextName={contextName}
          kind={kind}
          namespace={row.namespace}
          name={row.name}
          suspended={row.suspended}
          variant="row"
        />
      )}
    </div>
  )
}

const repositoryHelper = createColumnHelper<FluxImageRepositoryInfo>()
export function FluxImageRepositoriesView() {
  const columns = useMemo(() => {
    const shared = imageColumns<FluxImageRepositoryInfo>(
      'FluxImageRepository',
      FLUX_IMAGE_REPOSITORY_RESOURCE,
    )
    return [
      ...shared.leading,
      repositoryHelper.accessor('image', {
        header: 'Image',
        size: 240,
        cell: (info) => (
          <span className="font-mono text-xs" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      repositoryHelper.accessor('provider', { header: 'Provider', size: COL_SM }),
      repositoryHelper.accessor('tagCount', {
        header: 'Tags',
        size: COL_SM,
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      repositoryHelper.accessor('lastScanTime', {
        header: 'Last scan',
        size: COL_MD,
        cell: (info) => (info.getValue() ? formatAge(info.getValue()) : '—'),
        sortingFn: 'datetime',
      }),
      repositoryHelper.accessor('interval', { header: 'Interval', size: COL_SM }),
      ...shared.trailing,
    ]
  }, [])
  return (
    <CustomResourceTable
      group={FLUX_IMAGE_GROUP}
      resource={FLUX_IMAGE_REPOSITORY_RESOURCE}
      kind="FluxImageRepository"
      noun={{ singular: 'image repository', plural: 'image repositories' }}
      scope="namespaced"
      fetch={api.listFluxImageRepositories}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      extras={(row) => ({ suspended: row.suspended })}
      unavailableMessage="ImageRepository is not installed in the active contexts."
    />
  )
}

const policyHelper = createColumnHelper<FluxImagePolicyInfo>()
export function FluxImagePoliciesView() {
  const columns = useMemo(() => {
    const shared = imageColumns<FluxImagePolicyInfo>('FluxImagePolicy', FLUX_IMAGE_POLICY_RESOURCE)
    return [
      ...shared.leading,
      policyHelper.accessor('repositoryName', {
        header: 'Repository',
        size: COL_MD,
        cell: (info) => (
          <CustomResourceReference
            contextName={resourceContext(info.row.original)}
            group={FLUX_IMAGE_GROUP}
            resource={FLUX_IMAGE_REPOSITORY_RESOURCE}
            kind="FluxImageRepository"
            namespace={info.row.original.repositoryNamespace}
            name={info.getValue()}
            loadSuspended={api.getFluxImageRepository}
          />
        ),
      }),
      policyHelper.accessor('policyType', {
        header: 'Policy',
        size: 220,
        cell: (info) => {
          const policy = [info.getValue(), info.row.original.policyValue].filter(Boolean).join(': ')
          return <span title={policy}>{policy || '—'}</span>
        },
      }),
      policyHelper.accessor('latestImage', {
        header: 'Selected image',
        size: 320,
        cell: (info) => (
          <span className="font-mono text-xs" title={info.getValue()}>
            {info.getValue() || '—'}
          </span>
        ),
      }),
      ...shared.trailing,
    ]
  }, [])
  return (
    <CustomResourceTable
      group={FLUX_IMAGE_GROUP}
      resource={FLUX_IMAGE_POLICY_RESOURCE}
      kind="FluxImagePolicy"
      noun={{ singular: 'image policy', plural: 'image policies' }}
      scope="namespaced"
      fetch={api.listFluxImagePolicies}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      extras={(row) => ({ suspended: row.suspended })}
      unavailableMessage="ImagePolicy is not installed in the active contexts."
    />
  )
}

const automationHelper = createColumnHelper<FluxImageUpdateAutomationInfo>()
export function FluxImageUpdateAutomationsView() {
  const columns = useMemo(() => {
    const shared = imageColumns<FluxImageUpdateAutomationInfo>(
      'FluxImageUpdateAutomation',
      FLUX_IMAGE_UPDATE_AUTOMATION_RESOURCE,
    )
    return [
      ...shared.leading,
      automationHelper.accessor('sourceName', {
        header: 'Git repository',
        size: COL_MD,
        cell: (info) =>
          info.row.original.sourceKind === 'GitRepository' ? (
            <div>
              <CustomResourceReference
                contextName={resourceContext(info.row.original)}
                group="source.toolkit.fluxcd.io"
                resource="gitrepositories"
                kind="FluxGitRepository"
                namespace={info.row.original.sourceNamespace}
                name={info.getValue()}
                loadSuspended={api.getFluxGitRepository}
              />
              {info.row.original.sourceNamespace !== info.row.original.namespace && (
                <div className="text-xs text-muted-foreground">
                  {info.row.original.sourceNamespace}
                </div>
              )}
            </div>
          ) : (
            info.getValue() || '—'
          ),
      }),
      automationHelper.accessor('updatePath', {
        header: 'Path',
        size: COL_MD,
        cell: (info) => info.getValue() || './',
      }),
      automationHelper.accessor('pushBranch', {
        header: 'Push branch',
        size: COL_MD,
        cell: (info) => info.getValue() || 'Checkout branch',
      }),
      automationHelper.accessor('lastRunTime', {
        header: 'Last run',
        size: COL_MD,
        cell: (info) => (info.getValue() ? formatAge(info.getValue()) : '—'),
        sortingFn: 'datetime',
      }),
      automationHelper.accessor('lastPushCommit', {
        header: 'Last push',
        size: COL_MD,
        cell: (info) => (
          <span className="font-mono text-xs" title={info.getValue()}>
            {info.getValue().slice(0, 12) || '—'}
          </span>
        ),
      }),
      ...shared.trailing,
    ]
  }, [])
  return (
    <CustomResourceTable
      group={FLUX_IMAGE_GROUP}
      resource={FLUX_IMAGE_UPDATE_AUTOMATION_RESOURCE}
      kind="FluxImageUpdateAutomation"
      noun={{ singular: 'image update automation', plural: 'image update automations' }}
      scope="namespaced"
      fetch={api.listFluxImageUpdateAutomations}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      extras={(row) => ({ suspended: row.suspended })}
      unavailableMessage="ImageUpdateAutomation is not installed in the active contexts."
    />
  )
}
