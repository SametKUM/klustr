import { useCallback } from 'react'
import { api, type JobDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { ContainersTable } from '@/features/_shared/containerSummary'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function JobDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getJob(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<JobDetail>(contextName, 'Job', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Status">
          <Field label="Status">{detail.status}</Field>
          <Field label="Completions">{detail.completions}</Field>
          <Field label="Parallelism">{detail.parallelism}</Field>
          <Field label="Backoff Limit">{detail.backoffLimit}</Field>
          {detail.duration && <Field label="Duration">{detail.duration}</Field>}
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <Section title="Counts">
          <Field label="Active">{detail.active}</Field>
          <Field label="Succeeded">{detail.succeeded}</Field>
          <Field label="Failed">{detail.failed}</Field>
        </Section>
      </div>
      <ContainersTable title="Containers" containers={detail.containers} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
