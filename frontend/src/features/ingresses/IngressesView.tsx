import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type IngressInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<IngressInfo>()

export function IngressesView() {
  const ingresses = useResources((s) => s.ingresses)
  const setIngresses = useResources((s) => s.setIngresses)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('class', { header: 'Class' }),
      columnHelper.accessor('hosts', {
        header: 'Hosts',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('address', {
        header: 'Address',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('ports', { header: 'Ports' }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <ResourceTable
      kind="Ingress"
      noun={{ singular: 'ingress', plural: 'ingresses' }}
      scope="namespaced"
      data={ingresses}
      setData={setIngresses}
      fetch={api.listIngresses}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Ingress', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
