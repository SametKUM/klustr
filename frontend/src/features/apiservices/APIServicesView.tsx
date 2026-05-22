import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type APIServiceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<APIServiceInfo>()

export function APIServicesView() {
  const apiSvcs = useResources((s) => s.apiServices)
  const setAPISvcs = useResources((s) => s.setAPIServices)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('service', { header: 'Service' }),
      columnHelper.accessor('available', {
        header: 'Available',
        size: COL_XS,
        cell: (info) => <ConditionPill status={info.getValue()} />,
      }),
      columnHelper.accessor('message', { header: 'Message' }),
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
      kind="APIService"
      noun={{ singular: 'API service', plural: 'API services' }}
      scope="cluster"
      data={apiSvcs}
      setData={setAPISvcs}
      fetch={(ctx) => api.listAPIServices(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'APIService', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
