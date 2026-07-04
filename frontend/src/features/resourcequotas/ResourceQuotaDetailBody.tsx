import { useCallback } from 'react'
import { api, type ResourceQuotaDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function ResourceQuotaDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getResourceQuota(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<ResourceQuotaDetail>(contextName, 'ResourceQuota', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Scopes">{detail.scopes.join(', ') || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.entries.length > 0 && (
        <Section title="Resources">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr><Th>Resource</Th><Th>Used</Th><Th>Hard</Th></tr>
              </thead>
              <tbody>
                {detail.entries.map((e, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{e.resource}</Td>
                    <Td className="font-mono">{e.used}</Td>
                    <Td className="font-mono">{e.hard}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
