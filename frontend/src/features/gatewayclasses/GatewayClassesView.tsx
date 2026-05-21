import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type GatewayClassInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'
import { ConditionPill } from '@/features/_shared/ConditionPill'

const columnHelper = createColumnHelper<GatewayClassInfo>()

export function GatewayClassesView() {
  const classes = useResources((s) => s.gatewayClasses)
  const setClasses = useResources((s) => s.setGatewayClasses)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('controller', {
        header: 'Controller',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('accepted', {
        header: 'Accepted',
        size: COL_SM,
        cell: (info) => <ConditionPill status={info.getValue()} />,
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
      kind="GatewayClass"
      noun={{ singular: 'gateway class', plural: 'gateway classes' }}
      scope="cluster"
      data={classes}
      setData={setClasses}
      fetch={(ctx) => api.listGatewayClasses(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'GatewayClass', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
