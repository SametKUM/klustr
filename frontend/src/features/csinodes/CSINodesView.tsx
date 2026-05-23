import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CSINodeInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<CSINodeInfo>()

export function CSINodesView() {
  const items = useResources((s) => s.csiNodes)
  const setItems = useResources((s) => s.setCSINodes)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Node' }),
      columnHelper.accessor('drivers', { header: 'Drivers', size: COL_XS }),
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
      kind="CSINode"
      noun={{ singular: 'CSI node', plural: 'CSI nodes' }}
      scope="cluster"
      data={items}
      setData={setItems}
      fetch={(ctx) => api.listCSINodes(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'CSINode', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
