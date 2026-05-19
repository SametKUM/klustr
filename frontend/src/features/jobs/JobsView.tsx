import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type JobInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<JobInfo>()

function jobStatusClass(status: string): string {
  switch (status) {
    case 'Complete':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'Failed':
      return 'text-destructive'
    case 'Running':
      return 'text-amber-600 dark:text-amber-400'
    case 'Suspended':
      return 'text-muted-foreground'
    default:
      return 'text-foreground'
  }
}

export function JobsView() {
  const jobs = useResources((s) => s.jobs)
  const setJobs = useResources((s) => s.setJobs)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('completions', { header: 'Completions', size: COL_XS }),
      columnHelper.accessor('duration', { header: 'Duration', size: COL_SM }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: COL_SM,
        cell: (info) => <span className={jobStatusClass(info.getValue())}>{info.getValue()}</span>,
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
      kind="Job"
      noun={{ singular: 'job', plural: 'jobs' }}
      scope="namespaced"
      data={jobs}
      setData={setJobs}
      fetch={api.listJobs}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Job', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
