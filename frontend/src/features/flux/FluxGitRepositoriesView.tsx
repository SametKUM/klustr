import { useCallback, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { ExternalLink } from 'lucide-react'
import { api, type FluxGitRepositoryInfo } from '@/lib/api'
import { BrowserOpenURL } from '@/lib/wails/wailsjs/runtime/runtime'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useCustomResourceWatch } from '@/features/_shared/useCustomResourceWatch'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { type ByContext } from '@/store/resources'
import { useCRDStore } from '@/store/crds'
import { useIsAggregated, useUIStore, type SelectedResource } from '@/store/ui'
import {
  FLUX_GITREPOSITORY_RESOURCE,
  FLUX_SOURCE_GROUP,
} from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxGitRepositoryInfo>()
const EMPTY: FluxGitRepositoryInfo[] = []

export function FluxGitRepositoriesView() {
  const selectedContext = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const crd = useCRDStore(
    (s) =>
      s.crds.find(
        (c) => c.group === FLUX_SOURCE_GROUP && c.resource === FLUX_GITREPOSITORY_RESOURCE,
      ) ?? null,
  )

  const [rows, setRows] = useState<FluxGitRepositoryInfo[]>(EMPTY)
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
      columnHelper.accessor('url', {
        header: 'URL',
        cell: (i) => <RepoLink url={i.getValue()} />,
      }),
      columnHelper.accessor('ref', { header: 'Ref', size: COL_MD }),
      columnHelper.accessor('revision', {
        header: 'Revision',
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
          if (!selectedContext) return null
          return (
            <div className="flex items-center gap-1">
              <ReconcileFluxResourceButton
                contextName={selectedContext}
                kind="FluxGitRepository"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={selectedContext}
                kind="FluxGitRepository"
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

  const data = useMemo<ByContext<FluxGitRepositoryInfo>>(
    () => (selectedContext ? { [selectedContext]: rows } : {}),
    [selectedContext, rows],
  )
  const setData = useCallback(
    (_ctx: string, list: FluxGitRepositoryInfo[]) => setRows(list),
    [],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) => api.listFluxGitRepositories(ctx, ns),
    [],
  )
  const rowResource = useCallback(
    (row: FluxGitRepositoryInfo, ctx: string): SelectedResource => ({
      kind: 'FluxGitRepository',
      namespace: row.namespace,
      name: row.name,
      context: ctx,
      gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
      suspended: row.suspended,
    }),
    [crd],
  )
  const onRowClick = useCallback(
    (row: FluxGitRepositoryInfo, ctx: string) => {
      if (!crd) return
      setSelectedResource(rowResource(row, ctx))
    },
    [crd, rowResource, setSelectedResource],
  )

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        Flux GitRepositories are only available in single-context mode.
      </div>
    )
  }

  if (!crd) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-sm">Flux source-controller CRD is not present in this cluster.</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-destructive">
        Failed to start watch for GitRepository: {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Starting watch for GitRepository…
      </div>
    )
  }

  return (
    <ResourceTable
      kind={`cr:${FLUX_SOURCE_GROUP}/${FLUX_GITREPOSITORY_RESOURCE}`}
      noun={{ singular: 'gitrepository', plural: 'gitrepositories' }}
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

function formatRepoLabel(url: string): string {
  let label = url
  label = label.replace(/^https?:\/\//, '')
  label = label.replace(/^git@/, '')
  label = label.replace(/:\d+\//, '/')
  label = label.replace(/\.git$/, '')
  label = label.replace(/^([^/:]+):/, '$1/')
  return label
}

function toBrowserURL(url: string): string {
  if (/^https?:\/\//.test(url)) return url.replace(/\.git$/, '')
  const m = url.match(/^git@([^:]+):(.+?)(\.git)?$/)
  if (m) return `https://${m[1]}/${m[2]}`
  return url
}

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
