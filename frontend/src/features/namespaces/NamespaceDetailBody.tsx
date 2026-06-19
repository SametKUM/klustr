import { useCallback } from 'react'
import { api, type NamespaceDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { phaseClass } from '@/features/_shared/phaseColor'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function NamespaceDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getNamespace(ctx, name), [name])
  const { detail, error } = useResourceDetail<NamespaceDetail>(contextName, 'Namespace', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Phase">
          <span className={phaseClass(detail.phase)}>{detail.phase}</span>
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
