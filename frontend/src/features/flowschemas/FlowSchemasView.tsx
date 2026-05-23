import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type FlowSchemaInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<FlowSchemaInfo>()

export function FlowSchemasView() {
  const items = useResources((s) => s.flowSchemas)
  const setItems = useResources((s) => s.setFlowSchemas)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      // FlowSchemas sort by matchingPrecedence — lower wins, so 1 sits at top.
      columnHelper.accessor('matchingPrecedence', { header: 'Prec', size: COL_XS }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('priorityLevel', { header: 'Priority level' }),
      columnHelper.accessor('distinguisher', { header: 'Distinguisher', size: COL_XS }),
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
      kind="FlowSchema"
      noun={{ singular: 'flow schema', plural: 'flow schemas' }}
      scope="cluster"
      data={items}
      setData={setItems}
      fetch={(ctx) => api.listFlowSchemas(ctx)}
      columns={columns}
      defaultSort={[{ id: 'matchingPrecedence', desc: false }]}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'FlowSchema', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
