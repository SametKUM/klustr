import { useCallback } from 'react'
import { api, type GatewayDetail } from '@/lib/api'
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
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function GatewayDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getGateway(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<GatewayDetail>(contextName, 'Gateway', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Gateway">
        <Field label="Class">{detail.class || '—'}</Field>
        <Field label="Addresses" mono>
          {detail.addresses.length > 0 ? detail.addresses.join(', ') : '—'}
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.listeners.length > 0 && (
        <Section title="Listeners">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Name</Th>
                  <Th>Hostname</Th>
                  <Th>Protocol</Th>
                  <Th>Port</Th>
                  <Th>From</Th>
                  <Th>Routes</Th>
                </tr>
              </thead>
              <tbody>
                {detail.listeners.map((l) => (
                  <tr key={l.name} className="border-t border-border">
                    <Td className="font-mono">{l.name}</Td>
                    <Td className="font-mono">{l.hostname || '*'}</Td>
                    <Td>{l.protocol}</Td>
                    <Td className="font-mono">{l.port}</Td>
                    <Td>{l.allowedNamespaces || 'Same'}</Td>
                    <Td>{l.attachedRoutes}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {detail.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c) => (
                  <tr key={c.type} className="border-t border-border">
                    <Td className="font-mono">{c.type}</Td>
                    <Td>
                      <ConditionPill status={c.status} />
                    </Td>
                    <Td className="font-mono">{c.reason || '—'}</Td>
                    <Td>{c.message || '—'}</Td>
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
