import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CiliumResourceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { CILIUM_GROUP, CILIUM_RESOURCES, type CiliumView } from './ciliumKinds'

const columnHelper = createColumnHelper<CiliumResourceInfo>()
const identity = (row: CiliumResourceInfo) => ({ namespace: row.namespace, name: row.name })

export function CiliumResourcesView({ resource }: { resource: CiliumView }) {
  const definition = CILIUM_RESOURCES[resource]
  const fetch = useCallback(
    (contextName: string, namespace: string) => api.listCiliumResources(contextName, resource, namespace),
    [resource],
  )
  const columns = useMemo(() => [
    ...(definition.scope === 'namespaced'
      ? [columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD })]
      : []),
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('state', {
      header: resource === 'ciliumendpoints' ? 'State' : 'Reported status',
      size: COL_MD,
      cell: (i) => <span title={i.getValue()}>{i.getValue() || '—'}</span>,
    }),
    columnHelper.accessor('primary', {
      header: definition.primary,
      size: 240,
      cell: (i) => <span title={i.getValue()}>{i.getValue() || '—'}</span>,
    }),
    ...(definition.secondary ? [columnHelper.accessor('secondary', {
      header: definition.secondary,
      size: COL_MD,
      cell: (i) => i.getValue() || '—',
    })] : []),
    columnHelper.accessor('createdAt', {
      header: 'Age', size: COL_SM, sortingFn: 'datetime', cell: (i) => formatAge(i.getValue()),
    }),
  ], [definition, resource])

  return <CustomResourceTable
    group={CILIUM_GROUP}
    resource={resource}
    kind={definition.kind}
    noun={{ singular: definition.kind, plural: definition.label }}
    scope={definition.scope}
    fetch={fetch}
    columns={columns}
    identity={identity}
    unavailableMessage={`${definition.kind} is not installed in the active contexts.`}
  />
}
