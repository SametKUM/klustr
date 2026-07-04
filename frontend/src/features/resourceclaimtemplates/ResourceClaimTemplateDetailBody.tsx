import { useCallback } from 'react'
import { api, type ResourceClaimTemplateDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import {
  Chips,
  ErrorBox,
  Field,
  MaybeSection,
  Section,
} from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { DeviceRequestsSection } from '@/features/resourceclaims/ResourceClaimDetailBody'

export function ResourceClaimTemplateDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getResourceClaimTemplate(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<ResourceClaimTemplateDetail>(contextName, 'ResourceClaimTemplate', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="ResourceClaimTemplate">
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <DeviceRequestsSection requests={detail.requests} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
