import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ArgoAppProjectInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useContextResourceData } from '@/features/_shared/useContextResourceData'
import { useCustomResourceCapability } from '@/features/_shared/useCustomResourceCapability'
import { CustomResourcePartialWarning } from '@/features/_shared/CustomResourcePartialWarning'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useUIStore, type SelectedResource } from '@/store/ui'

const ARGO_GROUP = 'argoproj.io'
const ARGO_RESOURCE = 'appprojects'

const columnHelper = createColumnHelper<ArgoAppProjectInfo>()
export function AppProjectsView() {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const capability = useCustomResourceCapability(ARGO_GROUP, ARGO_RESOURCE)
  const { data, setData } = useContextResourceData<ArgoAppProjectInfo>(capability.activeContexts)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('description', {
        header: 'Description',
        cell: (i) => {
          const v = i.getValue()
          return v ? <span>{v}</span> : <span className="text-muted-foreground">—</span>
        },
      }),
      columnHelper.accessor('sourceRepoCount', {
        header: 'Repos',
        size: COL_SM,
        cell: (i) => <span className="font-mono">{i.getValue()}</span>,
      }),
      columnHelper.accessor('destinationCount', {
        header: 'Destinations',
        size: COL_SM,
        cell: (i) => <span className="font-mono">{i.getValue()}</span>,
      }),
      columnHelper.accessor('roleCount', {
        header: 'Roles',
        size: COL_SM,
        cell: (i) => <span className="font-mono">{i.getValue()}</span>,
      }),
      columnHelper.accessor('syncWindowCount', {
        header: 'Sync windows',
        size: COL_SM,
        cell: (i) => {
          const v = i.getValue()
          return v > 0 ? (
            <span className="font-mono">{v}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
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
      capability.crdsByContext[ctx] ? api.listArgoAppProjects(ctx, ns) : Promise.resolve([]),
    [capability.crdsByContext],
  )
  const rowResource = useCallback(
    (row: ArgoAppProjectInfo, ctx: string): SelectedResource => ({
      kind: 'AppProject',
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
    }),
    [capability.crdsByContext],
  )
  const onRowClick = useCallback(
    (row: ArgoAppProjectInfo, ctx: string) => {
      if (!capability.crdsByContext[ctx]) return
      setSelectedResource(rowResource(row, ctx))
    },
    [capability.crdsByContext, rowResource, setSelectedResource],
  )

  if (capability.supportedContexts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Argo CD is not installed in this cluster.</div>
      </div>
    )
  }

  if (!capability.pending && capability.readyContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for AppProject: {Object.values(capability.errors).join('; ')}
      </div>
    )
  }

  if (capability.pending) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for AppProject…
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CustomResourcePartialWarning errors={capability.errors} />
      <ResourceTable
        kind={`cr:${ARGO_GROUP}/${ARGO_RESOURCE}`}
        noun={{ singular: 'project', plural: 'projects' }}
        scope="namespaced"
        data={data}
        setData={setData}
        fetch={fetch}
        columns={columns}
        onRowClick={onRowClick}
        rowResource={rowResource}
      />
    </div>
  )
}
