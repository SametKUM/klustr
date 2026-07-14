import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { ExternalLink, RefreshCcw, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api, type ArgoApplicationInfo } from '@/lib/api'
import { BrowserOpenURL } from '@/lib/wails/wailsjs/runtime/runtime'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { useContextResourceData } from '@/features/_shared/useContextResourceData'
import { useCustomResourceCapability } from '@/features/_shared/useCustomResourceCapability'
import { CustomResourcePartialWarning } from '@/features/_shared/CustomResourcePartialWarning'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useUIStore, type SelectedResource } from '@/store/ui'
import { HealthPill, SyncPill } from './ApplicationResourcesTab'
import { SuspendResumeArgoApplicationButton } from './SuspendResumeArgoApplicationButton'
import { SyncArgoApplicationDialog } from './SyncArgoApplicationDialog'

const ARGO_GROUP = 'argoproj.io'
const ARGO_RESOURCE = 'applications'

const columnHelper = createColumnHelper<ArgoApplicationInfo>()
type SyncTarget = { contextName: string; row: ArgoApplicationInfo }

export function ApplicationsView() {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const capability = useCustomResourceCapability(ARGO_GROUP, ARGO_RESOURCE)
  const { data, setData } = useContextResourceData<ArgoApplicationInfo>(capability.activeContexts)
  const [syncTarget, setSyncTarget] = useState<SyncTarget | null>(null)

  const onSync = useCallback(
    (row: ArgoApplicationInfo, contextName: string) => setSyncTarget({ row, contextName }),
    [],
  )

  const onRefresh = useCallback(async (row: ArgoApplicationInfo, contextName: string) => {
    if (!contextName) return
    try {
      await api.refreshArgoApplication(contextName, row.namespace, row.name, 'normal')
      toast.success(`Refreshing ${row.namespace}/${row.name}`)
    } catch (e) {
      toast.error(`Refresh failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [])

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
          return v ? (
            <span className="font-mono text-xs">{v.slice(0, 8)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
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
        size: 260,
        cell: (i) => {
          const row = i.row.original
          const contextName = resourceContext(row)
          return (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onRefresh(row, contextName)
                }}
                title="Force Argo to re-evaluate this Application"
              >
                <RefreshCcw className="size-3" />
                Refresh
              </Button>
              {contextName && (
                <SuspendResumeArgoApplicationButton
                  contextName={contextName}
                  namespace={row.namespace}
                  name={row.name}
                  autoSync={row.autoSync}
                  variant="row"
                />
              )}
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onSync(row, contextName)
                }}
                title="Trigger a sync to the target revision"
              >
                <RotateCw className="size-3" />
                Sync
              </Button>
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
    [onSync, onRefresh],
  )

  const fetch = useCallback(
    (ctx: string, ns: string) =>
      capability.crdsByContext[ctx] ? api.listArgoApplications(ctx, ns) : Promise.resolve([]),
    [capability.crdsByContext],
  )
  const rowResource = useCallback(
    (row: ArgoApplicationInfo, ctx: string): SelectedResource => ({
      kind: 'Application',
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
    (row: ArgoApplicationInfo, ctx: string) => {
      if (!capability.crdsByContext[ctx]) return
      setSelectedResource(rowResource(row, ctx))
    },
    [capability.crdsByContext, rowResource, setSelectedResource],
  )

  if (capability.supportedContexts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Argo CD is not installed in this cluster.</div>
        <div className="max-w-md text-xs text-muted-foreground">
          The <code className="rounded bg-muted px-1">applications.argoproj.io</code> CRD is not
          present. Install Argo CD (e.g.{' '}
          <code className="rounded bg-muted px-1">
            helm install argo-cd argo/argo-cd -n argocd --create-namespace
          </code>
          ) and reconnect.
        </div>
      </div>
    )
  }

  if (!capability.pending && capability.readyContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for Application: {Object.values(capability.errors).join('; ')}
      </div>
    )
  }

  if (capability.pending) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for Application…
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CustomResourcePartialWarning errors={capability.errors} />
      <ResourceTable
        kind={`cr:${ARGO_GROUP}/${ARGO_RESOURCE}`}
        noun={{ singular: 'application', plural: 'applications' }}
        scope="namespaced"
        data={data}
        setData={setData}
        fetch={fetch}
        contexts={capability.supportedContexts}
        columns={columns}
        onRowClick={onRowClick}
        rowResource={rowResource}
      />
      <SyncArgoApplicationDialog
        contextName={syncTarget?.contextName ?? null}
        namespace={syncTarget?.row.namespace ?? ''}
        name={syncTarget?.row.name ?? ''}
        open={syncTarget !== null}
        onOpenChange={(o) => {
          if (!o) setSyncTarget(null)
        }}
      />
    </div>
  )
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
      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded font-mono text-xs text-foreground hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 truncate">{label}</span>
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
