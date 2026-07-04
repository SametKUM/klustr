import { useCallback } from 'react'
import { api, type CronJobDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { ContainersTable } from '@/features/_shared/containerSummary'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function CronJobDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getCronJob(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<CronJobDetail>(contextName, 'CronJob', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Schedule">
          <Field label="Schedule" mono>{detail.schedule}</Field>
          {detail.timeZone && <Field label="Time Zone">{detail.timeZone}</Field>}
          <Field label="Suspend">{detail.suspend ? 'true' : 'false'}</Field>
          <Field label="Concurrency">{detail.concurrencyPolicy || 'Allow'}</Field>
          <Field label="Active">{detail.active}</Field>
          <Field label="Last Schedule">{detail.lastSchedule ? formatAge(detail.lastSchedule) : '—'}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <Section title="History Limits">
          <Field label="Successful">{detail.successfulJobsHistoryLimit}</Field>
          <Field label="Failed">{detail.failedJobsHistoryLimit}</Field>
          {detail.startingDeadlineSeconds > 0 && (
            <Field label="Starting Deadline">{`${detail.startingDeadlineSeconds}s`}</Field>
          )}
        </Section>
      </div>
      <ContainersTable title="Job Template" containers={detail.containers} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
