import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type KyvernoPolicyInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { COL_MD, COL_SM } from '@/features/_shared/columnSizes'
import { failureActionClass, ruleSummary } from './kyvernoFormat'
import { KYVERNO_CLUSTERPOLICY_RESOURCE, KYVERNO_GROUP, KYVERNO_POLICY_RESOURCE } from './kyvernoKinds'

const columnHelper = createColumnHelper<KyvernoPolicyInfo>()

// ClusterPolicies and namespaced Policies share the row shape and columns.
export function KyvernoPoliciesView({ cluster }: { cluster: boolean }) {
  const columns = useMemo(
    () => [
      ...(cluster ? [] : [columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD })]),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('category', {
        header: 'Category',
        size: COL_MD,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('severity', {
        header: 'Severity',
        size: COL_SM,
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('action', {
        header: 'Action',
        size: COL_SM,
        cell: (i) =>
          i.getValue() ? (
            <span className={failureActionClass(i.getValue())}>{i.getValue()}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      columnHelper.accessor((row) => ruleSummary(row), { id: 'rules', header: 'Rules', size: COL_MD }),
      columnHelper.accessor('background', {
        header: 'Background',
        size: COL_SM,
        cell: (i) => (i.getValue() ? 'yes' : 'no'),
      }),
      columnHelper.accessor('ready', {
        header: 'Ready',
        size: COL_SM,
        cell: (i) => <ConditionPill status={i.getValue()} />,
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
    (ctx: string, ns: string) => (cluster ? api.listKyvernoClusterPolicies(ctx) : api.listKyvernoPolicies(ctx, ns)),
    [cluster],
  )

  return (
    <CustomResourceTable
      group={KYVERNO_GROUP}
      resource={cluster ? KYVERNO_CLUSTERPOLICY_RESOURCE : KYVERNO_POLICY_RESOURCE}
      kind={cluster ? 'ClusterPolicy' : 'Policy'}
      noun={cluster ? { singular: 'cluster policy', plural: 'cluster policies' } : { singular: 'policy', plural: 'policies' }}
      scope={cluster ? 'cluster' : 'namespaced'}
      fetch={fetch}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Kyverno is not installed in the active contexts."
    />
  )
}
