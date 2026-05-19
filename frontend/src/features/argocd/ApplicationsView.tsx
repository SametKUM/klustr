import { useCallback, useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { RefreshCcw, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api, type CustomResourceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore, crdKey } from '@/store/crds'
import { useIsAggregated, useUIStore } from '@/store/ui'

const ARGO_GROUP = 'argoproj.io'
const ARGO_RESOURCE = 'applications'

const columnHelper = createColumnHelper<CustomResourceInfo>()
const EMPTY: CustomResourceInfo[] = []

export function ApplicationsView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) => s.crds.find((c) => c.group === ARGO_GROUP && c.resource === ARGO_RESOURCE) ?? null,
  )
  const key = crd ? crdKey(crd) : null
  const customResources = useCRDStore((s) =>
    key ? s.customResources[key] ?? EMPTY : EMPTY,
  )
  const setCustomResources = useCRDStore((s) => s.setCustomResources)

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

  const onSync = useCallback(
    async (row: CustomResourceInfo) => {
      if (!selectedContext) return
      try {
        await api.syncArgoApplication(selectedContext, row.namespace, row.name, '', true)
        toast.success(`Syncing ${row.namespace}/${row.name}`)
      } catch (e) {
        toast.error(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [selectedContext],
  )

  const onRefresh = useCallback(
    async (row: CustomResourceInfo) => {
      if (!selectedContext) return
      try {
        await api.refreshArgoApplication(selectedContext, row.namespace, row.name, 'normal')
        toast.success(`Refreshing ${row.namespace}/${row.name}`)
      } catch (e) {
        toast.error(`Refresh failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [selectedContext],
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor((r) => r.cells?.['Sync Status'] ?? '', {
        id: 'sync',
        header: 'Sync',
        size: COL_SM,
        cell: (i) => <SyncPill value={i.getValue() as string} />,
      }),
      columnHelper.accessor((r) => r.cells?.['Health Status'] ?? '', {
        id: 'health',
        header: 'Health',
        size: COL_SM,
        cell: (i) => <HealthPill value={i.getValue() as string} />,
      }),
      columnHelper.accessor((r) => r.cells?.Revision ?? '', {
        id: 'revision',
        header: 'Revision',
        size: COL_SM,
        cell: (i) => {
          const v = i.getValue() as string
          return v ? <span className="font-mono text-xs">{v.slice(0, 8)}</span> : <span className="text-muted-foreground">—</span>
        },
      }),
      columnHelper.accessor((r) => r.cells?.Project ?? '', {
        id: 'project',
        header: 'Project',
        size: COL_MD,
        cell: (i) => {
          const v = i.getValue() as string
          return v ? <span>{v}</span> : <span className="text-muted-foreground">—</span>
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        size: 170,
        cell: (i) => (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onRefresh(i.row.original)
              }}
              title="Force Argo to re-evaluate this Application"
            >
              <RefreshCcw className="size-3" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onSync(i.row.original)
              }}
              title="Trigger a sync to the target revision"
            >
              <RotateCw className="size-3" />
              Sync
            </Button>
          </div>
        ),
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [onSync, onRefresh],
  )

  const data = useMemo<ByContext<CustomResourceInfo>>(
    () => (selectedContext ? { [selectedContext]: customResources } : {}),
    [selectedContext, customResources],
  )
  const setData = useCallback(
    (_ctx: string, list: CustomResourceInfo[]) => {
      if (key) setCustomResources(key, list)
    },
    [key, setCustomResources],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) =>
      crd
        ? api.listCustomResources(ctx, crd.group, crd.version, crd.resource, ns)
        : Promise.resolve([] as CustomResourceInfo[]),
    [crd],
  )
  const onRowClick = useCallback(
    (row: CustomResourceInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource({
        kind: 'Application',
        namespace: row.namespace,
        name: row.name,
        context: ctx,
        gvr: { group: crd.group, version: crd.version, resource: crd.resource },
      })
    },
    [crd, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Argo CD Applications are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Argo CD is not installed in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">applications.argoproj.io</code> CRD is not
          present. Install Argo CD (e.g. <code className="rounded bg-muted px-1">helm install
          argo-cd argo/argo-cd -n argocd --create-namespace</code>) and reconnect.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for Application: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for Application…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${ARGO_GROUP}/${ARGO_RESOURCE}`}
      noun={{ singular: 'application', plural: 'applications' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={fetch}
      columns={columns}
      onRowClick={onRowClick}
    />
  )
}

function SyncPill({ value }: { value: string }) {
  const cls =
    value === 'Synced'
      ? 'text-emerald-600 dark:text-emerald-400'
      : value === 'OutOfSync'
        ? 'text-amber-600 dark:text-amber-400 font-medium'
        : 'text-muted-foreground'
  return <span className={cls}>{value || '—'}</span>
}

function HealthPill({ value }: { value: string }) {
  const cls =
    value === 'Healthy'
      ? 'text-emerald-600 dark:text-emerald-400'
      : value === 'Degraded' || value === 'Missing'
        ? 'text-destructive font-medium'
        : value === 'Progressing' || value === 'Suspended'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-muted-foreground'
  return <span className={cls}>{value || '—'}</span>
}
