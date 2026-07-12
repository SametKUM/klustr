import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type IstioPeerAuthenticationInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ISTIO_SECURITY_GROUP, ISTIO_PEERAUTHENTICATION_RESOURCE } from './istioKinds'

const columnHelper = createColumnHelper<IstioPeerAuthenticationInfo>()

export function IstioPeerAuthenticationsView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('mtlsMode', { header: 'mTLS Mode', size: COL_SM }),
      columnHelper.accessor('selector', {
        header: 'Selector',
        size: COL_MD,
        cell: (i) =>
          i.row.original.selector === 'namespace-wide' ? (
            <span className="text-muted-foreground">namespace-wide</span>
          ) : (
            <span className="font-mono text-xs">{i.getValue()}</span>
          ),
      }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (i) => formatAge(i.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <CustomResourceTable
      group={ISTIO_SECURITY_GROUP}
      resource={ISTIO_PEERAUTHENTICATION_RESOURCE}
      kind="IstioPeerAuthentication"
      noun={{ singular: 'peerauthentication', plural: 'peerauthentications' }}
      scope="namespaced"
      fetch={api.listIstioPeerAuthentications}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="IstioPeerAuthentication is not installed in the active contexts."
    />
  )
}
