import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type NetworkPolicyInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<NetworkPolicyInfo>()

export function NetworkPoliciesView() {
  const policies = useResources((s) => s.networkPolicies)
  const setPolicies = useResources((s) => s.setNetworkPolicies)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('podSelector', {
        header: 'Pod Selector',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('policyTypes', { header: 'Policy Types', size: COL_MD }),
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
      kind="NetworkPolicy"
      noun={{ singular: 'network policy', plural: 'network policies' }}
      scope="namespaced"
      data={policies}
      setData={setPolicies}
      fetch={api.listNetworkPolicies}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'NetworkPolicy', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
