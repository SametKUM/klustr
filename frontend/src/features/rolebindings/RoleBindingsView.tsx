import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type RoleBindingInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<RoleBindingInfo>()

export function RoleBindingsView() {
  const bindings = useResources((s) => s.roleBindings)
  const setRoleBindings = useResources((s) => s.setRoleBindings)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
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
      kind="RoleBinding"
      noun={{ singular: 'role binding', plural: 'role bindings' }}
      scope="namespaced"
      data={bindings}
      setData={setRoleBindings}
      fetch={api.listRoleBindings}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'RoleBinding',
          namespace: row.namespace,
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
