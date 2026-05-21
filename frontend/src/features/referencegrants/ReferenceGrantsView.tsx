import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ReferenceGrantInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ReferenceGrantInfo>()

export function ReferenceGrantsView() {
  const grants = useResources((s) => s.referenceGrants)
  const setGrants = useResources((s) => s.setReferenceGrants)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('from', {
        header: 'From',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('to', {
        header: 'To',
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
      kind="ReferenceGrant"
      noun={{ singular: 'reference grant', plural: 'reference grants' }}
      scope="namespaced"
      data={grants}
      setData={setGrants}
      fetch={api.listReferenceGrants}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'ReferenceGrant', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
