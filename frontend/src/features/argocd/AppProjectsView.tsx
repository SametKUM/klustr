import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ArgoAppProjectInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'

const ARGO_GROUP = 'argoproj.io'
const ARGO_RESOURCE = 'appprojects'

const columnHelper = createColumnHelper<ArgoAppProjectInfo>()
const EMPTY: ArgoAppProjectInfo[] = []

export function AppProjectsView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) => s.crds.find((c) => c.group === ARGO_GROUP && c.resource === ARGO_RESOURCE) ?? null,
  )

  const [rows, setRows] = useState<ArgoAppProjectInfo[]>(EMPTY)
  const { ready, error } = useCustomResourceWatch(selectedContext, crd)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('description', {
        header: 'Description',
        cell: (i) => {
          const v = i.getValue()
          return v ? <span>{v}</span> : <span className="text-muted-foreground">—</span>
        },
      }),
      columnHelper.accessor('sourceRepoCount', {
        header: 'Repos',
        size: COL_SM,
        cell: (i) => <span className="font-mono">{i.getValue()}</span>,
      }),
      columnHelper.accessor('destinationCount', {
        header: 'Destinations',
        size: COL_SM,
        cell: (i) => <span className="font-mono">{i.getValue()}</span>,
      }),
      columnHelper.accessor('roleCount', {
        header: 'Roles',
        size: COL_SM,
        cell: (i) => <span className="font-mono">{i.getValue()}</span>,
      }),
      columnHelper.accessor('syncWindowCount', {
        header: 'Sync windows',
        size: COL_SM,
        cell: (i) => {
          const v = i.getValue()
          return v > 0 ? (
            <span className="font-mono">{v}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
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
    [],
  )

  const data = useMemo<ByContext<ArgoAppProjectInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: ArgoAppProjectInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listArgoAppProjects(ctx, ns),
    [],
  )
  const rowResource = useCallback(
    (row: ArgoAppProjectInfo, ctx: string): SelectedResource => ({
      kind: 'AppProject',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: ArgoAppProjectInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Argo CD AppProjects are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Argo CD is not installed in this cluster.</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for AppProject: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for AppProject…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${ARGO_GROUP}/${ARGO_RESOURCE}`}
      noun={{ singular: 'project', plural: 'projects' }}
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
