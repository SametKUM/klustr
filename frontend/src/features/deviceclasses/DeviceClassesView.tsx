import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type DeviceClassInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<DeviceClassInfo>()

export function DeviceClassesView() {
  const list = useResources((s) => s.deviceClasses)
  const setList = useResources((s) => s.setDeviceClasses)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('selectors', { header: 'Selectors', size: COL_XS }),
      columnHelper.accessor('config', { header: 'Config entries', size: COL_XS }),
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
      kind="DeviceClass"
      noun={{ singular: 'device class', plural: 'device classes' }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listDeviceClasses(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'DeviceClass', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
