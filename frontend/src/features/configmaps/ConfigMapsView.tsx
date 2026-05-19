import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ConfigMapInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ConfigMapInfo>()

export function ConfigMapsView() {
  const configMaps = useResources((s) => s.configMaps)
  const setConfigMaps = useResources((s) => s.setConfigMaps)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('keys', { header: 'Keys', size: COL_XS }),
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
      kind="ConfigMap"
      noun={{ singular: 'configmap', plural: 'configmaps' }}
      scope="namespaced"
      data={configMaps}
      setData={setConfigMaps}
      fetch={api.listConfigMaps}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'ConfigMap', namespace: row.namespace, name: row.name, context: ctx })
      }
    />
  )
}
