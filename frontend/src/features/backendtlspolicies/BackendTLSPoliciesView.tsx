import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type BackendTLSPolicyInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useGatewayResourceContexts } from '@/features/gateways/useGatewayResourceContexts'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<BackendTLSPolicyInfo>()

export function BackendTLSPoliciesView() {
  const data = useResources((state) => state.backendTLSPolicies)
  const setData = useResources((state) => state.setBackendTLSPolicies)
  const setSelectedResource = useUIStore((state) => state.setSelectedResource)
  const contexts = useGatewayResourceContexts('backendtlspolicies', 'BackendTLSPolicy')
  const columns = useMemo(() => [
    columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('targets', { header: 'Targets' }),
    columnHelper.accessor('hostname', { header: 'Hostname' }),
    columnHelper.accessor('accepted', { header: 'Accepted', size: COL_SM, cell: (info) => <ConditionPill status={info.getValue()} /> }),
    columnHelper.accessor('resolvedRefs', { header: 'Resolved refs', size: COL_SM, cell: (info) => <ConditionPill status={info.getValue()} /> }),
    columnHelper.accessor('createdAt', {
      header: 'Age', size: COL_SM,
      cell: (info) => formatAge(info.getValue()), sortingFn: 'datetime',
    }),
  ], [])

  return (
    <ResourceTable
      kind="BackendTLSPolicy"
      noun={{ singular: 'backend TLS policy', plural: 'backend TLS policies' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={api.listBackendTLSPolicies}
      contexts={contexts}
      columns={columns}
      onRowClick={(row, context) => setSelectedResource({
        kind: 'BackendTLSPolicy', namespace: row.namespace, name: row.name, context,
      })}
    />
  )
}
