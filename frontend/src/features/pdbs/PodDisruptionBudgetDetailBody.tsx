import { useCallback } from 'react'
import { api, type PodDisruptionBudgetDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function PodDisruptionBudgetDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getPodDisruptionBudget(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<PodDisruptionBudgetDetail>(contextName, 'PodDisruptionBudget', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Min available">{detail.minAvailable || '—'}</Field>
        <Field label="Max unavailable">{detail.maxUnavailable || '—'}</Field>
        <Field label="Selector" mono>{detail.selector}</Field>
        <Field label="Current healthy">{detail.currentHealthy}</Field>
        <Field label="Desired healthy">{detail.desiredHealthy}</Field>
        <Field label="Expected pods">{detail.expectedPods}</Field>
        <Field label="Disruptions allowed">{detail.disruptionsAllowed}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
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
