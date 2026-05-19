import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type WebhookConfigurationInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
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
