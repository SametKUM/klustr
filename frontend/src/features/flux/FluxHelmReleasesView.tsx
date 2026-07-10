import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type FluxHelmReleaseInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import {
  FLUX_HELMRELEASE_GROUP,
  FLUX_HELMRELEASE_RESOURCE,
} from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxHelmReleaseInfo>()
const EMPTY: FluxHelmReleaseInfo[] = []

export function FluxHelmReleasesView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) => c.group === FLUX_HELMRELEASE_GROUP && c.resource === FLUX_HELMRELEASE_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<FluxHelmReleaseInfo[]>(EMPTY)
  const { ready, error } = useCustomResourceWatch(selectedContext, crd)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => (
          <FluxReadyPill value={i.getValue()} suspended={i.row.original.suspended} />
        ),
      }),
      columnHelper.accessor('chart', { header: 'Chart', size: COL_MD }),
      columnHelper.accessor('version', { header: 'Version', size: COL_SM }),
      columnHelper.accessor('sourceRef', { header: 'Source', size: COL_MD }),
      columnHelper.accessor('lastAppliedRevision', {
        header: 'Applied',
        size: COL_SM,
        cell: (i) => {
          const v = i.getValue()
          return v ? (
            <span className="font-mono text-xs">{v}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      }),
      columnHelper.accessor('interval', { header: 'Interval', size: COL_SM }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        size: 220,
        cell: (i) => {
          const row = i.row.original
          if (!selectedContext) return null
          return (
            <div className="flex items-center gap-1">
              <ReconcileFluxResourceButton
                contextName={selectedContext}
                kind="FluxHelmRelease"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={selectedContext}
                kind="FluxHelmRelease"
                namespace={row.namespace}
                name={row.name}
                suspended={row.suspended}
                variant="row"
              />
            </div>
          )
        },
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [selectedContext],
  )

  const data = useMemo<ByContext<FluxHelmReleaseInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: FluxHelmReleaseInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listFluxHelmReleases(ctx, ns),
    [],
  )
  const rowResource = useCallback(
    (row: FluxHelmReleaseInfo, ctx: string): SelectedResource => ({
      kind: 'FluxHelmRelease',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
      suspended: row.suspended,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: FluxHelmReleaseInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Flux HelmReleases are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Flux HelmRelease CRD is not present in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">helm.toolkit.fluxcd.io</code> CRD is
          missing — Flux is partly installed or the helm-controller is disabled.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for HelmRelease: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for HelmRelease…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${FLUX_HELMRELEASE_GROUP}/${FLUX_HELMRELEASE_RESOURCE}`}
      noun={{ singular: 'helmrelease', plural: 'helmreleases' }}
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
