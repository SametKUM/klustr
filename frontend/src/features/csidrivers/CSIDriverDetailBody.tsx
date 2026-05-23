import { useCallback } from 'react'
import { api, type CSIDriverDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function CSIDriverDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getCSIDriver(ctx, name), [name])
  const { detail, error } = useResourceDetail<CSIDriverDetail>(contextName, 'CSIDriver', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="CSI driver">
        <Field label="Attach required">{detail.attachRequired ? 'yes' : 'no'}</Field>
        <Field label="Pod info on mount">{detail.podInfoOnMount ? 'yes' : 'no'}</Field>
        <Field label="Storage capacity">{detail.storageCapacity ? 'yes' : 'no'}</Field>
        <Field label="Requires republish">{detail.requiresRepublish ? 'yes' : 'no'}</Field>
        <Field label="SELinux mount">{detail.seLinuxMount ? 'yes' : 'no'}</Field>
        <Field label="FSGroup policy">{detail.fsGroupPolicy || '—'}</Field>
        <Field label="Lifecycle modes">{detail.volumeLifecycleModes.join(', ') || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.tokenRequests.length > 0 && (
        <Section title="Token requests">
          <ul className="space-y-1 font-mono text-xs">
            {detail.tokenRequests.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Section>
      )}

      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
