import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type HorizontalPodAutoscalerInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { HPATargetBars } from './HPATargetBars'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<HorizontalPodAutoscalerInfo>()

export function HorizontalPodAutoscalersView() {
  const hpas = useResources((s) => s.horizontalPodAutoscalers)
  const setHPAs = useResources((s) => s.setHorizontalPodAutoscalers)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('reference', { header: 'Reference' }),
      columnHelper.accessor('metrics', {
        header: 'Targets',
        cell: (info) => <HPATargetBars metrics={info.getValue() ?? []} />,
        enableSorting: false,
      }),
      columnHelper.accessor('minReplicas', { header: 'Min' }),
      columnHelper.accessor('maxReplicas', { header: 'Max' }),
      columnHelper.accessor('currentReplicas', { header: 'Replicas' }),
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
      kind="HorizontalPodAutoscaler"
      noun={{ singular: 'HPA', plural: 'HPAs' }}
      scope="namespaced"
      data={hpas}
      setData={setHPAs}
      fetch={api.listHorizontalPodAutoscalers}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'HorizontalPodAutoscaler', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
