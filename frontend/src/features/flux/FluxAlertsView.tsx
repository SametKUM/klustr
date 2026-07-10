import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type FluxAlertInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import { FLUX_ALERT_RESOURCE, FLUX_NOTIFICATION_GROUP } from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxAlertInfo>()
const EMPTY: FluxAlertInfo[] = []

export function FluxAlertsView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) => c.group === FLUX_NOTIFICATION_GROUP && c.resource === FLUX_ALERT_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<FluxAlertInfo[]>(EMPTY)
  const { ready, error } = useCustomResourceWatch(selectedContext, crd)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => (
          <FluxReadyPill value={i.getValue()} suspended={i.row.original.suspended} />
        ),
      }),
      columnHelper.accessor('provider', { header: 'Provider', size: COL_MD }),
      columnHelper.accessor('severity', {
        header: 'Severity',
        size: COL_SM,
        cell: (i) => <SeverityChip value={i.getValue()} />,
      }),
      columnHelper.accessor('sources', { header: 'Sources' }),
      columnHelper.accessor('summary', {
        header: 'Summary',
        cell: (i) => {
          const v = i.getValue()
          return v ? v : <span className="text-muted-foreground">—</span>
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        size: 220,
        cell: (i) => {
          const row = i.row.original
          if (!selectedContext) return null
          return (
            <div className="flex items-center gap-1">
              <ReconcileFluxResourceButton
                contextName={selectedContext}
                kind="FluxAlert"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={selectedContext}
                kind="FluxAlert"
                namespace={row.namespace}
                name={row.name}
                suspended={row.suspended}
                variant="row"
              />
            </div>
          )
        },
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [selectedContext],
  )

  const data = useMemo<ByContext<FluxAlertInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: FluxAlertInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listFluxAlerts(ctx, ns),
    [],
  )
  const rowResource = useCallback(
    (row: FluxAlertInfo, ctx: string): SelectedResource => ({
      kind: 'FluxAlert',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
      suspended: row.suspended,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: FluxAlertInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Flux Alerts are only available in single-context mode.
      </div>
    )
  }
  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Flux notification-controller CRD is not present.</div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for Alert: {error}
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for Alert…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${FLUX_NOTIFICATION_GROUP}/${FLUX_ALERT_RESOURCE}`}
      noun={{ singular: 'alert', plural: 'alerts' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={fetch}
      columns={columns}
      onRowClick={onRowClick}
      rowResource={rowResource}
    />
  )
}

function SeverityChip({ value }: { value: string }) {
  if (value === 'error') {
    return (
      <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
        error
      </span>
    )
  }
  if (value === 'info' || value === '') {
    return (
      <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
        {value || 'info'}
      </span>
    )
  }
  return <span className="font-mono text-xs">{value}</span>
}
