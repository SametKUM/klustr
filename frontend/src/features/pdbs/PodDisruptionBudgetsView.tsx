import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type PodDisruptionBudgetInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<PodDisruptionBudgetInfo>()

export function PodDisruptionBudgetsView() {
  const pdbs = useResources((s) => s.podDisruptionBudgets)
  const setPDBs = useResources((s) => s.setPodDisruptionBudgets)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('minAvailable', { header: 'Min Available' }),
      columnHelper.accessor('maxUnavailable', { header: 'Max Unavailable' }),
      columnHelper.accessor('currentHealthy', { header: 'Current' }),
      columnHelper.accessor('desiredHealthy', { header: 'Desired' }),
      columnHelper.accessor('allowed', { header: 'Allowed Disruptions' }),
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
      kind="PodDisruptionBudget"
      noun={{ singular: 'PDB', plural: 'PDBs' }}
      scope="namespaced"
      data={pdbs}
      setData={setPDBs}
      fetch={api.listPodDisruptionBudgets}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'PodDisruptionBudget', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
