import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type FluxHelmReleaseInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { useContextResourceData } from '@/features/_shared/useContextResourceData'
import { useCustomResourceCapability } from '@/features/_shared/useCustomResourceCapability'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useUIStore, type SelectedResource } from '@/store/ui'
import { FLUX_HELMRELEASE_GROUP, FLUX_HELMRELEASE_RESOURCE } from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxHelmReleaseInfo>()
export function FluxHelmReleasesView() {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const capability = useCustomResourceCapability(FLUX_HELMRELEASE_GROUP, FLUX_HELMRELEASE_RESOURCE)
  const { data, setData } = useContextResourceData<FluxHelmReleaseInfo>(capability.activeContexts)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <FluxReadyPill value={i.getValue()} suspended={i.row.original.suspended} />,
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
          const contextName = resourceContext(row)
          if (!contextName) return null
          return (
            <div className="flex items-center gap-1">
              <ReconcileFluxResourceButton
                contextName={contextName}
                kind="FluxHelmRelease"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={contextName}
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
    [],
  )

  const fetch = useCallback(
    (ctx: string, ns: string) =>
      capability.crdsByContext[ctx] ? api.listFluxHelmReleases(ctx, ns) : Promise.resolve([]),
    [capability.crdsByContext],
  )
  const rowResource = useCallback(
    (row: FluxHelmReleaseInfo, ctx: string): SelectedResource => ({
      kind: 'FluxHelmRelease',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: capability.crdsByContext[ctx]
        ? {
            group: capability.crdsByContext[ctx].group,
            version: capability.crdsByContext[ctx].version,
            resource: capability.crdsByContext[ctx].resource,
          }
        : undefined,
      suspended: row.suspended,
    }),
    [capability.crdsByContext],
  )
  const onRowClick = useCallback(
    (row: FluxHelmReleaseInfo, ctx: string) => {
      if (!capability.crdsByContext[ctx]) return
      setSelectedResource(rowResource(row, ctx))
    },
    [capability.crdsByContext, rowResource, setSelectedResource],
  )

  if (capability.supportedContexts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Flux HelmRelease CRD is not present in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">helm.toolkit.fluxcd.io</code> CRD is missing —
          Flux is partly installed or the helm-controller is disabled.
        </div>
      </div>
    )
  }

  if (!capability.pending && capability.readyContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for HelmRelease: {Object.values(capability.errors).join('; ')}
      </div>
    )
  }

  if (capability.pending) {
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
