import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CertManagerChallengeInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { CERT_MANAGER_ACME_GROUP, CERT_MANAGER_CHALLENGE_RESOURCE } from './certManagerKinds'
import { CertManagerStatePill } from './CertManagerStatePill'

const columnHelper = createColumnHelper<CertManagerChallengeInfo>()

export function ChallengesView() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('state', {
        header: 'State',
        size: COL_SM,
        cell: (i) => <CertManagerStatePill state={i.getValue()} />,
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        size: COL_SM,
        cell: (i) =>
          i.getValue() ? (
            <span className="font-mono text-xs">{i.getValue()}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      columnHelper.accessor('dnsName', {
        header: 'DNS Name',
        size: COL_MD,
        cell: (i) =>
          i.getValue() ? (
            <span className="font-mono text-xs">{i.getValue()}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      columnHelper.accessor('reason', {
        header: 'Reason',
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
      group={CERT_MANAGER_ACME_GROUP}
      resource={CERT_MANAGER_CHALLENGE_RESOURCE}
      kind="Challenge"
      noun={{ singular: 'challenge', plural: 'challenges' }}
      scope="namespaced"
      fetch={api.listCertManagerChallenges}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Challenge is not installed in the active contexts."
    />
  )
}
