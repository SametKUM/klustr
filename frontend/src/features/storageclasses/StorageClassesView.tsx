import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type StorageClassInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<StorageClassInfo>()

export function StorageClassesView() {
  const scs = useResources((s) => s.storageClasses)
  const setSCs = useResources((s) => s.setStorageClasses)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span>
            {info.getValue()}
            {info.row.original.isDefault && (
              <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                default
              </span>
            )}
          </span>
        ),
      }),
      columnHelper.accessor('provisioner', { header: 'Provisioner' }),
      columnHelper.accessor('reclaimPolicy', { header: 'Reclaim' }),
      columnHelper.accessor('volumeBindingMode', { header: 'Volume Binding' }),
      columnHelper.accessor('allowExpansion', {
        header: 'Expand',
        cell: (info) => (info.getValue() ? '✓' : '·'),
      }),
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
      kind="StorageClass"
      noun={{ singular: 'storage class', plural: 'storage classes' }}
      scope="cluster"
      data={scs}
      setData={setSCs}
      fetch={(ctx) => api.listStorageClasses(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'StorageClass', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
