import { useCallback } from 'react'
import { api, type PriorityClassDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function PriorityClassDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getPriorityClass(ctx, name), [name])
  const { detail, error } = useResourceDetail<PriorityClassDetail>(contextName, 'PriorityClass', '', name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Value">{detail.value}</Field>
        <Field label="Global Default">{detail.globalDefault ? 'Yes' : 'No'}</Field>
        <Field label="Preemption Policy">{detail.preemptionPolicy || 'PreemptLowerPriority'}</Field>
        <Field label="Description">{detail.description || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
