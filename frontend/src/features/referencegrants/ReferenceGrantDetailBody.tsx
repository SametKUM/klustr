import { useCallback } from 'react'
import { api, type ReferenceGrantDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import {
  Chips,
  ErrorBox,
  Field,
  MaybeSection,
  Section,
  Td,
  Th,
} from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function ReferenceGrantDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getReferenceGrant(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<ReferenceGrantDetail>(
    contextName,
    'ReferenceGrant',
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="ReferenceGrant">
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.from.length > 0 && (
        <Section title="From (allowed sources)">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Group</Th>
                  <Th>Kind</Th>
                  <Th>Namespace</Th>
                </tr>
              </thead>
              <tbody>
                {detail.from.map((f, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td className="font-mono">{f.group || '—'}</Td>
                    <Td className="font-mono">{f.kind}</Td>
                    <Td className="font-mono">{f.namespace}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {detail.to.length > 0 && (
        <Section title="To (permitted targets)">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Group</Th>
                  <Th>Kind</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {detail.to.map((t, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td className="font-mono">{t.group || '—'}</Td>
                    <Td className="font-mono">{t.kind}</Td>
                    <Td className="font-mono">{t.name || '* (all)'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <MaybeSection
        title="Labels"
        items={detail.labels}
        render={() => <Chips items={detail.labels} />}
      />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
