import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type NodeInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<NodeInfo>()

function nodeStatusClass(status: string): string {
  if (status.startsWith('Ready')) {
    return status.includes('SchedulingDisabled')
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400'
  }
  if (status.startsWith('NotReady')) return 'text-destructive'
  return 'text-muted-foreground'
}

export function NodesView() {
  const nodes = useResources((s) => s.nodes)
  const setNodes = useResources((s) => s.setNodes)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <span className={nodeStatusClass(info.getValue())}>{info.getValue()}</span>,
      }),
      columnHelper.accessor('roles', { header: 'Roles' }),
      columnHelper.accessor('version', { header: 'Version' }),
      columnHelper.accessor('osImage', { header: 'OS Image' }),
      columnHelper.accessor('internalIP', {
        header: 'Internal IP',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <ResourceTable
      kind="Node"
      noun={{ singular: 'node', plural: 'nodes' }}
      scope="cluster"
      data={nodes}
      setData={setNodes}
      fetch={(ctx) => api.listNodes(ctx)}
      columns={columns}
      onRowClick={(row, ctx) => setSelectedResource({ kind: 'Node', namespace: '', name: row.name, context: ctx })}
    />
  )
}
