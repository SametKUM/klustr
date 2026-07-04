import { useCallback } from 'react'
import { api, type ReplicaSetDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { ContainersTable } from '@/features/_shared/containerSummary'
import { OwnerLink } from '@/features/_shared/OwnerLink'
import { RelatedPods } from '@/features/_shared/RelatedPods'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

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
                    <Td>{c.status}</Td>
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
