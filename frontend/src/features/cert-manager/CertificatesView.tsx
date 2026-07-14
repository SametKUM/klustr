import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CertManagerCertificateInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { resourceContext } from '@/features/_shared/resourceContext'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { CertManagerConditionPill } from './CertManagerConditionPill'
import { CERT_MANAGER_CERTIFICATE_RESOURCE, CERT_MANAGER_GROUP } from './certManagerKinds'
import { ExpiryCell } from './ExpiryCell'
import { RenewCertificateButton } from './RenewCertificateButton'

const columnHelper = createColumnHelper<CertManagerCertificateInfo>()

export function CertificatesView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <CertManagerConditionPill kind="ready" status={i.getValue()} />,
      }),
      columnHelper.accessor('secretName', {
        header: 'Secret',
        size: COL_MD,
        cell: (i) =>
          i.getValue() ? (
            <span className="font-mono text-xs">{i.getValue()}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      columnHelper.accessor('issuer', {
        header: 'Issuer',
        size: COL_MD,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('notAfter', {
        header: 'Expiry',
        size: COL_MD,
        cell: (i) => <ExpiryCell iso={i.getValue()} />,
        sortingFn: 'datetime',
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        size: 120,
        cell: (i) => {
          const row = i.row.original
          const contextName = resourceContext(row)
          if (!contextName) return null
          return (
            <RenewCertificateButton
              contextName={contextName}
              namespace={row.namespace}
              name={row.name}
              variant="row"
            />
          )
        },
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
      resource={CERT_MANAGER_CERTIFICATE_RESOURCE}
      kind="Certificate"
      noun={{ singular: 'certificate', plural: 'certificates' }}
      scope="namespaced"
      fetch={api.listCertManagerCertificates}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Certificate is not installed in the active contexts."
    />
  )
}
