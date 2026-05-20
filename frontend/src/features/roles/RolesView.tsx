import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type RoleInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<RoleInfo>()

export function RolesView() {
  const roles = useResources((s) => s.roles)
  const setRoles = useResources((s) => s.setRoles)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('rules', { header: 'Rules', size: COL_XS }),
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
      kind="Role"
      noun={{ singular: 'role', plural: 'roles' }}
      scope="namespaced"
      data={roles}
      setData={setRoles}
      fetch={api.listRoles}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Role', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
