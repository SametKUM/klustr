import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ServiceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ServiceInfo>()

export function ServicesView() {
  const services = useResources((s) => s.services)
  const setServices = useResources((s) => s.setServices)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('type', { header: 'Type', size: COL_SM }),
      columnHelper.accessor('clusterIP', {
        header: 'Cluster IP',
        size: COL_MD,
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('externalIP', {
        header: 'External IP',
        size: COL_MD,
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('ports', {
        header: 'Ports',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
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
      kind="Service"
      noun={{ singular: 'service', plural: 'services' }}
      scope="namespaced"
      data={services}
      setData={setServices}
      fetch={api.listServices}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Service', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
