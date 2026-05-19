import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type DeploymentInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<DeploymentInfo>()

function readyClass(ready: string): string {
  const [got, want] = ready.split('/').map((n) => Number.parseInt(n, 10))
  if (Number.isNaN(got) || Number.isNaN(want)) return 'text-foreground'
  if (want === 0) return 'text-muted-foreground'
  if (got >= want) return 'text-emerald-600 dark:text-emerald-400'
  if (got === 0) return 'text-destructive'
  return 'text-amber-600 dark:text-amber-400'
}

export function DeploymentsView() {
  const deployments = useResources((s) => s.deployments)
  const setDeployments = useResources((s) => s.setDeployments)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_XS,
        cell: (info) => <span className={readyClass(info.getValue())}>{info.getValue()}</span>,
      }),
      columnHelper.accessor('upToDate', { header: 'Up-to-date', size: COL_SM }),
      columnHelper.accessor('available', { header: 'Available', size: COL_SM }),
      columnHelper.accessor('strategy', { header: 'Strategy', size: COL_MD }),
      columnHelper.accessor('images', {
        header: 'Images',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
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
      kind="Deployment"
      noun={{ singular: 'deployment', plural: 'deployments' }}
      scope="namespaced"
      data={deployments}
      setData={setDeployments}
      fetch={api.listDeployments}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'Deployment', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
