import { useCallback } from 'react'
import { api, type ReplicaSetDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { ContainersTable } from '@/features/_shared/containerSummary'
import { OwnerLink } from '@/features/_shared/OwnerLink'
import { RelatedPods } from '@/features/_shared/RelatedPods'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

function ReplicaSetConditionPill({ status }: { status: string }) {
  if (!status) return <span className="text-muted-foreground/70">—</span>
  const className =
    status === 'True'
      ? 'bg-destructive/15 text-destructive'
      : status === 'False'
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}
    >
      {status}
    </span>
  )
}

export function ReplicaSetDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getReplicaSet(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<ReplicaSetDetail>(contextName, 'ReplicaSet', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Status">
          <Field label="Desired">{detail.desired}</Field>
          <Field label="Current">{detail.current}</Field>
          <Field label="Ready">{detail.ready}</Field>
          <Field label="Available">{detail.available}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        {detail.owners.length > 0 && (
          <Section title="Controlled By">
            {detail.owners.map((o, i) => (
              <Field key={i} label={o.kind}>
                <OwnerLink owner={o} namespace={detail.namespace} context={contextName} />
              </Field>
            ))}
          </Section>
        )}
      </div>
      <MaybeSection title="Selector" items={detail.selector} render={() => <Chips items={detail.selector} />} />
      <ContainersTable title="Containers" containers={detail.containers} />
      {detail.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{c.type}</Td>
                    <Td>
                      <ReplicaSetConditionPill status={c.status} />
                    </Td>
                    <Td>{c.reason || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <RelatedPods contextName={contextName} kind="ReplicaSet" namespace={namespace} name={name} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
