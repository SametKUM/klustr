import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type KarpenterNodeClaimInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { formatMemoryQuantity, parseQuantity } from '@/lib/quantity'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_SM, COL_MD } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'

const KARPENTER_GROUP = 'karpenter.sh'
const NODECLAIM_RESOURCE = 'nodeclaims'

const columnHelper = createColumnHelper<KarpenterNodeClaimInfo>()

export function KarpenterNodeClaimsView() {
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

  return (
    <CustomResourceTable
      group={KARPENTER_GROUP}
      resource={NODECLAIM_RESOURCE}
      kind="NodeClaim"
      noun={{ singular: 'node claim', plural: 'node claims' }}
      scope="cluster"
      fetch={api.listKarpenterNodeClaims}
      columns={columns}
      identity={(row) => ({ namespace: '', name: row.name })}
      unavailableMessage="NodeClaim is not installed in the active contexts."
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
