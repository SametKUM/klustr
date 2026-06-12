import { useCallback, useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ArgoApplicationSetInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'

const ARGO_GROUP = 'argoproj.io'
const ARGO_RESOURCE = 'applicationsets'

const columnHelper = createColumnHelper<ArgoApplicationSetInfo>()
const EMPTY: ArgoApplicationSetInfo[] = []

export function ApplicationSetsView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) => s.crds.find((c) => c.group === ARGO_GROUP && c.resource === ARGO_RESOURCE) ?? null,
  )

  const [rows, setRows] = useState<ArgoApplicationSetInfo[]>(EMPTY)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedContext || !crd) {
      setReady(false)
      return
    }
    let cancelled = false
    setReady(false)
    setError(null)
    api
      .ensureCustomResourceWatch(selectedContext, crd.group, crd.version, crd.resource)
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [selectedContext, crd])

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('generatorTypes', {
        header: 'Generators',
        cell: (i) => <GeneratorChips types={i.getValue()} />,
        sortingFn: (a, b) =>
          (a.original.generatorTypes[0] ?? '').localeCompare(b.original.generatorTypes[0] ?? ''),
      }),
      columnHelper.accessor('appCount', {
        header: 'Apps',
        size: COL_SM,
        cell: (i) => <span className="font-mono">{i.getValue()}</span>,
      }),
      columnHelper.accessor('healthyCount', {
        header: 'Healthy',
        size: COL_SM,
        cell: (i) => <HealthRatio healthy={i.getValue()} total={i.row.original.appCount} />,
      }),
      columnHelper.accessor('syncedCount', {
        header: 'Synced',
        size: COL_SM,
        cell: (i) => <HealthRatio healthy={i.getValue()} total={i.row.original.appCount} />,
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

  const data = useMemo<ByContext<ArgoApplicationSetInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: ArgoApplicationSetInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listArgoApplicationSets(ctx, ns),
    [],
  )
  const rowResource = useCallback(
    (row: ArgoApplicationSetInfo, ctx: string): SelectedResource => ({
      kind: 'ApplicationSet',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: ArgoApplicationSetInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Argo CD ApplicationSets are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">The ApplicationSet controller is not installed.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          Install the Argo CD ApplicationSet controller (bundled with the Argo CD Helm chart
          by default) and reconnect.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for ApplicationSet: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for ApplicationSet…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${ARGO_GROUP}/${ARGO_RESOURCE}`}
      noun={{ singular: 'applicationset', plural: 'applicationsets' }}
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

function GeneratorChips({ types }: { types: string[] }) {
  if (types.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {types.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {t}
        </span>
      ))}
    </span>
  )
}

function HealthRatio({ healthy, total }: { healthy: number; total: number }) {
  if (total === 0) return <span className="text-muted-foreground">—</span>
  const cls =
    healthy === total
      ? 'text-emerald-600 dark:text-emerald-400'
      : healthy === 0
        ? 'text-destructive'
        : 'text-amber-600 dark:text-amber-400'
  return (
    <span className={`font-mono ${cls}`}>
      {healthy}/{total}
    </span>
  )
}
