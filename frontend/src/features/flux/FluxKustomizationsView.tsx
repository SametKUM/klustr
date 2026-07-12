import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type FluxKustomizationInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { useContextResourceData } from '@/features/_shared/useContextResourceData'
import { useCustomResourceCapability } from '@/features/_shared/useCustomResourceCapability'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useUIStore, type SelectedResource } from '@/store/ui'
import { FLUX_KUSTOMIZATION_GROUP, FLUX_KUSTOMIZATION_RESOURCE } from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxKustomizationInfo>()
export function FluxKustomizationsView() {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const capability = useCustomResourceCapability(
    FLUX_KUSTOMIZATION_GROUP,
    FLUX_KUSTOMIZATION_RESOURCE,
  )
  const { data, setData } = useContextResourceData<FluxKustomizationInfo>(capability.activeContexts)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <FluxReadyPill value={i.getValue()} suspended={i.row.original.suspended} />,
      }),
      columnHelper.accessor('sourceRef', { header: 'Source', size: COL_MD }),
      columnHelper.accessor('path', { header: 'Path', size: COL_MD }),
      columnHelper.accessor('lastAppliedRevision', {
        header: 'Applied Revision',
        size: COL_MD,
        cell: (i) => {
          const v = i.getValue()
          return v ? (
            <span className="font-mono text-xs">{shortRevision(v)}</span>
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
                kind="FluxKustomization"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={contextName}
                kind="FluxKustomization"
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
      capability.crdsByContext[ctx] ? api.listFluxKustomizations(ctx, ns) : Promise.resolve([]),
    [capability.crdsByContext],
  )
  const rowResource = useCallback(
    (row: FluxKustomizationInfo, ctx: string): SelectedResource => ({
      kind: 'FluxKustomization',
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
    (row: FluxKustomizationInfo, ctx: string) => {
      if (!capability.crdsByContext[ctx]) return
      setSelectedResource(rowResource(row, ctx))
    },
    [capability.crdsByContext, rowResource, setSelectedResource],
  )

  if (capability.supportedContexts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Flux CD is not installed in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">kustomize.toolkit.fluxcd.io</code> CRD is not
          present. Install Flux (e.g.{' '}
          <code className="rounded bg-muted px-1">
            helm install flux2 fluxcd-community/flux2 -n flux-system --create-namespace
          </code>
          ) and reconnect.
        </div>
      </div>
    )
  }

  if (!capability.pending && capability.readyContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for Kustomization: {Object.values(capability.errors).join('; ')}
      </div>
    )
  }

  if (capability.pending) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for Kustomization…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${FLUX_KUSTOMIZATION_GROUP}/${FLUX_KUSTOMIZATION_RESOURCE}`}
      noun={{ singular: 'kustomization', plural: 'kustomizations' }}
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

// shortRevision keeps the first identifying chunk of a Flux revision. Flux
// reports revisions in either "branch@sha1:abc..." or bare "20.0.0" form;
// the table cell only has ~120 px so we collapse the long ones.
function shortRevision(rev: string): string {
  const at = rev.indexOf('@sha')
  if (at > 0) {
    const sha = rev.slice(at + 1)
    const colon = sha.indexOf(':')
    if (colon > 0 && sha.length > colon + 8) {
      return rev.slice(0, at) + '@' + sha.slice(0, colon + 8)
    }
  }
  return rev.length > 24 ? rev.slice(0, 24) + '…' : rev
}
