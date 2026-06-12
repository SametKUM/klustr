import { useCallback, useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type KarpenterNodePoolInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { formatMemoryQuantity } from '@/lib/quantity'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_MD } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'

const KARPENTER_GROUP = 'karpenter.sh'
const NODEPOOL_RESOURCE = 'nodepools'

const columnHelper = createColumnHelper<KarpenterNodePoolInfo>()
const EMPTY: KarpenterNodePoolInfo[] = []

export function KarpenterNodePoolsView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find((c) => c.group === KARPENTER_GROUP && c.resource === NODEPOOL_RESOURCE) ?? null,
  )

  const [rows, setRows] = useState<KarpenterNodePoolInfo[]>(EMPTY)
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
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('weight', {
        header: 'Weight',
        size: COL_SM,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('nodeClassName', {
        header: 'Node Class',
        size: COL_MD,
        cell: (i) => {
          const v = i.getValue()
          const kind = i.row.original.nodeClassKind
          if (!v) return <span className="text-muted-foreground">—</span>
          return (
            <span className="font-mono text-xs" title={kind ? `${kind}/${v}` : v}>
              {v}
            </span>
          )
        },
      }),
      columnHelper.accessor('consolidationPolicy', {
        header: 'Consolidation',
        size: COL_MD,
        cell: (i) => {
          const v = i.getValue()
          if (!v) return <span className="text-muted-foreground">—</span>
          const after = i.row.original.consolidateAfter
          return (
            <span title={after ? `consolidateAfter: ${after}` : undefined}>
              {v}
            </span>
          )
        },
      }),
      columnHelper.accessor('nodeCount', {
        header: 'Nodes',
        size: COL_SM,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">0</span>,
      }),
      columnHelper.accessor('cpuUsage', {
        header: 'CPU',
        size: COL_SM,
        cell: (i) => formatUsageOverLimit(i.getValue(), i.row.original.cpuLimit),
      }),
      columnHelper.accessor('memoryUsage', {
        header: 'Memory',
        size: COL_SM,
        cell: (i) =>
          formatUsageOverLimit(
            i.getValue(),
            i.row.original.memoryLimit,
            formatMemoryQuantity,
          ),
      }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
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

  const data = useMemo<ByContext<KarpenterNodePoolInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: KarpenterNodePoolInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback((ctx: string) => api.listKarpenterNodePools(ctx), [])
  const rowResource = useCallback(
    (row: KarpenterNodePoolInfo, ctx: string): SelectedResource => ({
      kind: 'NodePool',
      namespace: '',
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: KarpenterNodePoolInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Karpenter NodePools are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Karpenter is not installed in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">nodepools.karpenter.sh</code> CRD is not
          present.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for NodePool: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for NodePool…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${KARPENTER_GROUP}/${NODEPOOL_RESOURCE}`}
      noun={{ singular: 'node pool', plural: 'node pools' }}
      scope="cluster"
      data={data}
      setData={setData}
      fetch={fetch}
      columns={columns}
      onRowClick={onRowClick}
      rowResource={rowResource}
    />
  )
}

function formatUsageOverLimit(used: string, limit: string, fmt?: (raw: string) => string) {
  if (!used && !limit) return <span className="text-muted-foreground">—</span>
  const u = used ? (fmt ? fmt(used) : used) : '0'
  if (!limit) return <span className="font-mono text-xs">{u}</span>
  const l = fmt ? fmt(limit) : limit
  return (
    <span className="font-mono text-xs" title={`${used || '0'} / ${limit}`}>
      {u}
      <span className="text-muted-foreground"> / {l}</span>
    </span>
  )
}
