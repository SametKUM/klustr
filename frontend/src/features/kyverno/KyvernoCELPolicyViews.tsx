import { useCallback, useMemo } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import {
  api,
  type KyvernoDeletingPolicyInfo,
  type KyvernoGeneratingPolicyInfo,
  type KyvernoImageValidatingPolicyInfo,
  type KyvernoMutatingPolicyInfo,
} from '@/lib/api'
import { formatAge } from '@/lib/time'
import { CustomResourceTable } from '@/features/_shared/CustomResourceTable'
import { ReadyPill } from '@/features/_shared/ReadyPill'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { failureActionClass } from './kyvernoFormat'
import { KYVERNO_CEL_GROUP, KYVERNO_CEL_POLICY_KINDS, type KyvernoCELPolicyKind } from './kyvernoKinds'

const yesNo = (v: boolean) => (v ? 'yes' : 'no')

// The row fields every CEL policy kind shares (KyvernoCELPolicyBase in Go,
// flattened into each row by the model generator).
type KyvernoCELPolicyBase = { name: string; namespace: string; resources: string[]; ready: string; createdAt: string }

// celColumns wraps a kind's own columns with the ones every CEL policy list
// shares: namespace, name and resources first, ready and age last.
function celColumns<T extends KyvernoCELPolicyBase>(namespaced: boolean, own: ColumnDef<T, unknown>[]): ColumnDef<T, unknown>[] {
  const h = createColumnHelper<T>()
  return [
    ...(namespaced ? [h.accessor((r) => r.namespace, { id: 'namespace', header: 'Namespace', size: COL_MD })] : []),
    h.accessor((r) => r.name, { id: 'name', header: 'Name' }),
    h.accessor((r) => r.resources.join('; '), {
      id: 'resources',
      header: 'Resources',
      cell: (i) => (i.getValue() as string) || <span className="text-muted-foreground">—</span>,
    }),
    ...own,
    h.accessor((r) => r.ready, { id: 'ready', header: 'Ready', size: COL_SM, cell: (i) => <ReadyPill status={i.getValue() as string} /> }),
    h.accessor((r) => r.createdAt, {
      id: 'createdAt',
      header: 'Age',
      size: COL_SM,
      cell: (i) => formatAge(i.getValue() as string),
      sortingFn: 'datetime',
    }),
  ] as ColumnDef<T, unknown>[]
}

function CELPolicyTable<T extends KyvernoCELPolicyBase>({
  kind,
  namespaced,
  noun,
  columns,
  list,
  listNamespaced,
}: {
  kind: KyvernoCELPolicyKind
  namespaced: boolean
  noun: { singular: string; plural: string }
  columns: ColumnDef<T, unknown>[]
  list: (ctx: string) => Promise<T[]>
  listNamespaced: (ctx: string, ns: string) => Promise<T[]>
}) {
  const fetch = useCallback(
    (ctx: string, ns: string) => (namespaced ? listNamespaced(ctx, ns) : list(ctx)),
    [namespaced, list, listNamespaced],
  )
  const resource = KYVERNO_CEL_POLICY_KINDS[kind]
  return (
    <CustomResourceTable
      group={KYVERNO_CEL_GROUP}
      resource={namespaced ? `namespaced${resource}` : resource}
      kind={namespaced ? `Namespaced${kind}` : kind}
      noun={noun}
      scope={namespaced ? 'namespaced' : 'cluster'}
      fetch={fetch}
      columns={columns}
      identity={(row) => ({ namespace: row.namespace, name: row.name })}
      unavailableMessage={`Kyverno ${namespaced ? 'Namespaced' : ''}${kind}s are not available in the active contexts.`}
    />
  )
}

const mp = createColumnHelper<KyvernoMutatingPolicyInfo>()

