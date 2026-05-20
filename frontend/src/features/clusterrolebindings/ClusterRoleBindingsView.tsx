import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ClusterRoleBindingInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ClusterRoleBindingInfo>()

export function ClusterRoleBindingsView() {
  const list = useResources((s) => s.clusterRoleBindings)
  const setList = useResources((s) => s.setClusterRoleBindings)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('roleRef', { header: 'Role' }),
      columnHelper.accessor('subjects', { header: 'Subjects', size: COL_XS }),
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
      kind="ClusterRoleBinding"
      noun={{ singular: 'cluster role binding', plural: 'cluster role bindings' }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listClusterRoleBindings(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'ClusterRoleBinding',
          namespace: '',
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
