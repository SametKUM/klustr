import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CronJobInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<CronJobInfo>()

export function CronJobsView() {
  const cronJobs = useResources((s) => s.cronJobs)
  const setCronJobs = useResources((s) => s.setCronJobs)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('schedule', {
        header: 'Schedule',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('suspend', {
        header: 'Suspend',
        cell: (info) => (info.getValue() ? 'true' : 'false'),
      }),
      columnHelper.accessor('active', { header: 'Active' }),
      columnHelper.accessor('lastSchedule', {
        header: 'Last Schedule',
        cell: (info) => (info.getValue() ? formatAge(info.getValue()) : '—'),
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
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
