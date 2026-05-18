import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type PersistentVolumeInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<PersistentVolumeInfo>()

function phaseClass(phase: string): string {
  if (phase === 'Bound') return 'text-emerald-600 dark:text-emerald-400'
  if (phase === 'Available') return 'text-foreground'
  if (phase === 'Released') return 'text-amber-600 dark:text-amber-400'
  if (phase === 'Failed') return 'text-destructive'
  return 'text-muted-foreground'
}

export function PersistentVolumesView() {
  const pvs = useResources((s) => s.persistentVolumes)
  const setPVs = useResources((s) => s.setPersistentVolumes)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('capacity', { header: 'Capacity' }),
      columnHelper.accessor('accessModes', { header: 'Access Modes' }),
      columnHelper.accessor('reclaimPolicy', { header: 'Reclaim' }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <span className={phaseClass(info.getValue())}>{info.getValue()}</span>,
      }),
      columnHelper.accessor('claim', { header: 'Claim' }),
      columnHelper.accessor('storageClass', { header: 'Storage Class' }),
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
      kind="PersistentVolume"
      noun={{ singular: 'PV', plural: 'PVs' }}
      scope="cluster"
      data={pvs}
      setData={setPVs}
      fetch={(ctx) => api.listPersistentVolumes(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'PersistentVolume', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
