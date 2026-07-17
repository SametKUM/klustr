import { useCallback } from 'react'
import { api, type DaemonSetDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { ContainersTable } from '@/features/_shared/containerSummary'
import { RelatedPods } from '@/features/_shared/RelatedPods'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function DaemonSetDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getDaemonSet(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<DaemonSetDetail>(contextName, 'DaemonSet', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Status">
          <Field label="Desired">{detail.desired}</Field>
          <Field label="Current">{detail.current}</Field>
          <Field label="Ready">{detail.ready}</Field>
          <Field label="Up-to-date">{detail.upToDate}</Field>
          <Field label="Available">{detail.available}</Field>
          {detail.misscheduled > 0 && <Field label="Misscheduled">{detail.misscheduled}</Field>}
          <Field label="Update strategy">{detail.updateStrategy || 'RollingUpdate'}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <div className="space-y-6">
          <MaybeSection title="Selector" items={detail.selector} render={() => <Chips items={detail.selector} />} />
          <MaybeSection title="Node Selector" items={detail.nodeSelector} render={() => <Chips items={detail.nodeSelector} />} />
        </div>
      </div>
      <ContainersTable title="Containers" containers={detail.containers} />
      <RelatedPods contextName={contextName} kind="DaemonSet" namespace={namespace} name={name} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
