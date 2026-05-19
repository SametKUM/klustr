import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type PersistentVolumeClaimInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<PersistentVolumeClaimInfo>()

function phaseClass(phase: string): string {
  if (phase === 'Bound') return 'text-emerald-600 dark:text-emerald-400'
  if (phase === 'Pending') return 'text-amber-600 dark:text-amber-400'
  if (phase === 'Lost') return 'text-destructive'
  return 'text-muted-foreground'
}

export function PersistentVolumeClaimsView() {
  const pvcs = useResources((s) => s.persistentVolumeClaims)
  const setPVCs = useResources((s) => s.setPersistentVolumeClaims)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: COL_SM,
        cell: (info) => <span className={phaseClass(info.getValue())}>{info.getValue()}</span>,
      }),
      columnHelper.accessor('volume', { header: 'Volume' }),
      columnHelper.accessor('capacity', { header: 'Capacity', size: COL_SM }),
      columnHelper.accessor('accessModes', { header: 'Access Modes', size: COL_MD }),
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
      kind="PersistentVolumeClaim"
      noun={{ singular: 'PVC', plural: 'PVCs' }}
      scope="namespaced"
      data={pvcs}
      setData={setPVCs}
      fetch={api.listPersistentVolumeClaims}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'PersistentVolumeClaim', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
