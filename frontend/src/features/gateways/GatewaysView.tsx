import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type GatewayInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'
import { ConditionPill } from '@/features/_shared/ConditionPill'

const columnHelper = createColumnHelper<GatewayInfo>()

export function GatewaysView() {
  const gateways = useResources((s) => s.gateways)
  const setGateways = useResources((s) => s.setGateways)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('class', { header: 'Class', size: COL_SM }),
      columnHelper.accessor('addresses', {
        header: 'Address',
        cell: (info) => <span className="font-mono text-xs">{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('listeners', {
        header: 'Listeners',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('programmed', {
        header: 'Programmed',
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
      kind="Gateway"
      noun={{ singular: 'gateway', plural: 'gateways' }}
      scope="namespaced"
      data={gateways}
      setData={setGateways}
      fetch={api.listGateways}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Gateway', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
