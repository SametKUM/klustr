import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type EndpointsInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<EndpointsInfo>()

export function EndpointsView() {
  const eps = useResources((s) => s.endpoints)
  const setEps = useResources((s) => s.setEndpoints)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('endpoints', {
        header: 'Endpoints',
        cell: (info) => <span className="font-mono text-xs">{info.getValue() || '—'}</span>,
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
      kind="Endpoints"
      noun={{ singular: 'endpoints', plural: 'endpoints' }}
      scope="namespaced"
      data={eps}
      setData={setEps}
      fetch={api.listEndpoints}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Endpoints', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
