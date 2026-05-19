import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ReplicationControllerInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ReplicationControllerInfo>()

export function ReplicationControllersView() {
  const rcs = useResources((s) => s.replicationControllers)
  const setRCs = useResources((s) => s.setReplicationControllers)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('desired', { header: 'Desired', size: COL_XS }),
      columnHelper.accessor('current', { header: 'Current', size: COL_XS }),
      columnHelper.accessor('ready', { header: 'Ready', size: COL_XS }),
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
      kind="ReplicationController"
      noun={{ singular: 'replication controller', plural: 'replication controllers' }}
      scope="namespaced"
      data={rcs}
      setData={setRCs}
      fetch={api.listReplicationControllers}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'ReplicationController', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
