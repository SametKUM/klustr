import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type NodeInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useActiveContexts, useUIStore } from '@/store/ui'
import { selectMetricsAvailable, selectNodeMetric, useMetrics } from '@/store/metrics'
import { useNodeMetricsPoll } from './useNodeMetricsPoll'
import { NodeResourceBars } from './NodeResourceBars'

const columnHelper = createColumnHelper<NodeInfo & { __klustrCtx?: string }>()

function nodeStatusClass(status: string): string {
  if (status.startsWith('Ready')) {
    return status.includes('SchedulingDisabled')
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400'
  }
  if (status.startsWith('NotReady')) return 'text-destructive'
  return 'text-muted-foreground'
}

const EMPTY_CELL = <span className="text-muted-foreground">—</span>

function PressureBadge({ label }: { label: string }) {
  return (
    <span
      className="rounded-sm bg-amber-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
      title={`${label}Pressure condition is active`}
    >
      {label}
    </span>
  )
}

function NodeUsageCell({ node, ctx }: { node: NodeInfo; ctx: string }) {
  const m = useMetrics(selectNodeMetric(ctx, node.name))
  return (
    <NodeResourceBars
      cpuUsageMC={m?.cpuMC ?? 0}
      cpuAllocMC={node.cpuAllocMC}
      memUsageB={m?.memB ?? 0}
      memAllocB={node.memAllocB}
    />
  )
}

export function NodesView() {
  const nodes = useResources((s) => s.nodes)
  const setNodes = useResources((s) => s.setNodes)
  const applyNodesDelta = useResources((s) => s.applyNodesDelta)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const activeContexts = useActiveContexts()
  const metricsAvailable = useMetrics(selectMetricsAvailable(activeContexts))
  useNodeMetricsPoll(activeContexts)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: COL_MD,
        cell: (info) => {
          const row = info.row.original
          return (
            <div className="flex items-center gap-1.5">
              <span className={nodeStatusClass(row.status)}>{row.status}</span>
              {row.memoryPressure && <PressureBadge label="Mem" />}
              {row.diskPressure && <PressureBadge label="Disk" />}
              {row.pidPressure && <PressureBadge label="PID" />}
            </div>
          )
        },
      }),
      ...(metricsAvailable
        ? [
            columnHelper.display({
              id: 'usage',
              header: 'CPU / Mem',
              size: COL_MD,
              cell: (info) => {
                const row = info.row.original
                return <NodeUsageCell node={row} ctx={row.__klustrCtx ?? activeContexts[0] ?? ''} />
              },
            }),
          ]
        : []),
      columnHelper.accessor('roles', { header: 'Roles', size: COL_MD }),
      columnHelper.accessor('version', { header: 'Version', size: COL_SM }),
      columnHelper.accessor('osImage', { header: 'OS Image' }),
      columnHelper.accessor('internalIP', {
        header: 'Internal IP',
        size: COL_MD,
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('instanceType', {
        header: 'Instance',
        size: COL_MD,
        cell: (info) => {
          const v = info.getValue()
          return v ? <span className="font-mono text-xs">{v}</span> : EMPTY_CELL
        },
      }),
      columnHelper.accessor('capacityType', {
        header: 'Capacity',
        size: COL_SM,
        cell: (info) => {
          const v = info.getValue()
          if (!v) return EMPTY_CELL
          const cls =
            v === 'spot'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400'
          return <span className={cls}>{v}</span>
        },
      }),
      columnHelper.accessor('nodePool', {
        header: 'NodePool',
        size: COL_MD,
        cell: (info) => info.getValue() || EMPTY_CELL,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [metricsAvailable, activeContexts],
  )

  return (
    <ResourceTable
      kind="Node"
      noun={{ singular: 'node', plural: 'nodes' }}
      scope="cluster"
      data={nodes}
      setData={setNodes}
      applyDelta={applyNodesDelta}
      fetch={(ctx) => api.listNodes(ctx)}
      columns={columns}
      onRowClick={(row, ctx) => setSelectedResource({ kind: 'Node', namespace: '', name: row.name, context: ctx })}
    />
  )
}
