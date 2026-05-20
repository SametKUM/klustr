import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ClusterRoleInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ClusterRoleInfo>()

export function ClusterRolesView() {
  const list = useResources((s) => s.clusterRoles)
  const setList = useResources((s) => s.setClusterRoles)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span>
            {info.getValue()}
            {info.row.original.aggregation && (
              <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                aggregated
              </span>
            )}
          </span>
        ),
      }),
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
      kind="ClusterRole"
      noun={{ singular: 'cluster role', plural: 'cluster roles' }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listClusterRoles(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'ClusterRole', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
