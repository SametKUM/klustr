import { useCallback } from 'react'
import { api, type PersistentVolumeDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { phaseClass } from '@/features/_shared/phaseColor'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function PersistentVolumeDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getPersistentVolume(ctx, name), [name])
  const { detail, error } = useResourceDetail<PersistentVolumeDetail>(contextName, 'PersistentVolume', '', name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Status">
          <Field label="Status">
            <span className={phaseClass(detail.status)}>{detail.status}</span>
          </Field>
          <Field label="Capacity">{detail.capacity || '—'}</Field>
          <Field label="Reclaim Policy">{detail.reclaimPolicy}</Field>
          <Field label="Volume Mode">{detail.volumeMode || 'Filesystem'}</Field>
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>
        <Section title="Binding">
          <Field label="Claim">{detail.claim || '—'}</Field>
          <Field label="Storage Class">{detail.storageClass || '—'}</Field>
          <Field label="Access Modes">{detail.accessModes.join(', ') || '—'}</Field>
          {detail.source && (
            <Field label="Source" mono><Copyable value={detail.source} /></Field>
          )}
          {(detail.reason || detail.message) && (
            <Field label="Reason">
              {detail.reason}
              {detail.message && <div className="text-xs text-muted-foreground">{detail.message}</div>}
            </Field>
          )}
        </Section>
      </div>
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
