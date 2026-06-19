import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type PersistentVolumeInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { phaseClass } from '@/features/_shared/phaseColor'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<PersistentVolumeInfo>()

export function PersistentVolumesView() {
  const pvs = useResources((s) => s.persistentVolumes)
  const setPVs = useResources((s) => s.setPersistentVolumes)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('capacity', { header: 'Capacity', size: COL_SM }),
      columnHelper.accessor('accessModes', { header: 'Access Modes', size: COL_MD }),
      columnHelper.accessor('reclaimPolicy', { header: 'Reclaim', size: COL_SM }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: COL_SM,
        cell: (info) => <span className={phaseClass(info.getValue())}>{info.getValue()}</span>,
      }),
      columnHelper.accessor('claim', { header: 'Claim' }),
      columnHelper.accessor('storageClass', { header: 'Storage Class' }),
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
