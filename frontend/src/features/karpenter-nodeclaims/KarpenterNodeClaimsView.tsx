import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type KarpenterNodeClaimInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { formatMemoryQuantity, parseQuantity } from '@/lib/quantity'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_SM, COL_MD } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'

const KARPENTER_GROUP = 'karpenter.sh'
const NODECLAIM_RESOURCE = 'nodeclaims'

const columnHelper = createColumnHelper<KarpenterNodeClaimInfo>()
const EMPTY: KarpenterNodeClaimInfo[] = []

export function KarpenterNodeClaimsView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find((c) => c.group === KARPENTER_GROUP && c.resource === NODECLAIM_RESOURCE) ?? null,
  )

  const [rows, setRows] = useState<KarpenterNodeClaimInfo[]>(EMPTY)
  const { ready, error } = useCustomResourceWatch(selectedContext, crd)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('nodeName', {
        header: 'Node',
        cell: (i) => {
          const v = i.getValue()
          return v ? (
            <span className="font-mono text-xs">{v}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      }),
      columnHelper.accessor('nodePool', {
        header: 'NodePool',
        size: COL_MD,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('instanceType', {
        header: 'Instance',
        size: COL_MD,
        cell: (i) => {
          const v = i.getValue()
          return v ? (
            <span className="font-mono text-xs">{v}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      }),
      columnHelper.accessor('capacityType', {
        header: 'Capacity',
        size: COL_SM,
        cell: (i) => {
          const v = i.getValue()
          if (!v) return <span className="text-muted-foreground">—</span>
          const cls =
            v === 'spot'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400'
          return <span className={cls}>{v}</span>
        },
      }),
      columnHelper.accessor('zone', {
        header: 'Zone',
        size: COL_SM,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('cpu', {
        header: 'CPU',
        size: COL_SM,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
        sortingFn: (a, b) =>
          (parseQuantity(a.original.cpu) ?? 0) - (parseQuantity(b.original.cpu) ?? 0),
      }),
      columnHelper.accessor('memory', {
        header: 'Memory',
        size: COL_SM,
        cell: (i) => {
          const v = i.getValue()
          if (!v) return <span className="text-muted-foreground">—</span>
          return <span title={v}>{formatMemoryQuantity(v)}</span>
        },
        sortingFn: (a, b) =>
          (parseQuantity(a.original.memory) ?? 0) - (parseQuantity(b.original.memory) ?? 0),
      }),
      columnHelper.accessor('launched', {
        header: 'Launched',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
      }),
      columnHelper.accessor('registered', {
        header: 'Registered',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
      }),
      columnHelper.accessor('initialized', {
        header: 'Initialized',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
      }),
      columnHelper.accessor('drifted', {
        header: 'Drifted',
        size: COL_SM,
        cell: (i) => <DriftedPill status={i.getValue()} />,
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

  const data = useMemo<ByContext<KarpenterNodeClaimInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: KarpenterNodeClaimInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback((ctx: string) => api.listKarpenterNodeClaims(ctx), [])
  const rowResource = useCallback(
    (row: KarpenterNodeClaimInfo, ctx: string): SelectedResource => ({
      kind: 'NodeClaim',
      namespace: '',
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: KarpenterNodeClaimInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Karpenter NodeClaims are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Karpenter is not installed in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">nodeclaims.karpenter.sh</code> CRD is not
          present.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for NodeClaim: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for NodeClaim…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${KARPENTER_GROUP}/${NODECLAIM_RESOURCE}`}
      noun={{ singular: 'node claim', plural: 'node claims' }}
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

// Drifted=True is the noteworthy signal (Karpenter will replace the node);
// flip the polarity so True renders in destructive color and False/empty
// renders as muted "in sync".
function DriftedPill({ status }: { status: string }) {
  if (status === 'True') {
    return <span className="text-amber-600 dark:text-amber-400 font-medium">Drifted</span>
  }
  if (status === 'False') {
    return <span className="text-muted-foreground">—</span>
  }
  return <span className="text-muted-foreground">—</span>
}
