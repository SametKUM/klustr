import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CertManagerCertificateRequestInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { CERT_MANAGER_CERTIFICATEREQUEST_RESOURCE, CERT_MANAGER_GROUP } from './certManagerKinds'

const columnHelper = createColumnHelper<CertManagerCertificateRequestInfo>()

export function CertificateRequestsView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('approved', {
        header: 'Approved',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
      }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
      }),
      columnHelper.accessor('issuer', {
        header: 'Issuer',
        size: COL_MD,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: COL_MD,
        cell: (i) => (
          <span className="truncate text-xs text-muted-foreground" title={i.getValue()}>
            {i.getValue() || '—'}
          </span>
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
      group={CERT_MANAGER_GROUP}
      resource={CERT_MANAGER_CERTIFICATEREQUEST_RESOURCE}
      kind="CertificateRequest"
      noun={{ singular: 'certificate request', plural: 'certificate requests' }}
      scope="namespaced"
      fetch={api.listCertManagerCertificateRequests}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="CertificateRequest is not installed in the active contexts."
    />
  )
}
