import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type EndpointSliceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<EndpointSliceInfo>()

export function EndpointSlicesView() {
  const slices = useResources((s) => s.endpointSlices)
  const setSlices = useResources((s) => s.setEndpointSlices)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('addressType', { header: 'Address Type', size: COL_SM }),
      columnHelper.accessor('service', { header: 'Service' }),
      columnHelper.accessor('endpoints', { header: 'Endpoints', size: COL_XS }),
      columnHelper.accessor('ports', { header: 'Ports', size: COL_SM }),
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
      kind="EndpointSlice"
      noun={{ singular: 'endpoint slice', plural: 'endpoint slices' }}
      scope="namespaced"
      data={slices}
      setData={setSlices}
      fetch={api.listEndpointSlices}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'EndpointSlice', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
