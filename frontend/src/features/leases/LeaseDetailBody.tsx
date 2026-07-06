import { useCallback } from 'react'
import { api, type LeaseDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function LeaseDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getLease(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<LeaseDetail>(contextName, 'Lease', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Holder Identity" mono>
          {detail.holderIdentity ? <Copyable value={detail.holderIdentity} /> : '—'}
        </Field>
        <Field label="Lease Duration">{detail.leaseDurationSeconds}s</Field>
        <Field label="Acquire Time">{detail.acquireTime ? formatAge(detail.acquireTime) + ' ago' : '—'}</Field>
        <Field label="Renew Time">{detail.renewTime ? formatAge(detail.renewTime) + ' ago' : '—'}</Field>
        <Field label="Transitions">{detail.leaseTransitions}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
