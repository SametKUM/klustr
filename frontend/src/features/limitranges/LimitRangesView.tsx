import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type LimitRangeInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<LimitRangeInfo>()

export function LimitRangesView() {
  const lrs = useResources((s) => s.limitRanges)
  const setLRs = useResources((s) => s.setLimitRanges)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('limits', { header: 'Limits' }),
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
      kind="LimitRange"
      noun={{ singular: 'limit range', plural: 'limit ranges' }}
      scope="namespaced"
      data={lrs}
      setData={setLRs}
      fetch={api.listLimitRanges}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'LimitRange', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
