import { useCallback } from 'react'
import { api, type PersistentVolumeClaimDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { phaseClass } from '@/features/_shared/phaseColor'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function PersistentVolumeClaimDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getPersistentVolumeClaim(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<PersistentVolumeClaimDetail>(contextName, 'PersistentVolumeClaim', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Status">
          <Field label="Status">
            <span className={phaseClass(detail.status)}>{detail.status}</span>
          </Field>
          <Field label="Capacity">{detail.capacity || '—'}</Field>
          <Field label="Request">{detail.request || '—'}</Field>
          <Field label="Volume Mode">{detail.volumeMode || 'Filesystem'}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <Section title="Binding">
          <Field label="Volume" mono>{detail.volume ? <Copyable value={detail.volume} /> : '—'}</Field>
          <Field label="Storage Class">{detail.storageClass || '—'}</Field>
          <Field label="Access Modes">{detail.accessModes.join(', ') || '—'}</Field>
        </Section>
      </div>
      <MaybeSection title="Selector" items={detail.selector} render={() => <Chips items={detail.selector} />} />
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
                      <ConditionPill status={c.status} />
                    </Td>
                    <Td>{c.reason || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
