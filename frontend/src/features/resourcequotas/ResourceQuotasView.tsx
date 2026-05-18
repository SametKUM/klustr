import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ResourceQuotaInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ResourceQuotaInfo>()

export function ResourceQuotasView() {
  const quotas = useResources((s) => s.resourceQuotas)
  const setQuotas = useResources((s) => s.setResourceQuotas)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('scopes', { header: 'Scopes' }),
      columnHelper.accessor('used', { header: 'Used Keys' }),
      columnHelper.accessor('hard', { header: 'Hard Keys' }),
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
      kind="ResourceQuota"
      noun={{ singular: 'resource quota', plural: 'resource quotas' }}
      scope="namespaced"
      data={quotas}
      setData={setQuotas}
      fetch={api.listResourceQuotas}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'ResourceQuota', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
