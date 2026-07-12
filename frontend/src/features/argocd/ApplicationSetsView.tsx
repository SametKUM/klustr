import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ArgoApplicationSetInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useContextResourceData } from '@/features/_shared/useContextResourceData'
import { useCustomResourceCapability } from '@/features/_shared/useCustomResourceCapability'
import { CustomResourcePartialWarning } from '@/features/_shared/CustomResourcePartialWarning'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useUIStore, type SelectedResource } from '@/store/ui'

const ARGO_GROUP = 'argoproj.io'
const ARGO_RESOURCE = 'applicationsets'

const columnHelper = createColumnHelper<ArgoApplicationSetInfo>()
export function ApplicationSetsView() {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const capability = useCustomResourceCapability(ARGO_GROUP, ARGO_RESOURCE)
  const { data, setData } = useContextResourceData<ArgoApplicationSetInfo>(
    capability.activeContexts,
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('generatorTypes', {
        header: 'Generators',
        cell: (i) => <GeneratorChips types={i.getValue()} />,
        sortingFn: (a, b) =>
          (a.original.generatorTypes[0] ?? '').localeCompare(b.original.generatorTypes[0] ?? ''),
      }),
      columnHelper.accessor('appCount', {
        header: 'Apps',
        size: COL_SM,
        cell: (i) => <span className="font-mono">{i.getValue()}</span>,
      }),
      columnHelper.accessor('healthyCount', {
        header: 'Healthy',
        size: COL_SM,
        cell: (i) => <HealthRatio healthy={i.getValue()} total={i.row.original.appCount} />,
      }),
      columnHelper.accessor('syncedCount', {
        header: 'Synced',
        size: COL_SM,
        cell: (i) => <HealthRatio healthy={i.getValue()} total={i.row.original.appCount} />,
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
      capability.crdsByContext[ctx] ? api.listArgoApplicationSets(ctx, ns) : Promise.resolve([]),
    [capability.crdsByContext],
  )
  const rowResource = useCallback(
    (row: ArgoApplicationSetInfo, ctx: string): SelectedResource => ({
      kind: 'ApplicationSet',
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
    (row: ArgoApplicationSetInfo, ctx: string) => {
      if (!capability.crdsByContext[ctx]) return
      setSelectedResource(rowResource(row, ctx))
    },
    [capability.crdsByContext, rowResource, setSelectedResource],
  )

  if (capability.supportedContexts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">The ApplicationSet controller is not installed.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          Install the Argo CD ApplicationSet controller (bundled with the Argo CD Helm chart by
          default) and reconnect.
        </div>
      </div>
    )
  }

  if (!capability.pending && capability.readyContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for ApplicationSet: {Object.values(capability.errors).join('; ')}
      </div>
    )
  }

  if (capability.pending) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for ApplicationSet…
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CustomResourcePartialWarning errors={capability.errors} />
      <ResourceTable
        kind={`cr:${ARGO_GROUP}/${ARGO_RESOURCE}`}
        noun={{ singular: 'applicationset', plural: 'applicationsets' }}
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

function GeneratorChips({ types }: { types: string[] }) {
  if (types.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {types.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {t}
        </span>
      ))}
    </span>
  )
}

function HealthRatio({ healthy, total }: { healthy: number; total: number }) {
  if (total === 0) return <span className="text-muted-foreground">—</span>
  const cls =
    healthy === total
      ? 'text-emerald-600 dark:text-emerald-400'
      : healthy === 0
        ? 'text-destructive'
        : 'text-amber-600 dark:text-amber-400'
  return (
    <span className={`font-mono ${cls}`}>
      {healthy}/{total}
    </span>
  )
}
