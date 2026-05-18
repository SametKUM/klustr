import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type IngressClassInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<IngressClassInfo>()

export function IngressClassesView() {
  const classes = useResources((s) => s.ingressClasses)
  const setClasses = useResources((s) => s.setIngressClasses)
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
      columnHelper.accessor('controller', { header: 'Controller' }),
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
      kind="IngressClass"
      noun={{ singular: 'ingress class', plural: 'ingress classes' }}
      scope="cluster"
      data={classes}
      setData={setClasses}
      fetch={(ctx) => api.listIngressClasses(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'IngressClass', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
