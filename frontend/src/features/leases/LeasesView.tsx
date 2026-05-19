import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type LeaseInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<LeaseInfo>()

export function LeasesView() {
  const leases = useResources((s) => s.leases)
  const setLeases = useResources((s) => s.setLeases)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('holder', { header: 'Holder' }),
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
      kind="Lease"
      noun={{ singular: 'lease', plural: 'leases' }}
      scope="namespaced"
      data={leases}
      setData={setLeases}
      fetch={api.listLeases}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Lease', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
