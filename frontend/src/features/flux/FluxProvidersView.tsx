import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Lock } from 'lucide-react'
import { api, type FluxProviderInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { FLUX_NOTIFICATION_GROUP, FLUX_PROVIDER_RESOURCE } from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxProviderInfo>()

export function FluxProvidersView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <FluxReadyPill value={i.getValue()} suspended={i.row.original.suspended} />,
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        size: COL_SM,
        cell: (i) => <span className="font-mono text-xs">{i.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('channel', { header: 'Channel', size: COL_MD }),
      columnHelper.accessor('address', {
        header: 'Address',
        cell: (i) => <AddressCell row={i.row.original} />,
      }),
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
                kind="FluxProvider"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={contextName}
                kind="FluxProvider"
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
      group={FLUX_NOTIFICATION_GROUP}
      resource={FLUX_PROVIDER_RESOURCE}
      kind="FluxProvider"
      noun={{ singular: 'provider', plural: 'providers' }}
      scope="namespaced"
      fetch={api.listFluxProviders}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      extras={(row) => ({ suspended: row.suspended })}
      unavailableMessage="FluxProvider is not installed in the active contexts."
    />
  )
}

// AddressCell renders inline addresses verbatim but elides Secret-backed
// ones into a chip — a webhook URL pasted into a screenshot can leak a
// bearer token, so make the from-Secret case visually distinct.
function AddressCell({ row }: { row: FluxProviderInfo }) {
  if (row.addressFromSecret) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        <Lock className="size-3" /> from Secret
      </span>
    )
  }
  if (row.address) {
    return <span className="font-mono text-xs">{redactToken(row.address)}</span>
  }
  return <span className="text-muted-foreground">—</span>
}

// redactToken keeps the host + path shape visible (so the user can sanity-
// check the integration target) but masks the path segments that commonly
// carry secrets (e.g. Slack's /services/T.../B.../X...).
function redactToken(url: string): string {
  return url.replace(/(\/services\/[^/]+\/)[^/]+(\/.+)?/, '$1•••$2')
}
