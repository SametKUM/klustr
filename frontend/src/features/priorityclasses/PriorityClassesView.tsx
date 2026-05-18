import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type PriorityClassInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<PriorityClassInfo>()

export function PriorityClassesView() {
  const pcs = useResources((s) => s.priorityClasses)
  const setPCs = useResources((s) => s.setPriorityClasses)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span>
            {info.getValue()}
            {info.row.original.globalDefault && (
              <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                default
              </span>
            )}
          </span>
        ),
      }),
      columnHelper.accessor('value', { header: 'Value' }),
      columnHelper.accessor('description', { header: 'Description' }),
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
      kind="PriorityClass"
      noun={{ singular: 'priority class', plural: 'priority classes' }}
      scope="cluster"
      data={pcs}
      setData={setPCs}
      fetch={(ctx) => api.listPriorityClasses(ctx)}
      columns={columns}
      defaultSort={[{ id: 'value', desc: true }]}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'PriorityClass', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
