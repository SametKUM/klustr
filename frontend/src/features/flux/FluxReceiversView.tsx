import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type FluxReceiverInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { FLUX_NOTIFICATION_GROUP, FLUX_RECEIVER_RESOURCE } from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxReceiverInfo>()

export function FluxReceiversView() {
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
      columnHelper.accessor('resourceCount', {
        header: 'Resources',
        size: COL_SM,
        cell: (i) => `${i.getValue()} ${i.getValue() === 1 ? 'resource' : 'resources'}`,
      }),
      columnHelper.accessor('webhookPath', {
        header: 'Webhook Path',
        cell: (i) => {
          const v = i.getValue()
          if (!v) {
            return <span className="text-muted-foreground">— (not ready)</span>
          }
          return <span className="font-mono text-xs">{v}</span>
        },
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
                kind="FluxReceiver"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={contextName}
                kind="FluxReceiver"
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
      resource={FLUX_RECEIVER_RESOURCE}
      kind="FluxReceiver"
      noun={{ singular: 'receiver', plural: 'receivers' }}
      scope="namespaced"
      fetch={api.listFluxReceivers}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      extras={(row) => ({ suspended: row.suspended })}
      unavailableMessage="FluxReceiver is not installed in the active contexts."
    />
  )
}
