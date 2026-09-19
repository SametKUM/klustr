import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type UDPRouteInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useGatewayResourceContexts } from '@/features/gateways/useGatewayResourceContexts'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<UDPRouteInfo>()

export function UDPRoutesView() {
  const data = useResources((state) => state.udpRoutes)
  const setData = useResources((state) => state.setUDPRoutes)
  const setSelectedResource = useUIStore((state) => state.setSelectedResource)
  const contexts = useGatewayResourceContexts('udproutes', 'UDPRoute')
  const columns = useMemo(() => [
    columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('parents', { header: 'Parents' }),
    columnHelper.accessor('rules', { header: 'Rules' }),
    columnHelper.accessor('accepted', { header: 'Accepted', size: COL_SM, cell: (info) => <ConditionPill status={info.getValue()} /> }),
    columnHelper.accessor('resolvedRefs', { header: 'Resolved refs', size: COL_SM, cell: (info) => <ConditionPill status={info.getValue()} /> }),
    columnHelper.accessor('createdAt', {
      header: 'Age', size: COL_SM,
      cell: (info) => formatAge(info.getValue()), sortingFn: 'datetime',
    }),
  ], [])

  return (
    <ResourceTable
      kind="UDPRoute"
      noun={{ singular: 'UDP route', plural: 'UDP routes' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={api.listUDPRoutes}
      contexts={contexts}
      columns={columns}
      onRowClick={(row, context) => setSelectedResource({
        kind: 'UDPRoute', namespace: row.namespace, name: row.name, context,
      })}
    />
  )
}
