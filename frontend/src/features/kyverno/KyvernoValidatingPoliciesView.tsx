import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type KyvernoValidatingPolicyInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { failureActionClass } from './kyvernoFormat'
import {
  KYVERNO_CEL_GROUP,
  KYVERNO_NAMESPACEDVALIDATINGPOLICY_RESOURCE,
  KYVERNO_VALIDATINGPOLICY_RESOURCE,
} from './kyvernoKinds'

const columnHelper = createColumnHelper<KyvernoValidatingPolicyInfo>()

// ValidatingPolicies and NamespacedValidatingPolicies share the row shape.
export function KyvernoValidatingPoliciesView({ namespaced }: { namespaced: boolean }) {
  const columns = useMemo(
    () => [
      ...(namespaced ? [columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD })] : []),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor((row) => row.actions.join(', '), {
        id: 'actions',
        header: 'Actions',
        size: COL_SM,
        cell: (i) => (
          <span className="space-x-1">
            {i.row.original.actions.map((a) => (
              <span key={a} className={failureActionClass(a)}>
                {a}
              </span>
            ))}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.resources.join('; '), {
        id: 'resources',
        header: 'Resources',
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      columnHelper.accessor('validations', { header: 'Validations', size: COL_XS }),
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
    [namespaced],
  )
  const fetch = useCallback(
    (ctx: string, ns: string) =>
      namespaced ? api.listKyvernoNamespacedValidatingPolicies(ctx, ns) : api.listKyvernoValidatingPolicies(ctx),
    [namespaced],
  )

  return (
    <CustomResourceTable
      group={KYVERNO_CEL_GROUP}
      resource={namespaced ? KYVERNO_NAMESPACEDVALIDATINGPOLICY_RESOURCE : KYVERNO_VALIDATINGPOLICY_RESOURCE}
      kind={namespaced ? 'NamespacedValidatingPolicy' : 'ValidatingPolicy'}
      noun={{ singular: 'validating policy', plural: 'validating policies' }}
      scope={namespaced ? 'namespaced' : 'cluster'}
      fetch={fetch}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage="Kyverno CEL policies are not available in the active contexts."
    />
  )
}
