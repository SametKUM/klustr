import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CSIDriverInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<CSIDriverInfo>()

export function CSIDriversView() {
  const items = useResources((s) => s.csiDrivers)
  const setItems = useResources((s) => s.setCSIDrivers)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('attachRequired', {
        header: 'Attach req',
        size: COL_XS,
        cell: (info) => (info.getValue() ? 'yes' : 'no'),
      }),
      columnHelper.accessor('podInfoOnMount', {
        header: 'Pod info',
        size: COL_XS,
        cell: (info) => (info.getValue() ? 'yes' : 'no'),
      }),
      columnHelper.accessor('modes', { header: 'Modes' }),
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
      kind="CSIDriver"
      noun={{ singular: 'CSI driver', plural: 'CSI drivers' }}
      scope="cluster"
      data={items}
      setData={setItems}
      fetch={(ctx) => api.listCSIDrivers(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'CSIDriver', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
