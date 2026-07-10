import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type FluxOCIRepositoryInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import {
  FLUX_OCIREPOSITORY_RESOURCE,
  FLUX_SOURCE_GROUP,
} from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxOCIRepositoryInfo>()
const EMPTY: FluxOCIRepositoryInfo[] = []

export function FluxOCIRepositoriesView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) => c.group === FLUX_SOURCE_GROUP && c.resource === FLUX_OCIREPOSITORY_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<FluxOCIRepositoryInfo[]>(EMPTY)
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
      columnHelper.accessor('url', {
        header: 'URL',
        cell: (i) => <span className="font-mono text-xs">{i.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('ref', { header: 'Ref', size: COL_MD }),
      columnHelper.accessor('revision', {
        header: 'Revision',
        size: COL_MD,
        cell: (i) => {
          const v = i.getValue()
          return v ? (
            <span className="font-mono text-xs">{shortRevision(v)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      }),
      columnHelper.accessor('interval', { header: 'Interval', size: COL_SM }),
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
                kind="FluxOCIRepository"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={selectedContext}
                kind="FluxOCIRepository"
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

  const data = useMemo<ByContext<FluxOCIRepositoryInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: FluxOCIRepositoryInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listFluxOCIRepositories(ctx, ns),
    [],
  )
  const rowResource = useCallback(
    (row: FluxOCIRepositoryInfo, ctx: string): SelectedResource => ({
      kind: 'FluxOCIRepository',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
      suspended: row.suspended,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: FluxOCIRepositoryInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Flux OCIRepositories are only available in single-context mode.
      </div>
    )
  }
  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Flux source-controller CRD is not present in this cluster.</div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for OCIRepository: {error}
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for OCIRepository…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${FLUX_SOURCE_GROUP}/${FLUX_OCIREPOSITORY_RESOURCE}`}
      noun={{ singular: 'ocirepository', plural: 'ocirepositories' }}
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

function shortRevision(rev: string): string {
  const at = rev.indexOf('@sha')
  if (at > 0) {
    const sha = rev.slice(at + 1)
    const colon = sha.indexOf(':')
    if (colon > 0 && sha.length > colon + 8) {
      return rev.slice(0, at) + '@' + sha.slice(0, colon + 8)
    }
  }
  return rev.length > 24 ? rev.slice(0, 24) + '…' : rev
}
