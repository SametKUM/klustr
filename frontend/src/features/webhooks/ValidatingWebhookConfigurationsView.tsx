import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type WebhookConfigurationInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<WebhookConfigurationInfo>()

export function ValidatingWebhookConfigurationsView() {
  const list = useResources((s) => s.validatingWebhookConfigurations)
  const setList = useResources((s) => s.setValidatingWebhookConfigurations)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('webhooks', { header: 'Webhooks' }),
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
      kind="ValidatingWebhookConfiguration"
      noun={{ singular: 'validating webhook config', plural: 'validating webhook configs' }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listValidatingWebhookConfigurations(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'ValidatingWebhookConfiguration', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
