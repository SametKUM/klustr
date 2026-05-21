import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type HTTPRouteInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'
import { ConditionPill } from '@/features/_shared/ConditionPill'

const columnHelper = createColumnHelper<HTTPRouteInfo>()

export function HTTPRoutesView() {
  const routes = useResources((s) => s.httpRoutes)
  const setRoutes = useResources((s) => s.setHTTPRoutes)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('hostnames', {
        header: 'Hostnames',
        cell: (info) => <span className="font-mono text-xs">{info.getValue() || '*'}</span>,
      }),
      columnHelper.accessor('parents', {
        header: 'Parents',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('rules', { header: 'Rules', size: COL_SM }),
      columnHelper.accessor('accepted', {
        header: 'Accepted',
        size: COL_SM,
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
      kind="HTTPRoute"
      noun={{ singular: 'HTTP route', plural: 'HTTP routes' }}
      scope="namespaced"
      data={routes}
      setData={setRoutes}
      fetch={api.listHTTPRoutes}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'HTTPRoute', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
