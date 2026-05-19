import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CronJobInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<CronJobInfo>()

export function CronJobsView() {
  const cronJobs = useResources((s) => s.cronJobs)
  const setCronJobs = useResources((s) => s.setCronJobs)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('schedule', {
        header: 'Schedule',
        size: COL_MD,
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('suspend', {
        header: 'Suspend',
        size: COL_XS,
        cell: (info) => (info.getValue() ? 'true' : 'false'),
      }),
      columnHelper.accessor('active', { header: 'Active', size: COL_XS }),
      columnHelper.accessor('lastSchedule', {
        header: 'Last Schedule',
        size: COL_SM,
        cell: (info) => (info.getValue() ? formatAge(info.getValue()) : '—'),
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <ResourceTable
      kind="CronJob"
      noun={{ singular: 'cronjob', plural: 'cronjobs' }}
      scope="namespaced"
      data={cronJobs}
      setData={setCronJobs}
      fetch={api.listCronJobs}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'CronJob', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
