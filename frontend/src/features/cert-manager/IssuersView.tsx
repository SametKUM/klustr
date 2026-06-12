import { useCallback, useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CertManagerIssuerInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import {
  CERT_MANAGER_CLUSTERISSUER_RESOURCE,
  CERT_MANAGER_GROUP,
  CERT_MANAGER_ISSUER_RESOURCE,
} from './certManagerKinds'

const columnHelper = createColumnHelper<CertManagerIssuerInfo>()
const EMPTY: CertManagerIssuerInfo[] = []

type Props = {
  // cluster selects the ClusterIssuer (cluster-scoped) variant; otherwise the
  // namespaced Issuer is rendered. Both share the same row/detail shape.
  cluster: boolean
}

export function IssuersView({ cluster }: Props) {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const resourceName = cluster
    ? CERT_MANAGER_CLUSTERISSUER_RESOURCE
    : CERT_MANAGER_ISSUER_RESOURCE
  const kind = cluster ? 'ClusterIssuer' : 'Issuer'

  const crd = useCRDStore(
    (s) =>
      s.crds.find((c) => c.group === CERT_MANAGER_GROUP && c.resource === resourceName) ?? null,
  )

  const [rows, setRows] = useState<CertManagerIssuerInfo[]>(EMPTY)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedContext || !crd) {
      setReady(false)
      return
    }
    let cancelled = false
    setReady(false)
    setError(null)
    api
      .ensureCustomResourceWatch(selectedContext, crd.group, crd.version, crd.resource)
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [selectedContext, crd])

  const columns = useMemo(
    () => [
      ...(cluster
        ? []
        : [columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD })]),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        size: COL_MD,
        cell: (i) =>
          i.getValue() ? (
            <span className="font-mono text-xs">{i.getValue()}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
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
    [cluster],
  )

  const data = useMemo<ByContext<CertManagerIssuerInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: CertManagerIssuerInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) =>
      cluster ? api.listCertManagerClusterIssuers(ctx) : api.listCertManagerIssuers(ctx, ns),
    [cluster],
  )
  const rowResource = useCallback(
    (row: CertManagerIssuerInfo, ctx: string): SelectedResource => ({
      kind,
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    }),
    [crd, kind],
  )
  const onRowClick = useCallback(
    (row: CertManagerIssuerInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        cert-manager {kind}s are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">cert-manager is not installed in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The{' '}
          <code className="rounded bg-muted px-1">
            {resourceName}.cert-manager.io
          </code>{' '}
          CRD is not present.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for {kind}: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for {kind}…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${CERT_MANAGER_GROUP}/${resourceName}`}
      noun={
        cluster
          ? { singular: 'cluster issuer', plural: 'cluster issuers' }
          : { singular: 'issuer', plural: 'issuers' }
      }
      scope={cluster ? 'cluster' : 'namespaced'}
      data={data}
      setData={setData}
      fetch={fetch}
      columns={columns}
      onRowClick={onRowClick}
      rowResource={rowResource}
    />
  )
}
