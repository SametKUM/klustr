import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type DaemonSetInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<DaemonSetInfo>()

export function DaemonSetsView() {
  const daemonSets = useResources((s) => s.daemonSets)
  const setDaemonSets = useResources((s) => s.setDaemonSets)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('desired', { header: 'Desired' }),
      columnHelper.accessor('current', { header: 'Current' }),
      columnHelper.accessor('ready', { header: 'Ready' }),
      columnHelper.accessor('upToDate', { header: 'Up-to-date' }),
      columnHelper.accessor('available', { header: 'Available' }),
      columnHelper.accessor('nodeSelector', { header: 'Node Selector' }),
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
      kind="DaemonSet"
      noun={{ singular: 'daemonset', plural: 'daemonsets' }}
      scope="namespaced"
      data={daemonSets}
      setData={setDaemonSets}
      fetch={api.listDaemonSets}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'DaemonSet', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
