import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type NamespaceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<NamespaceInfo>()

function phaseClass(phase: string): string {
  if (phase === 'Active') return 'text-emerald-600 dark:text-emerald-400'
  if (phase === 'Terminating') return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
}

export function NamespacesView() {
  const namespaces = useResources((s) => s.namespaces)
  const setNamespaces = useResources((s) => s.setNamespaces)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('phase', {
        header: 'Status',
        cell: (info) => <span className={phaseClass(info.getValue())}>{info.getValue()}</span>,
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
      kind="Namespace"
      noun={{ singular: 'namespace', plural: 'namespaces' }}
      scope="cluster"
      data={namespaces}
      setData={setNamespaces}
      fetch={(ctx) => api.listNamespaces(ctx)}
      columns={columns}
      onRowClick={(row, ctx) => setSelectedResource({ kind: 'Namespace', namespace: '', name: row.name, context: ctx })}
    />
  )
}
