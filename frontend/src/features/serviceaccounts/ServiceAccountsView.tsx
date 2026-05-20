import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ServiceAccountInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ServiceAccountInfo>()

export function ServiceAccountsView() {
  const serviceAccounts = useResources((s) => s.serviceAccounts)
  const setServiceAccounts = useResources((s) => s.setServiceAccounts)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('secrets', { header: 'Secrets', size: COL_XS }),
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
      kind="ServiceAccount"
      noun={{ singular: 'service account', plural: 'service accounts' }}
      scope="namespaced"
      data={serviceAccounts}
      setData={setServiceAccounts}
      fetch={api.listServiceAccounts}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'ServiceAccount',
          namespace: row.namespace,
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
