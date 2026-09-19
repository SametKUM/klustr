import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type TCPRouteInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useGatewayResourceContexts } from '@/features/gateways/useGatewayResourceContexts'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<TCPRouteInfo>()

export function TCPRoutesView() {
  const data = useResources((state) => state.tcpRoutes)
  const setData = useResources((state) => state.setTCPRoutes)
  const setSelectedResource = useUIStore((state) => state.setSelectedResource)
  const contexts = useGatewayResourceContexts('tcproutes', 'TCPRoute')
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
      kind="TCPRoute"
      noun={{ singular: 'TCP route', plural: 'TCP routes' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={api.listTCPRoutes}
      contexts={contexts}
      columns={columns}
      onRowClick={(row, context) => setSelectedResource({
        kind: 'TCPRoute', namespace: row.namespace, name: row.name, context,
      })}
    />
  )
}
