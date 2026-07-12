import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type IstioVirtualServiceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ISTIO_NETWORKING_GROUP, ISTIO_VIRTUALSERVICE_RESOURCE } from './istioKinds'

const columnHelper = createColumnHelper<IstioVirtualServiceInfo>()

function routeSummary(r: IstioVirtualServiceInfo): string {
  const parts: string[] = []
  if (r.httpCount) parts.push(`${r.httpCount} http`)
  if (r.tlsCount) parts.push(`${r.tlsCount} tls`)
  if (r.tcpCount) parts.push(`${r.tcpCount} tcp`)
  return parts.join(' · ') || '—'
}

export function IstioVirtualServicesView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('hosts', {
        header: 'Hosts',
        size: COL_MD,
        cell: (i) => i.getValue().join(', ') || '—',
        sortingFn: (a, b) => (a.original.hosts[0] ?? '').localeCompare(b.original.hosts[0] ?? ''),
      }),
      columnHelper.accessor('gateways', {
        header: 'Gateways',
        size: COL_MD,
        cell: (i) => {
          const v = i.getValue()
          return v.length > 0 ? v.join(', ') : <span className="text-muted-foreground">mesh</span>
        },
      }),
      columnHelper.display({
        id: 'routes',
        header: 'Routes',
        size: COL_SM,
        cell: (i) => routeSummary(i.row.original),
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
      resource={ISTIO_VIRTUALSERVICE_RESOURCE}
      kind="IstioVirtualService"
      noun={{ singular: 'virtualservice', plural: 'virtualservices' }}
      scope="namespaced"
      fetch={api.listIstioVirtualServices}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="IstioVirtualService is not installed in the active contexts."
    />
  )
}
