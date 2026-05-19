import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type DaemonSetInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<DaemonSetInfo>()

export function DaemonSetsView() {
  const daemonSets = useResources((s) => s.daemonSets)
  const setDaemonSets = useResources((s) => s.setDaemonSets)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('desired', { header: 'Desired', size: COL_XS }),
      columnHelper.accessor('current', { header: 'Current', size: COL_XS }),
      columnHelper.accessor('ready', { header: 'Ready', size: COL_XS }),
      columnHelper.accessor('upToDate', { header: 'Up-to-date', size: COL_SM }),
      columnHelper.accessor('available', { header: 'Available', size: COL_SM }),
      columnHelper.accessor('nodeSelector', { header: 'Node Selector' }),
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
