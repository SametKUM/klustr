import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ListenerSetInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useGatewayResourceContexts } from '@/features/gateways/useGatewayResourceContexts'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ListenerSetInfo>()

export function ListenerSetsView() {
  const data = useResources((state) => state.listenerSets)
  const setData = useResources((state) => state.setListenerSets)
  const setSelectedResource = useUIStore((state) => state.setSelectedResource)
  const contexts = useGatewayResourceContexts('listenersets', 'ListenerSet')
  const columns = useMemo(() => [
    columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('parent', { header: 'Parent' }),
    columnHelper.accessor('listeners', { header: 'Listeners' }),
    columnHelper.accessor('attachedRoutes', { header: 'Routes' }),
    columnHelper.accessor('accepted', { header: 'Accepted', size: COL_SM, cell: (info) => <ConditionPill status={info.getValue()} /> }),
    columnHelper.accessor('programmed', { header: 'Programmed', size: COL_SM, cell: (info) => <ConditionPill status={info.getValue()} /> }),
    columnHelper.accessor('createdAt', {
      header: 'Age', size: COL_SM,
      cell: (info) => formatAge(info.getValue()), sortingFn: 'datetime',
    }),
  ], [])

  return (
    <ResourceTable
      kind="ListenerSet"
      noun={{ singular: 'listener set', plural: 'listener sets' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={api.listListenerSets}
      contexts={contexts}
      columns={columns}
      onRowClick={(row, context) => setSelectedResource({
        kind: 'ListenerSet', namespace: row.namespace, name: row.name, context,
      })}
    />
  )
}
