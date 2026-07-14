import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ServiceCIDRInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ServiceCIDRInfo>()

export function ServiceCIDRsView() {
  const list = useResources((s) => s.serviceCIDRs)
  const setList = useResources((s) => s.setServiceCIDRs)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('cidrs', { header: 'CIDRs' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_XS,
        cell: (info) => <ConditionPill status={info.getValue()} />,
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
      kind="ServiceCIDR"
      noun={{ singular: 'service CIDR', plural: 'service CIDRs' }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listServiceCIDRs(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'ServiceCIDR', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
