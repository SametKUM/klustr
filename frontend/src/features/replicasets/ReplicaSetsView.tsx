import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ReplicaSetInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ReplicaSetInfo>()

function readyClass(ready: number, desired: number): string {
  if (desired === 0) return 'text-muted-foreground'
  if (ready >= desired) return 'text-emerald-600 dark:text-emerald-400'
  if (ready === 0) return 'text-destructive'
  return 'text-amber-600 dark:text-amber-400'
}

export function ReplicaSetsView() {
  const replicaSets = useResources((s) => s.replicaSets)
  const setReplicaSets = useResources((s) => s.setReplicaSets)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('desired', { header: 'Desired', size: COL_XS }),
      columnHelper.accessor('current', { header: 'Current', size: COL_XS }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_XS,
        cell: (info) => (
          <span className={readyClass(info.getValue(), info.row.original.desired)}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('ownedBy', { header: 'Controlled By' }),
      columnHelper.accessor('images', {
        header: 'Images',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <ResourceTable
      kind="ReplicaSet"
      noun={{ singular: 'replicaset', plural: 'replicasets' }}
      scope="namespaced"
      data={replicaSets}
      setData={setReplicaSets}
      fetch={api.listReplicaSets}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'ReplicaSet', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
