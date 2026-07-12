import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type IstioDestinationRuleInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ISTIO_NETWORKING_GROUP, ISTIO_DESTINATIONRULE_RESOURCE } from './istioKinds'

const columnHelper = createColumnHelper<IstioDestinationRuleInfo>()
export function IstioDestinationRulesView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('host', { header: 'Host', size: COL_MD }),
      columnHelper.accessor('subsets', {
        header: 'Subsets',
        size: COL_MD,
        cell: (i) => i.getValue().join(', ') || <span className="text-muted-foreground">—</span>,
        sortingFn: (a, b) => a.original.subsets.length - b.original.subsets.length,
      }),
      columnHelper.accessor('tlsMode', {
        header: 'TLS Mode',
        size: COL_SM,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <CustomResourceTable
      group={ISTIO_NETWORKING_GROUP}
      resource={ISTIO_DESTINATIONRULE_RESOURCE}
      kind="IstioDestinationRule"
      noun={{ singular: 'destinationrule', plural: 'destinationrules' }}
      scope="namespaced"
      fetch={api.listIstioDestinationRules}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Istio DestinationRule is not installed in the active contexts."
    />
  )
}
