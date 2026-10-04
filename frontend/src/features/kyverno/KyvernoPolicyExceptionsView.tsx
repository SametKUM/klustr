import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type KyvernoPolicyExceptionInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { KYVERNO_GROUP, KYVERNO_POLICYEXCEPTION_RESOURCE } from './kyvernoKinds'

const columnHelper = createColumnHelper<KyvernoPolicyExceptionInfo>()

export function KyvernoPolicyExceptionsView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor((row) => row.policies.join(', '), {
        id: 'policies',
        header: 'Policies',
        cell: (i) => <span title={i.getValue()}>{i.getValue() || '—'}</span>,
      }),
      columnHelper.accessor((row) => row.match.join('; '), {
        id: 'match',
        header: 'Applies to',
        cell: (i) => <span title={i.getValue()}>{i.getValue() || '—'}</span>,
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
      group={KYVERNO_GROUP}
      resource={KYVERNO_POLICYEXCEPTION_RESOURCE}
      kind="PolicyException"
      noun={{ singular: 'policy exception', plural: 'policy exceptions' }}
      scope="namespaced"
      fetch={api.listKyvernoPolicyExceptions}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Kyverno policy exceptions are not available in the active contexts."
    />
  )
}
