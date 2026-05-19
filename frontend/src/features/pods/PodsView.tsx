import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type PodInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { namespaceQuery } from '@/lib/namespaceFilter'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useActiveContexts, useUIStore } from '@/store/ui'
import { selectMetricsAvailable, selectPodMetric, useMetrics } from '@/store/metrics'
import { usePodMetricsPoll } from './usePodMetricsPoll'
import { PodResourceBars } from './PodResourceBars'

const columnHelper = createColumnHelper<PodInfo & { __klustrCtx?: string }>()

const HEALTHY_STATUS = new Set(['Running'])
const TERMINAL_STATUS = new Set(['Completed', 'Succeeded'])
const PROGRESSING_STATUS = new Set([
  'Pending',
  'ContainerCreating',
  'PodInitializing',
  'Terminating',
])
const FAILURE_STATUS = new Set([
  'CrashLoopBackOff',
  'ImagePullBackOff',
  'ErrImagePull',
  'CreateContainerConfigError',
  'CreateContainerError',
  'InvalidImageName',
  'Error',
  'OOMKilled',
  'Failed',
  'Evicted',
  'DeadlineExceeded',
])

function PodUsageCell({ pod, ctx }: { pod: PodInfo; ctx: string }) {
  const m = useMetrics(selectPodMetric(ctx, pod.namespace, pod.name))
  return (
    <PodResourceBars
      cpuUsageMC={m?.cpuMC ?? 0}
      cpuRequestMC={pod.cpuRequestMC}
      cpuLimitMC={pod.cpuLimitMC}
      memUsageB={m?.memB ?? 0}
      memRequestB={pod.memRequestB}
      memLimitB={pod.memLimitB}
    />
  )
}

function RestartBadge({ value }: { value: number }) {
  let cls = 'text-muted-foreground'
  if (value >= 6) cls = 'text-destructive font-medium'
  else if (value >= 3) cls = 'text-amber-600 dark:text-amber-400 font-medium'
  else if (value >= 1) cls = 'text-foreground'
  return <span className={cls}>{value}</span>
}

function statusClass(status: string): string {
  if (HEALTHY_STATUS.has(status)) return 'text-emerald-600 dark:text-emerald-400'
  if (TERMINAL_STATUS.has(status)) return 'text-muted-foreground'
  if (PROGRESSING_STATUS.has(status) || status.startsWith('Init:')) {
    return 'text-amber-600 dark:text-amber-400'
  }
  if (FAILURE_STATUS.has(status) || status.startsWith('Signal:') || status.startsWith('ExitCode:')) {
    return 'text-destructive'
  }
  return 'text-foreground'
}

export function PodsView() {
  const pods = useResources((s) => s.pods)
  const setPods = useResources((s) => s.setPods)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const activeContexts = useActiveContexts()
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const metricsAvailable = useMetrics(selectMetricsAvailable(activeContexts))
  usePodMetricsPoll(activeContexts, namespaceQuery(selectedNamespaces).apiNamespace)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      ...(metricsAvailable
        ? [
            columnHelper.display({
              id: 'usage',
              header: 'CPU / Mem',
              cell: (info) => {
                const row = info.row.original
                const ctx = row.__klustrCtx ?? ''
                return <PodUsageCell pod={row} ctx={ctx} />
              },
            }),
          ]
        : []),
      columnHelper.accessor('ready', { header: 'Ready', size: COL_XS }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: COL_SM,
        cell: (info) => <span className={statusClass(info.getValue())}>{info.getValue()}</span>,
      }),
      columnHelper.accessor('restarts', {
        header: 'Restarts',
        size: COL_XS,
        cell: (info) => <RestartBadge value={info.getValue()} />,
      }),
      columnHelper.accessor('node', { header: 'Node' }),
      columnHelper.accessor('podIP', { header: 'IP', size: COL_SM }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [metricsAvailable],
  )

  return (
    <ResourceTable
      kind="Pod"
      noun={{ singular: 'pod', plural: 'pods' }}
      scope="namespaced"
      data={pods}
      setData={setPods}
      fetch={api.listPods}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Pod', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
