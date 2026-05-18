import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type RuntimeClassInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<RuntimeClassInfo>()

export function RuntimeClassesView() {
  const rcs = useResources((s) => s.runtimeClasses)
  const setRCs = useResources((s) => s.setRuntimeClasses)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('handler', { header: 'Handler' }),
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
      kind="RuntimeClass"
      noun={{ singular: 'runtime class', plural: 'runtime classes' }}
      scope="cluster"
      data={rcs}
      setData={setRCs}
      fetch={(ctx) => api.listRuntimeClasses(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'RuntimeClass', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
