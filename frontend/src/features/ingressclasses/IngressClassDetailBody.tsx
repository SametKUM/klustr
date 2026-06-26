import { useCallback } from 'react'
import { api, type IngressClassDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function IngressClassDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getIngressClass(ctx, name), [name])
  const { detail, error } = useResourceDetail<IngressClassDetail>(contextName, 'IngressClass', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Controller"><Copyable value={detail.controller} /></Field>
        <Field label="Default">{detail.isDefault ? 'Yes' : 'No'}</Field>
        <Field label="Parameters">{detail.parameters || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
