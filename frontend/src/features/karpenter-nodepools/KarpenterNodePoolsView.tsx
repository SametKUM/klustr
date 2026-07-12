import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type KarpenterNodePoolInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { formatMemoryQuantity, parseQuantity } from '@/lib/quantity'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_SM, COL_MD } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'

const KARPENTER_GROUP = 'karpenter.sh'
const NODEPOOL_RESOURCE = 'nodepools'

const columnHelper = createColumnHelper<KarpenterNodePoolInfo>()

export function KarpenterNodePoolsView() {
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
          return <span title={after ? `consolidateAfter: ${after}` : undefined}>{v}</span>
        },
      }),
      columnHelper.accessor('nodeCount', {
        header: 'Nodes',
        size: COL_SM,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">0</span>,
        sortingFn: (a, b) =>
          (Number(a.original.nodeCount) || 0) - (Number(b.original.nodeCount) || 0),
      }),
      columnHelper.accessor('cpuUsage', {
        header: 'CPU',
        size: COL_SM,
        cell: (i) => formatUsageOverLimit(i.getValue(), i.row.original.cpuLimit),
        sortingFn: (a, b) =>
          (parseQuantity(a.original.cpuUsage) ?? 0) - (parseQuantity(b.original.cpuUsage) ?? 0),
      }),
      columnHelper.accessor('memoryUsage', {
        header: 'Memory',
        size: COL_SM,
        cell: (i) =>
          formatUsageOverLimit(i.getValue(), i.row.original.memoryLimit, formatMemoryQuantity),
        sortingFn: (a, b) =>
          (parseQuantity(a.original.memoryUsage) ?? 0) -
          (parseQuantity(b.original.memoryUsage) ?? 0),
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

  return (
    <CustomResourceTable
      group={KARPENTER_GROUP}
      resource={NODEPOOL_RESOURCE}
      kind="NodePool"
      noun={{ singular: 'node pool', plural: 'node pools' }}
      scope="cluster"
      fetch={api.listKarpenterNodePools}
      columns={columns}
      identity={(row) => ({ namespace: '', name: row.name })}
      unavailableMessage="NodePool is not installed in the active contexts."
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
