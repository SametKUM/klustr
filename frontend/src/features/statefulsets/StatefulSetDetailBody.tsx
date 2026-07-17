import { useCallback } from 'react'
import { api, type StatefulSetDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { ContainersTable } from '@/features/_shared/containerSummary'
import { RelatedPods } from '@/features/_shared/RelatedPods'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function StatefulSetDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getStatefulSet(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<StatefulSetDetail>(contextName, 'StatefulSet', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Status">
          <Field label="Replicas">{`${detail.ready}/${detail.replicas}`}</Field>
          <Field label="Service">{detail.service || '—'}</Field>
          <Field label="Update strategy">{detail.updateStrategy || 'RollingUpdate'}</Field>
          <Field label="Pod management">{detail.podManagementPolicy || 'OrderedReady'}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <MaybeSection title="Selector" items={detail.selector} render={() => <Chips items={detail.selector} />} />
      </div>
      <ContainersTable title="Containers" containers={detail.containers} />
      <RelatedPods contextName={contextName} kind="StatefulSet" namespace={namespace} name={name} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
