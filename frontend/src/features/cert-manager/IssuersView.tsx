import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type CertManagerIssuerInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import {
  CERT_MANAGER_CLUSTERISSUER_RESOURCE,
  CERT_MANAGER_GROUP,
  CERT_MANAGER_ISSUER_RESOURCE,
} from './certManagerKinds'

const columnHelper = createColumnHelper<CertManagerIssuerInfo>()
type Props = {
  // cluster selects the ClusterIssuer (cluster-scoped) variant; otherwise the
  // namespaced Issuer is rendered. Both share the same row/detail shape.
  cluster: boolean
}

export function IssuersView({ cluster }: Props) {
  const resourceName = cluster ? CERT_MANAGER_CLUSTERISSUER_RESOURCE : CERT_MANAGER_ISSUER_RESOURCE
  const kind = cluster ? 'ClusterIssuer' : 'Issuer'

  const columns = useMemo(
    () => [
      ...(cluster
        ? []
        : [
            columnHelper.accessor('namespace', {
              header: 'Namespace',
              size: COL_MD,
            }),
          ]),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        size: COL_MD,
        cell: (i) =>
          i.getValue() ? (
            <span className="font-mono text-xs">{i.getValue()}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
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
    [cluster],
  )

  const fetch = useCallback(
    (ctx: string, ns: string) =>
      cluster ? api.listCertManagerClusterIssuers(ctx) : api.listCertManagerIssuers(ctx, ns),
    [cluster],
  )
  return (
    <CustomResourceTable
      group={CERT_MANAGER_GROUP}
      resource={resourceName}
      kind={kind}
      noun={
        cluster
          ? { singular: 'cluster issuer', plural: 'cluster issuers' }
          : { singular: 'issuer', plural: 'issuers' }
      }
      scope={cluster ? 'cluster' : 'namespaced'}
      fetch={fetch}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage={`cert-manager ${kind} is not installed in the active contexts.`}
    />
  )
}
