import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Lock } from 'lucide-react'
import { api, type FluxProviderInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import {
  FLUX_NOTIFICATION_GROUP,
  FLUX_PROVIDER_RESOURCE,
} from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxProviderInfo>()
const EMPTY: FluxProviderInfo[] = []

export function FluxProvidersView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) => c.group === FLUX_NOTIFICATION_GROUP && c.resource === FLUX_PROVIDER_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<FluxProviderInfo[]>(EMPTY)
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
      columnHelper.accessor('type', {
        header: 'Type',
        size: COL_SM,
        cell: (i) => <span className="font-mono text-xs">{i.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('channel', { header: 'Channel', size: COL_MD }),
      columnHelper.accessor('address', {
        header: 'Address',
        cell: (i) => <AddressCell row={i.row.original} />,
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
                kind="FluxProvider"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={selectedContext}
                kind="FluxProvider"
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

  const data = useMemo<ByContext<FluxProviderInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: FluxProviderInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listFluxProviders(ctx, ns),
    [],
  )
  const rowResource = useCallback(
    (row: FluxProviderInfo, ctx: string): SelectedResource => ({
      kind: 'FluxProvider',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
      suspended: row.suspended,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: FluxProviderInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Flux Providers are only available in single-context mode.
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
        Failed to start watch for Provider: {error}
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for Provider…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${FLUX_NOTIFICATION_GROUP}/${FLUX_PROVIDER_RESOURCE}`}
      noun={{ singular: 'provider', plural: 'providers' }}
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

// AddressCell renders inline addresses verbatim but elides Secret-backed
// ones into a chip — a webhook URL pasted into a screenshot can leak a
// bearer token, so make the from-Secret case visually distinct.
function AddressCell({ row }: { row: FluxProviderInfo }) {
  if (row.addressFromSecret) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        <Lock className="size-3" /> from Secret
      </span>
    )
  }
  if (row.address) {
    return <span className="font-mono text-xs">{redactToken(row.address)}</span>
  }
  return <span className="text-muted-foreground">—</span>
}

// redactToken keeps the host + path shape visible (so the user can sanity-
// check the integration target) but masks the path segments that commonly
// carry secrets (e.g. Slack's /services/T.../B.../X...).
function redactToken(url: string): string {
  return url.replace(/(\/services\/[^/]+\/)[^/]+(\/.+)?/, '$1•••$2')
}
