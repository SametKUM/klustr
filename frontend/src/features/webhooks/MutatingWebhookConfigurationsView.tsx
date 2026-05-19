import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type WebhookConfigurationInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<WebhookConfigurationInfo>()

export function MutatingWebhookConfigurationsView() {
  const list = useResources((s) => s.mutatingWebhookConfigurations)
  const setList = useResources((s) => s.setMutatingWebhookConfigurations)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('webhooks', { header: 'Webhooks', size: COL_XS }),
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
      kind="MutatingWebhookConfiguration"
      noun={{ singular: 'mutating webhook config', plural: 'mutating webhook configs' }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listMutatingWebhookConfigurations(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'MutatingWebhookConfiguration', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
