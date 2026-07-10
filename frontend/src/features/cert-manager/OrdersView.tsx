import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CertManagerOrderInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import { CERT_MANAGER_ACME_GROUP, CERT_MANAGER_ORDER_RESOURCE } from './certManagerKinds'
import { CertManagerStatePill } from './CertManagerStatePill'

const columnHelper = createColumnHelper<CertManagerOrderInfo>()
const EMPTY: CertManagerOrderInfo[] = []

export function OrdersView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) => c.group === CERT_MANAGER_ACME_GROUP && c.resource === CERT_MANAGER_ORDER_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<CertManagerOrderInfo[]>(EMPTY)
  const { ready, error } = useCustomResourceWatch(selectedContext, crd)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('state', {
        header: 'State',
        size: COL_SM,
        cell: (i) => <CertManagerStatePill state={i.getValue()} />,
      }),
      columnHelper.accessor('dnsNames', {
        header: 'DNS Names',
        size: COL_MD,
        cell: (i) =>
          i.getValue() ? (
            <span className="font-mono text-xs">{i.getValue()}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      columnHelper.accessor('reason', {
        header: 'Reason',
        size: COL_MD,
        cell: (i) => (
          <span className="truncate text-xs text-muted-foreground" title={i.getValue()}>
            {i.getValue() || '—'}
          </span>
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

  const data = useMemo<ByContext<CertManagerOrderInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback((_ctx: string, list: CertManagerOrderInfo[]) => setRows(list), [])
  const fetch = useCallback((ctx: string, ns: string) => api.listCertManagerOrders(ctx, ns), [])
  const rowResource = useCallback(
    (row: CertManagerOrderInfo, ctx: string): SelectedResource => ({
      kind: 'Order',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: CertManagerOrderInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        ACME Orders are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">No ACME issuer in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">orders.acme.cert-manager.io</code> CRD is not
          present — Orders only exist when an ACME (e.g. Let&apos;s Encrypt) issuer is configured.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for Order: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for Order…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${CERT_MANAGER_ACME_GROUP}/${CERT_MANAGER_ORDER_RESOURCE}`}
      noun={{ singular: 'order', plural: 'orders' }}
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
