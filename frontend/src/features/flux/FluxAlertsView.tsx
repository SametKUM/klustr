import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type FluxAlertInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { FLUX_ALERT_RESOURCE, FLUX_NOTIFICATION_GROUP } from './fluxKinds'
import { FluxReadyPill } from './FluxReadyPill'
import { ReconcileFluxResourceButton } from './ReconcileFluxResourceButton'
import { SuspendResumeFluxResourceButton } from './SuspendResumeFluxResourceButton'

const columnHelper = createColumnHelper<FluxAlertInfo>()

export function FluxAlertsView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <FluxReadyPill value={i.getValue()} suspended={i.row.original.suspended} />,
      }),
      columnHelper.accessor('provider', { header: 'Provider', size: COL_MD }),
      columnHelper.accessor('severity', {
        header: 'Severity',
        size: COL_SM,
        cell: (i) => <SeverityChip value={i.getValue()} />,
      }),
      columnHelper.accessor('sources', { header: 'Sources' }),
      columnHelper.accessor('summary', {
        header: 'Summary',
        cell: (i) => {
          const v = i.getValue()
          return v ? v : <span className="text-muted-foreground">—</span>
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
                kind="FluxAlert"
                namespace={row.namespace}
                name={row.name}
                variant="row"
              />
              <SuspendResumeFluxResourceButton
                contextName={contextName}
                kind="FluxAlert"
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
      resource={FLUX_ALERT_RESOURCE}
      kind="FluxAlert"
      noun={{ singular: 'alert', plural: 'alerts' }}
      scope="namespaced"
      fetch={api.listFluxAlerts}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      extras={(row) => ({ suspended: row.suspended })}
      unavailableMessage="FluxAlert is not installed in the active contexts."
    />
  )
}

function SeverityChip({ value }: { value: string }) {
  if (value === 'error') {
    return (
      <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
        error
      </span>
    )
  }
  if (value === 'info' || value === '') {
    return (
      <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
        {value || 'info'}
      </span>
    )
  }
  return <span className="font-mono text-xs">{value}</span>
}
