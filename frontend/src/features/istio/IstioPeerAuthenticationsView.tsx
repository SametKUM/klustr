import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type IstioPeerAuthenticationInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import { ISTIO_SECURITY_GROUP, ISTIO_PEERAUTHENTICATION_RESOURCE } from './istioKinds'

const columnHelper = createColumnHelper<IstioPeerAuthenticationInfo>()
const EMPTY: IstioPeerAuthenticationInfo[] = []

export function IstioPeerAuthenticationsView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) => c.group === ISTIO_SECURITY_GROUP && c.resource === ISTIO_PEERAUTHENTICATION_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<IstioPeerAuthenticationInfo[]>(EMPTY)
  const { ready, error } = useCustomResourceWatch(selectedContext, crd)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('mtlsMode', { header: 'mTLS Mode', size: COL_SM }),
      columnHelper.accessor('selector', {
        header: 'Selector',
        size: COL_MD,
        cell: (i) =>
          i.row.original.selector === 'namespace-wide' ? (
            <span className="text-muted-foreground">namespace-wide</span>
          ) : (
            <span className="font-mono text-xs">{i.getValue()}</span>
          ),
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

  const data = useMemo<ByContext<IstioPeerAuthenticationInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: IstioPeerAuthenticationInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listIstioPeerAuthentications(ctx, ns),
    [],
  )
  const rowResource = useCallback(
    (row: IstioPeerAuthenticationInfo, ctx: string): SelectedResource => ({
      kind: 'IstioPeerAuthentication',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: IstioPeerAuthenticationInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Istio PeerAuthentications are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Istio is not installed in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">security.istio.io</code> CRDs are not present.
          Install Istio and reconnect.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for PeerAuthentication: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for PeerAuthentication…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${ISTIO_SECURITY_GROUP}/${ISTIO_PEERAUTHENTICATION_RESOURCE}`}
      noun={{ singular: 'peerauthentication', plural: 'peerauthentications' }}
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
