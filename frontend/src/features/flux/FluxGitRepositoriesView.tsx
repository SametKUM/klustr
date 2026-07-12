import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { ExternalLink } from 'lucide-react'
import { api, type FluxGitRepositoryInfo } from '@/lib/api'
import { BrowserOpenURL } from '@/lib/wails/wailsjs/runtime/runtime'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { FLUX_GITREPOSITORY_RESOURCE, FLUX_SOURCE_GROUP } from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxGitRepositoryInfo>()

export function FluxGitRepositoriesView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <FluxReadyPill value={i.getValue()} suspended={i.row.original.suspended} />,
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
          const contextName = resourceContext(row)
          if (!contextName) return null
          return (
            <div className="flex items-center gap-1">
              <ReconcileFluxResourceButton
                contextName={contextName}
                kind="FluxGitRepository"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={contextName}
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
    [],
  )

  return (
    <CustomResourceTable
      group={FLUX_SOURCE_GROUP}
      resource={FLUX_GITREPOSITORY_RESOURCE}
      kind="FluxGitRepository"
      noun={{ singular: 'gitrepository', plural: 'gitrepositories' }}
      scope="namespaced"
      fetch={api.listFluxGitRepositories}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      extras={(row) => ({ suspended: row.suspended })}
      unavailableMessage="FluxGitRepository is not installed in the active contexts."
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
