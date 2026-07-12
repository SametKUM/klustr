import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type FluxOCIRepositoryInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { FLUX_OCIREPOSITORY_RESOURCE, FLUX_SOURCE_GROUP } from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxOCIRepositoryInfo>()

export function FluxOCIRepositoriesView() {
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
        cell: (i) => <span className="font-mono text-xs">{i.getValue() || '—'}</span>,
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
                kind="FluxOCIRepository"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={contextName}
                kind="FluxOCIRepository"
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
      resource={FLUX_OCIREPOSITORY_RESOURCE}
      kind="FluxOCIRepository"
      noun={{ singular: 'ocirepository', plural: 'ocirepositories' }}
      scope="namespaced"
      fetch={api.listFluxOCIRepositories}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      extras={(row) => ({ suspended: row.suspended })}
      unavailableMessage="FluxOCIRepository is not installed in the active contexts."
    />
  )
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
