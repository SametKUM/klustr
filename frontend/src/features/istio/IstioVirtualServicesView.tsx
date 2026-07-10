import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type IstioVirtualServiceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import { ISTIO_NETWORKING_GROUP, ISTIO_VIRTUALSERVICE_RESOURCE } from './istioKinds'

const columnHelper = createColumnHelper<IstioVirtualServiceInfo>()
const EMPTY: IstioVirtualServiceInfo[] = []

function routeSummary(r: IstioVirtualServiceInfo): string {
  const parts: string[] = []
  if (r.httpCount) parts.push(`${r.httpCount} http`)
  if (r.tlsCount) parts.push(`${r.tlsCount} tls`)
  if (r.tcpCount) parts.push(`${r.tcpCount} tcp`)
  return parts.join(' · ') || '—'
}

export function IstioVirtualServicesView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) => c.group === ISTIO_NETWORKING_GROUP && c.resource === ISTIO_VIRTUALSERVICE_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<IstioVirtualServiceInfo[]>(EMPTY)
  const { ready, error } = useCustomResourceWatch(selectedContext, crd)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('hosts', {
        header: 'Hosts',
        size: COL_MD,
        cell: (i) => i.getValue().join(', ') || '—',
        sortingFn: (a, b) =>
          (a.original.hosts[0] ?? '').localeCompare(b.original.hosts[0] ?? ''),
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

  const data = useMemo<ByContext<IstioVirtualServiceInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback((_ctx: string, list: IstioVirtualServiceInfo[]) => setRows(list), [])
  const fetch = useCallback((ctx: string, ns: string) => api.listIstioVirtualServices(ctx, ns), [])
  const rowResource = useCallback(
    (row: IstioVirtualServiceInfo, ctx: string): SelectedResource => ({
      kind: 'IstioVirtualService',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: IstioVirtualServiceInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Istio VirtualServices are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Istio is not installed in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">networking.istio.io</code> CRDs are not
          present. Install Istio and reconnect.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for VirtualService: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for VirtualService…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${ISTIO_NETWORKING_GROUP}/${ISTIO_VIRTUALSERVICE_RESOURCE}`}
      noun={{ singular: 'virtualservice', plural: 'virtualservices' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={fetch}
      columns={columns}
      onRowClick={onRowClick}
      rowResource={rowResource}
    />
  )
}
