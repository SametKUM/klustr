import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type TLSRouteInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useGatewayResourceContexts } from '@/features/gateways/useGatewayResourceContexts'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<TLSRouteInfo>()

export function TLSRoutesView() {
  const data = useResources((state) => state.tlsRoutes)
  const setData = useResources((state) => state.setTLSRoutes)
  const setSelectedResource = useUIStore((state) => state.setSelectedResource)
  const contexts = useGatewayResourceContexts('tlsroutes', 'TLSRoute')
  const columns = useMemo(() => [
    columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('hostnames', { header: 'SNI hostnames' }),
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
      kind="TLSRoute"
      noun={{ singular: 'TLS route', plural: 'TLS routes' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={api.listTLSRoutes}
      contexts={contexts}
      columns={columns}
      onRowClick={(row, context) => setSelectedResource({
        kind: 'TLSRoute', namespace: row.namespace, name: row.name, context,
      })}
    />
  )
}
