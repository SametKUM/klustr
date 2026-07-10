import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type IstioDestinationRuleInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import { ISTIO_NETWORKING_GROUP, ISTIO_DESTINATIONRULE_RESOURCE } from './istioKinds'

const columnHelper = createColumnHelper<IstioDestinationRuleInfo>()
const EMPTY: IstioDestinationRuleInfo[] = []

export function IstioDestinationRulesView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) => c.group === ISTIO_NETWORKING_GROUP && c.resource === ISTIO_DESTINATIONRULE_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<IstioDestinationRuleInfo[]>(EMPTY)
  const { ready, error } = useCustomResourceWatch(selectedContext, crd)

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

  const data = useMemo<ByContext<IstioDestinationRuleInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback((_ctx: string, list: IstioDestinationRuleInfo[]) => setRows(list), [])
  const fetch = useCallback((ctx: string, ns: string) => api.listIstioDestinationRules(ctx, ns), [])
  const rowResource = useCallback(
    (row: IstioDestinationRuleInfo, ctx: string): SelectedResource => ({
      kind: 'IstioDestinationRule',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: IstioDestinationRuleInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Istio DestinationRules are only available in single-context mode.
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
        Failed to start watch for DestinationRule: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for DestinationRule…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${ISTIO_NETWORKING_GROUP}/${ISTIO_DESTINATIONRULE_RESOURCE}`}
      noun={{ singular: 'destinationrule', plural: 'destinationrules' }}
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
