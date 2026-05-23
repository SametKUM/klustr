import { useCallback } from 'react'
import { api, type PriorityLevelConfigurationDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import {
  Chips,
  ErrorBox,
  Field,
  MaybeSection,
  Section,
  Td,
  Th,
} from '@/features/_shared/DetailPrimitives'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function PriorityLevelDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getPriorityLevelConfiguration(ctx, name), [name])
  const { detail, error } = useResourceDetail<PriorityLevelConfigurationDetail>(
    contextName,
    'PriorityLevelConfiguration',
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Priority level">
        <Field label="Type">{detail.type}</Field>
        <Field label="Nominal concurrency shares">{detail.nominalConcurrencyShares}</Field>
        <Field label="Lendable percent">{detail.lendablePercent}</Field>
        {detail.type === 'Limited' && (
          <Field label="Limit response">{detail.limitResponse || '—'}</Field>
        )}
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.limitResponse === 'Queue' && (
        <Section title="Queueing">
          <Field label="Queues">{detail.queues}</Field>
          <Field label="Hand size">{detail.handSize}</Field>
          <Field label="Queue length limit">{detail.queueLengthLimit}</Field>
        </Section>
      )}

      {detail.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c, i) => (
                  <tr key={`${c.type}-${i}`} className="border-t border-border">
                    <Td className="font-mono">{c.type}</Td>
                    <Td>
                      <ConditionPill status={c.status} />
                    </Td>
                    <Td className="font-mono">{c.reason || '—'}</Td>
                    <Td>{c.message || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
