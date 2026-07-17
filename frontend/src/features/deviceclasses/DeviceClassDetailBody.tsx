import { useCallback } from 'react'
import { api, type DeviceClassDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import {
  Chips,
  ErrorBox,
  Field,
  MaybeSection,
  Section,
} from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function DeviceClassDetailBody({
  contextName,
  name,
}: {
  contextName: string | null
  name: string
}) {
  const load = useCallback((ctx: string) => api.getDeviceClass(ctx, name), [name])
  const { detail, error } = useResourceDetail<DeviceClassDetail>(contextName, 'DeviceClass', '', name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="DeviceClass">
        <Field label="Config entries">{detail.config}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.selectors.length > 0 && (
        <Section title="Selectors">
          <ul className="space-y-1 font-mono text-xs">
            {detail.selectors.map((s, i) => (
              <li key={i}>{s.expression || '—'}</li>
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
