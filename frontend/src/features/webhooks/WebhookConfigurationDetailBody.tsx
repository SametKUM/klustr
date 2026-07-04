import type { WebhookConfigurationDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

type Loader = (ctx: string) => Promise<WebhookConfigurationDetail>

export function WebhookConfigurationDetailBody({
  contextName,
  kind,
  name,
  loader,
}: {
  contextName: string | null
  kind: string
  name: string
  loader: Loader
}) {
  const { detail, error } = useResourceDetail<WebhookConfigurationDetail>(contextName, kind, '', name, loader)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Webhook Count">{detail.webhooks.length}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      {detail.webhooks.length > 0 && (
        <Section title="Webhooks">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Name</Th>
                  <Th>Target</Th>
                  <Th>Fail</Th>
                  <Th>Side Effects</Th>
                  <Th>Operations</Th>
                  <Th>Resources</Th>
                </tr>
              </thead>
              <tbody>
                {detail.webhooks.map((w, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <Td className="font-mono"><Copyable value={w.name} /></Td>
                    <Td className="font-mono"><Copyable value={w.clientCfg} /></Td>
                    <Td>{w.failPolicy || '—'}</Td>
                    <Td>{w.sideEffects || '—'}</Td>
                    <Td>{w.operations.join(', ')}</Td>
                    <Td className="font-mono">{w.resources.join(', ')}</Td>
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
