import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type KEDAScaledJobInfo, type KEDAScaledObjectInfo, type KEDATriggerAuthenticationInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { ReadyPill } from '@/features/_shared/ReadyPill'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { KEDAActivityPill, KEDAFallbackPill, KEDAPausedPill } from './KEDAPills'
import { kedaPauseLabel } from './kedaPause'
import {
  KEDA_CLUSTERTRIGGERAUTHENTICATION_RESOURCE,
  KEDA_GROUP,
  KEDA_SCALEDJOB_RESOURCE,
  KEDA_SCALEDOBJECT_RESOURCE,
  KEDA_TRIGGERAUTHENTICATION_RESOURCE,
} from './kedaKinds'

const soColumns = createColumnHelper<KEDAScaledObjectInfo>()

export function KEDAScaledObjectsView() {
  const columns = useMemo(
    () => [
      soColumns.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      soColumns.accessor('name', { header: 'Name' }),
      soColumns.accessor((row) => `${row.targetKind}/${row.targetName}`, {
        id: 'target',
        header: 'Target',
        size: 200,
        cell: (i) => <span className="font-mono text-xs">{i.getValue()}</span>,
      }),
      soColumns.accessor((row) => `${row.minReplicas}–${row.maxReplicas}`, {
        id: 'replicas',
        header: 'Replicas',
        size: COL_SM,
        cell: (i) => <span className="tabular-nums">{i.getValue()}</span>,
      }),
      soColumns.accessor('triggerTypes', {
        header: 'Triggers',
        size: 180,
        cell: (i) => <span title={i.getValue()}>{i.getValue() || '—'}</span>,
      }),
      soColumns.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <ReadyPill status={i.getValue()} title={i.row.original.status} />,
      }),
      soColumns.accessor('active', {
        header: 'Active',
        size: COL_SM,
        cell: (i) => <KEDAActivityPill status={i.getValue()} />,
      }),
      soColumns.accessor('fallback', {
        header: 'Fallback',
        size: COL_SM,
        cell: (i) => <KEDAFallbackPill status={i.getValue()} />,
      }),
      soColumns.accessor((r) => kedaPauseLabel(r), {
        id: 'paused',
        header: 'Paused',
        size: 130,
        cell: (i) => <KEDAPausedPill state={i.row.original} />,
      }),
      soColumns.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={KEDA_GROUP}
      resource={KEDA_SCALEDOBJECT_RESOURCE}
      kind="ScaledObject"
      noun={{ singular: 'scaled object', plural: 'scaled objects' }}
      scope="namespaced"
      fetch={api.listKEDAScaledObjects}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="KEDA ScaledObjects are not available in the active contexts."
    />
  )
}

const sjColumns = createColumnHelper<KEDAScaledJobInfo>()

export function KEDAScaledJobsView() {
  const columns = useMemo(
    () => [
      sjColumns.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      sjColumns.accessor('name', { header: 'Name' }),
      sjColumns.accessor((row) => `${row.minReplicas}–${row.maxReplicas}`, {
        id: 'jobs',
        header: 'Jobs',
        size: COL_SM,
        cell: (i) => <span className="tabular-nums">{i.getValue()}</span>,
      }),
      sjColumns.accessor('scalingStrategy', { header: 'Strategy', size: COL_SM }),
      sjColumns.accessor('triggerTypes', {
        header: 'Triggers',
        size: 180,
        cell: (i) => <span title={i.getValue()}>{i.getValue() || '—'}</span>,
      }),
      sjColumns.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <ReadyPill status={i.getValue()} title={i.row.original.status} />,
      }),
      sjColumns.accessor('active', {
        header: 'Active',
        size: COL_SM,
        cell: (i) => <KEDAActivityPill status={i.getValue()} />,
      }),
      sjColumns.accessor('paused', {
        header: 'Paused',
        size: COL_SM,
        cell: (i) => <KEDAPausedPill state={i.row.original} />,
      }),
      sjColumns.accessor('lastActiveTime', {
        header: 'Last active',
        size: COL_MD,
        cell: (i) => (i.getValue() ? formatAge(i.getValue()) : '—'),
        sortingFn: 'datetime',
      }),
      sjColumns.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )
  return (
    <CustomResourceTable
      group={KEDA_GROUP}
      resource={KEDA_SCALEDJOB_RESOURCE}
      kind="ScaledJob"
      noun={{ singular: 'scaled job', plural: 'scaled jobs' }}
      scope="namespaced"
      fetch={api.listKEDAScaledJobs}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="KEDA ScaledJobs are not available in the active contexts."
    />
  )
}

const authColumns = createColumnHelper<KEDATriggerAuthenticationInfo>()

export function KEDATriggerAuthenticationsView({ cluster }: { cluster: boolean }) {
  const columns = useMemo(
    () => [
      ...(cluster ? [] : [authColumns.accessor('namespace', { header: 'Namespace', size: COL_MD })]),
      authColumns.accessor('name', { header: 'Name' }),
      authColumns.accessor((row) => row.sources.join(', '), {
        id: 'sources',
        header: 'Sources',
        size: 240,
        cell: (i) => <span title={i.getValue()}>{i.getValue() || '—'}</span>,
      }),
      authColumns.accessor((row) => row.scaledObjects.length, {
        id: 'scaledObjects',
        header: 'ScaledObjects',
        size: 120,
        cell: (i) => <span className="tabular-nums" title={i.row.original.scaledObjects.join(', ')}>{i.getValue()}</span>,
      }),
      authColumns.accessor((row) => row.scaledJobs.length, {
        id: 'scaledJobs',
        header: 'ScaledJobs',
        size: COL_XS + 30,
        cell: (i) => <span className="tabular-nums" title={i.row.original.scaledJobs.join(', ')}>{i.getValue()}</span>,
      }),
      authColumns.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [cluster],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) =>
      cluster ? api.listKEDAClusterTriggerAuthentications(ctx) : api.listKEDATriggerAuthentications(ctx, ns),
    [cluster],
  )
  return (
    <CustomResourceTable
      group={KEDA_GROUP}
      resource={cluster ? KEDA_CLUSTERTRIGGERAUTHENTICATION_RESOURCE : KEDA_TRIGGERAUTHENTICATION_RESOURCE}
      kind={cluster ? 'ClusterTriggerAuthentication' : 'TriggerAuthentication'}
      noun={
        cluster
          ? { singular: 'cluster trigger authentication', plural: 'cluster trigger authentications' }
          : { singular: 'trigger authentication', plural: 'trigger authentications' }
      }
      scope={cluster ? 'cluster' : 'namespaced'}
      fetch={fetch}
      columns={columns}
      identity={(row) => ({ namespace: cluster ? '' : row.namespace, name: row.name })}
      unavailableMessage={`KEDA ${cluster ? 'ClusterTriggerAuthentications' : 'TriggerAuthentications'} are not available in the active contexts.`}
    />
  )
}
