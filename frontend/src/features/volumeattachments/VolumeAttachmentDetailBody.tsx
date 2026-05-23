import { useCallback } from 'react'
import { api, type VolumeAttachmentDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function VolumeAttachmentDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getVolumeAttachment(ctx, name), [name])
  const { detail, error } = useResourceDetail<VolumeAttachmentDetail>(
    contextName,
    'VolumeAttachment',
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Volume attachment">
        <Field label="Driver" mono>
          {detail.attacher}
        </Field>
        <Field label="Node" mono>
          {detail.node}
        </Field>
        <Field label="PV" mono>
          {detail.pv || '—'}
        </Field>
        <Field label="Attached">{detail.attached ? 'yes' : 'no'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {(detail.attachError || detail.detachError) && (
        <Section title="Errors">
          {detail.attachError && <Field label="Attach error">{detail.attachError}</Field>}
          {detail.detachError && <Field label="Detach error">{detail.detachError}</Field>}
        </Section>
      )}

      <MaybeSection
        title="Attach metadata"
        items={detail.attachMetadata}
        render={() => <Chips items={detail.attachMetadata} />}
      />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
