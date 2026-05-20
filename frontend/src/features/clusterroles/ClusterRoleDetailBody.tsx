import { useCallback } from 'react'
import { api, type ClusterRoleDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { RulesTable } from '@/features/roles/RoleDetailBody'

export function ClusterRoleDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getClusterRole(ctx, name), [name])
  const { detail, error } = useResourceDetail<ClusterRoleDetail>(contextName, 'ClusterRole', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Metadata">
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
        <Field label="Rules">{detail.rules.length}</Field>
        <Field label="Aggregated">{detail.aggregationLabel ? 'Yes' : 'No'}</Field>
      </Section>
      <MaybeSection
        title="Aggregation Labels"
        items={detail.aggregationLabel}
        render={() => <Chips items={detail.aggregationLabel} />}
      />
      {detail.rules.length > 0 && <RulesTable rules={detail.rules} />}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