export function KyvernoMutatingPoliciesView({ namespaced }: { namespaced: boolean }) {
  const columns = useMemo(
    () =>
      celColumns<KyvernoMutatingPolicyInfo>(namespaced, [
        mp.accessor('mutations', { header: 'Mutations', size: COL_XS }) as ColumnDef<KyvernoMutatingPolicyInfo, unknown>,
        mp.accessor((r) => r.patchTypes.join(', '), { id: 'patchTypes', header: 'Patch', size: 180 }) as ColumnDef<KyvernoMutatingPolicyInfo, unknown>,
        mp.accessor('mutateExisting', { header: 'Existing', size: COL_SM, cell: (i) => yesNo(i.getValue()) }) as ColumnDef<KyvernoMutatingPolicyInfo, unknown>,
      ]),
    [namespaced],
  )
  return (
    <CELPolicyTable
      kind="MutatingPolicy"
      namespaced={namespaced}
      noun={{ singular: 'mutating policy', plural: 'mutating policies' }}
      columns={columns}
      list={api.listKyvernoMutatingPolicies}
      listNamespaced={api.listKyvernoNamespacedMutatingPolicies}
    />
  )
}

const gp = createColumnHelper<KyvernoGeneratingPolicyInfo>()

export function KyvernoGeneratingPoliciesView({ namespaced }: { namespaced: boolean }) {
  const columns = useMemo(
    () =>
      celColumns<KyvernoGeneratingPolicyInfo>(namespaced, [
        gp.accessor('generations', { header: 'Generates', size: COL_XS }) as ColumnDef<KyvernoGeneratingPolicyInfo, unknown>,
        gp.accessor('synchronize', { header: 'Synchronize', size: COL_SM, cell: (i) => yesNo(i.getValue()) }) as ColumnDef<KyvernoGeneratingPolicyInfo, unknown>,
        gp.accessor('generateExisting', { header: 'Existing', size: COL_SM, cell: (i) => yesNo(i.getValue()) }) as ColumnDef<KyvernoGeneratingPolicyInfo, unknown>,
      ]),
    [namespaced],
  )
  return (
    <CELPolicyTable
      kind="GeneratingPolicy"
      namespaced={namespaced}
      noun={{ singular: 'generating policy', plural: 'generating policies' }}
      columns={columns}
      list={api.listKyvernoGeneratingPolicies}
      listNamespaced={api.listKyvernoNamespacedGeneratingPolicies}
    />
  )
}

const dp = createColumnHelper<KyvernoDeletingPolicyInfo>()

export function KyvernoDeletingPoliciesView({ namespaced }: { namespaced: boolean }) {
  const columns = useMemo(
    () =>
      celColumns<KyvernoDeletingPolicyInfo>(namespaced, [
        dp.accessor('schedule', { header: 'Schedule', size: 140, cell: (i) => <span className="font-mono text-xs">{i.getValue()}</span> }) as ColumnDef<KyvernoDeletingPolicyInfo, unknown>,
        dp.accessor('lastExecution', {
          header: 'Last run',
          size: COL_MD,
          cell: (i) => (i.getValue() ? formatAge(i.getValue()) : '—'),
        }) as ColumnDef<KyvernoDeletingPolicyInfo, unknown>,
      ]),
    [namespaced],
  )
  return (
    <CELPolicyTable
      kind="DeletingPolicy"
      namespaced={namespaced}
      noun={{ singular: 'deleting policy', plural: 'deleting policies' }}
      columns={columns}
      list={api.listKyvernoDeletingPolicies}
      listNamespaced={api.listKyvernoNamespacedDeletingPolicies}
    />
  )
}

const ivp = createColumnHelper<KyvernoImageValidatingPolicyInfo>()

export function KyvernoImageValidatingPoliciesView({ namespaced }: { namespaced: boolean }) {
  const columns = useMemo(
    () =>
      celColumns<KyvernoImageValidatingPolicyInfo>(namespaced, [
        ivp.accessor((r) => r.actions.join(', '), {
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
        }) as ColumnDef<KyvernoImageValidatingPolicyInfo, unknown>,
        ivp.accessor((r) => r.images.join(', '), { id: 'images', header: 'Images', size: 220 }) as ColumnDef<KyvernoImageValidatingPolicyInfo, unknown>,
        ivp.accessor((r) => r.attestors.join(', '), { id: 'attestors', header: 'Attestors', size: 220 }) as ColumnDef<KyvernoImageValidatingPolicyInfo, unknown>,
      ]),
    [namespaced],
  )
  return (
    <CELPolicyTable
      kind="ImageValidatingPolicy"
      namespaced={namespaced}
      noun={{ singular: 'image validating policy', plural: 'image validating policies' }}
      columns={columns}
      list={api.listKyvernoImageValidatingPolicies}
      listNamespaced={api.listKyvernoNamespacedImageValidatingPolicies}
    />
  )
}
