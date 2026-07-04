import { useCallback } from 'react'
import { api, type ReplicationControllerDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { ContainersTable } from '@/features/_shared/containerSummary'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function ReplicationControllerDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getReplicationController(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<ReplicationControllerDetail>(contextName, 'ReplicationController', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Desired">{detail.desired}</Field>
        <Field label="Current">{detail.current}</Field>
        <Field label="Ready">{detail.ready}</Field>
        <Field label="Available">{detail.available}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <MaybeSection title="Selector" items={detail.selector} render={() => <Chips items={detail.selector} />} />
      <ContainersTable title="Containers" containers={detail.containers} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
