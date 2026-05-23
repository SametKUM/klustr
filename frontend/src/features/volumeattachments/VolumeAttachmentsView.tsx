import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type VolumeAttachmentInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<VolumeAttachmentInfo>()

export function VolumeAttachmentsView() {
  const items = useResources((s) => s.volumeAttachments)
  const setItems = useResources((s) => s.setVolumeAttachments)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('attacher', { header: 'Driver' }),
      columnHelper.accessor('node', { header: 'Node' }),
      columnHelper.accessor('pv', { header: 'PV' }),
      columnHelper.accessor('attached', {
        header: 'Attached',
        size: COL_XS,
        cell: (info) => (info.getValue() ? 'yes' : 'no'),
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
      kind="VolumeAttachment"
      noun={{ singular: 'volume attachment', plural: 'volume attachments' }}
      scope="cluster"
      data={items}
      setData={setItems}
      fetch={(ctx) => api.listVolumeAttachments(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'VolumeAttachment',
          namespace: '',
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
