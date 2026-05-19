import { useCallback, useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { ExternalLink, RefreshCcw, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api, type ArgoApplicationInfo } from '@/lib/api'
import { BrowserOpenURL } from '@/lib/wails/wailsjs/runtime/runtime'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore } from '@/store/ui'

const ARGO_GROUP = 'argoproj.io'
const ARGO_RESOURCE = 'applications'

const columnHelper = createColumnHelper<ArgoApplicationInfo>()
const EMPTY: ArgoApplicationInfo[] = []

export function ApplicationsView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) => s.crds.find((c) => c.group === ARGO_GROUP && c.resource === ARGO_RESOURCE) ?? null,
  )

  const [rows, setRows] = useState<ArgoApplicationInfo[]>(EMPTY)
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
    async (row: ArgoApplicationInfo) => {
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
    async (row: ArgoApplicationInfo) => {
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
      columnHelper.accessor('sync', {
        header: 'Sync',
        size: COL_SM,
        cell: (i) => <SyncPill value={i.getValue()} />,
      }),
      columnHelper.accessor('health', {
        header: 'Health',
        size: COL_SM,
        cell: (i) => <HealthPill value={i.getValue()} />,
      }),
      columnHelper.accessor('autoSync', {
        header: 'Auto-sync',
        size: COL_SM,
        cell: (i) => <AutoSyncPill row={i.row.original} />,
        sortingFn: (a, b) => Number(a.original.autoSync) - Number(b.original.autoSync),
      }),
      columnHelper.accessor('revision', {
        header: 'Revision',
        size: COL_SM,
        cell: (i) => {
          const v = i.getValue()
          return v ? <span className="font-mono text-xs">{v.slice(0, 8)}</span> : <span className="text-muted-foreground">—</span>
        },
      }),
      columnHelper.accessor('repoURL', {
        header: 'Repo',
        cell: (i) => <RepoLink url={i.getValue()} />,
      }),
      columnHelper.accessor('project', {
        header: 'Project',
        size: COL_MD,
        cell: (i) => {
          const v = i.getValue()
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

  const data = useMemo<ByContext<ArgoApplicationInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: ArgoApplicationInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listArgoApplications(ctx, ns),
    [],
  )
  const onRowClick = useCallback(
    (row: ArgoApplicationInfo, ctx: string) => {
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

function AutoSyncPill({ row }: { row: ArgoApplicationInfo }) {
  if (!row.autoSync) {
    return <span className="text-muted-foreground">Manual</span>
  }
  const extras: string[] = []
  if (row.selfHeal) extras.push('self-heal')
  if (row.prune) extras.push('prune')
  const title = extras.length > 0 ? `Auto-sync (${extras.join(', ')})` : 'Auto-sync'
  return (
    <span className="text-emerald-600 dark:text-emerald-400" title={title}>
      Auto
    </span>
  )
}

function RepoLink({ url }: { url: string }) {
  if (!url) return <span className="text-muted-foreground">—</span>
  const label = formatRepoLabel(url)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        BrowserOpenURL(toBrowserURL(url))
      }}
      title={url}
      className="inline-flex items-center gap-1 rounded font-mono text-xs text-foreground hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="truncate">{label}</span>
      <ExternalLink className="size-3 shrink-0 opacity-60" />
    </button>
  )
}

// Strip protocol + .git suffix + git@ prefix so the cell stays short.
function formatRepoLabel(url: string): string {
  let label = url
  label = label.replace(/^https?:\/\//, '')
  label = label.replace(/^git@/, '')
  label = label.replace(/:\d+\//, '/') // port like ":22/"
  label = label.replace(/\.git$/, '')
  label = label.replace(/^([^/:]+):/, '$1/') // git@host:owner/repo -> host/owner/repo
  return label
}

// Best-effort conversion from a git remote URL to something a browser can
// open. SSH-style refs (git@github.com:owner/repo.git) get rewritten to
// https://github.com/owner/repo.
function toBrowserURL(url: string): string {
  if (/^https?:\/\//.test(url)) return url.replace(/\.git$/, '')
  const m = url.match(/^git@([^:]+):(.+?)(\.git)?$/)
  if (m) return `https://${m[1]}/${m[2]}`
  return url
}
