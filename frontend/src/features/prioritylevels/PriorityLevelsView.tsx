import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type PriorityLevelConfigurationInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<PriorityLevelConfigurationInfo>()

export function PriorityLevelsView() {
  const items = useResources((s) => s.priorityLevelConfigurations)
  const setItems = useResources((s) => s.setPriorityLevelConfigurations)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('type', { header: 'Type', size: COL_XS }),
      columnHelper.accessor('nominalConcurrencyShares', {
        header: 'Shares',
        size: COL_XS,
        cell: (info) => info.getValue() || '—',
      }),
      columnHelper.accessor('limitResponse', {
        header: 'Limit response',
        size: COL_XS,
        cell: (info) => info.getValue() || '—',
      }),
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
      kind="PriorityLevelConfiguration"
      noun={{ singular: 'priority level', plural: 'priority levels' }}
      scope="cluster"
      data={items}
      setData={setItems}
      fetch={(ctx) => api.listPriorityLevelConfigurations(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'PriorityLevelConfiguration',
          namespace: '',
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
