import { useCallback } from 'react'
import { api, type FluxAlertSource, type FluxReceiverDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { CopyButton } from '@/features/_shared/Copyable'
import { FluxReadyPill } from './FluxReadyPill'
import { FluxConditionsTable } from './FluxConditionsTable'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function FluxReceiverDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getFluxReceiver(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<FluxReceiverDetail>(contextName, 'FluxReceiver', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="Receiver">
        <Field label="Ready">
          <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="Type">{detail.type}</Field>
        <Field label="Interval">{detail.interval || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title="Webhook">
        <Field label="Path">
          {detail.webhookPath ? (
            <span className="inline-flex items-center gap-1">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {detail.webhookPath}
              </code>
              <CopyButton value={detail.webhookPath} ariaLabel="Copy webhook path" />
            </span>
          ) : (
            <span className="text-muted-foreground">— (not ready; see Conditions)</span>
          )}
        </Field>
        <Field label="Token Secret">{detail.secretRef || '—'}</Field>
        <Field label="Event filter">
          {detail.events.length === 0 ? (
            <span className="text-muted-foreground">all events</span>
          ) : (
            <ul className="space-y-1">
              {detail.events.map((e) => (
                <li key={e} className="font-mono text-xs">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </Field>
      </Section>

      <Section title={`Target resources (${detail.resources.length})`}>
        {detail.resources.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No target resources — incoming hooks have nothing to reconcile.
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Kind</Th>
                  <Th>Namespace</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {detail.resources.map((r: FluxAlertSource, i: number) => (
                  <tr key={i} className="border-t border-border">
                    <Td className="font-mono">{r.kind}</Td>
                    <Td className="font-mono">{r.namespace || '—'}</Td>
                    <Td className="font-mono">{r.name || '*'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}
