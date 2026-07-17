import { useCallback } from 'react'
import { api, type LimitRangeDetail, type LimitRangeItem } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function LimitRangeDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getLimitRange(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<LimitRangeDetail>(contextName, 'LimitRange', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
        <Field label="Limit items">{detail.limits.length}</Field>
      </Section>
      {detail.limits.map((item, i) => (
        <LimitItem key={i} item={item} />
      ))}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}

function LimitItem({ item }: { item: LimitRangeItem }) {
  const keys = new Set<string>()
  for (const m of [item.max, item.min, item.default, item.defaultRequest, item.maxLimitRequestRatio]) {
    Object.keys(m || {}).forEach((k) => keys.add(k))
  }
  const sorted = Array.from(keys).sort()
  return (
    <Section title={`Type: ${item.type}`}>
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Resource</Th>
              <Th>Min</Th>
              <Th>Max</Th>
              <Th>Default</Th>
              <Th>Default Request</Th>
              <Th>Max/Req Ratio</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((k) => (
              <tr key={k} className="border-t border-border">
                <Td>{k}</Td>
                <Td className="font-mono">{item.min?.[k] || '—'}</Td>
                <Td className="font-mono">{item.max?.[k] || '—'}</Td>
                <Td className="font-mono">{item.default?.[k] || '—'}</Td>
                <Td className="font-mono">{item.defaultRequest?.[k] || '—'}</Td>
                <Td className="font-mono">{item.maxLimitRequestRatio?.[k] || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
