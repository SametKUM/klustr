import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CertificateSigningRequestInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'
import { CSRConditionPill } from './CSRConditionPill'

const columnHelper = createColumnHelper<CertificateSigningRequestInfo>()

export function CSRsView() {
  const csrs = useResources((s) => s.certificateSigningRequests)
  const setCSRs = useResources((s) => s.setCertificateSigningRequests)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('signerName', { header: 'Signer' }),
      columnHelper.accessor('requester', { header: 'Requester' }),
      columnHelper.accessor('condition', {
        header: 'Condition',
        size: COL_XS,
        cell: (info) => <CSRConditionPill condition={info.getValue()} />,
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
      kind="CertificateSigningRequest"
      noun={{ singular: 'CSR', plural: 'CSRs' }}
      scope="cluster"
      data={csrs}
      setData={setCSRs}
      fetch={(ctx) => api.listCertificateSigningRequests(ctx)}
      columns={columns}
      defaultSort={[{ id: 'createdAt', desc: true }]}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'CertificateSigningRequest',
          namespace: '',
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
