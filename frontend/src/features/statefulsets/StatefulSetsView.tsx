import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type StatefulSetInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<StatefulSetInfo>()

function readyClass(ready: string): string {
  const [got, want] = ready.split('/').map((n) => Number.parseInt(n, 10))
  if (Number.isNaN(got) || Number.isNaN(want)) return 'text-foreground'
  if (want === 0) return 'text-muted-foreground'
  if (got >= want) return 'text-emerald-600 dark:text-emerald-400'
  if (got === 0) return 'text-destructive'
  return 'text-amber-600 dark:text-amber-400'
}

export function StatefulSetsView() {
  const statefulSets = useResources((s) => s.statefulSets)
  const setStatefulSets = useResources((s) => s.setStatefulSets)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        cell: (info) => <span className={readyClass(info.getValue())}>{info.getValue()}</span>,
      }),
      columnHelper.accessor('service', { header: 'Service' }),
      columnHelper.accessor('images', {
        header: 'Images',
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
      kind="StatefulSet"
      noun={{ singular: 'statefulset', plural: 'statefulsets' }}
      scope="namespaced"
      data={statefulSets}
      setData={setStatefulSets}
      fetch={api.listStatefulSets}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'StatefulSet', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
