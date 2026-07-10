import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CertManagerCertificateRequestInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import {
  CERT_MANAGER_CERTIFICATEREQUEST_RESOURCE,
  CERT_MANAGER_GROUP,
} from './certManagerKinds'

const columnHelper = createColumnHelper<CertManagerCertificateRequestInfo>()
const EMPTY: CertManagerCertificateRequestInfo[] = []

export function CertificateRequestsView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) =>
          c.group === CERT_MANAGER_GROUP &&
          c.resource === CERT_MANAGER_CERTIFICATEREQUEST_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<CertManagerCertificateRequestInfo[]>(EMPTY)
  const { ready, error } = useCustomResourceWatch(selectedContext, crd)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('approved', {
        header: 'Approved',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
      }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
      }),
      columnHelper.accessor('issuer', {
        header: 'Issuer',
        size: COL_MD,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
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

  const data = useMemo<ByContext<CertManagerCertificateRequestInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: CertManagerCertificateRequestInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listCertManagerCertificateRequests(ctx, ns),
    [],
  )
  const rowResource = useCallback(
    (row: CertManagerCertificateRequestInfo, ctx: string): SelectedResource => ({
      kind: 'CertificateRequest',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: CertManagerCertificateRequestInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        cert-manager CertificateRequests are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">cert-manager is not installed in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The{' '}
          <code className="rounded bg-muted px-1">certificaterequests.cert-manager.io</code> CRD is
          not present.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for CertificateRequest: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for CertificateRequest…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${CERT_MANAGER_GROUP}/${CERT_MANAGER_CERTIFICATEREQUEST_RESOURCE}`}
      noun={{ singular: 'certificate request', plural: 'certificate requests' }}
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
