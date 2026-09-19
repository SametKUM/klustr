import type { TCPRouteDetail, TLSRouteDetail, UDPRouteDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { GatewayConditions, GatewayReferenceLink, GatewayReferences } from './GatewayDetailPrimitives'

export function L4RouteOverview({ detail, kind, contextName }: {
  detail: TLSRouteDetail | TCPRouteDetail | UDPRouteDetail
  kind: 'TLSRoute' | 'TCPRoute' | 'UDPRoute'
  contextName: string | null
}) {
  return (
    <div className="space-y-6">
      <Section title={kind}>
        {'hostnames' in detail && (
          <Field label="SNI hostnames" mono>
            {detail.hostnames.length ? <Copyable value={detail.hostnames.join(', ')} /> : '*'}
          </Field>
        )}
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <Section title="Parents">
        <GatewayReferences references={detail.parents} namespace={detail.namespace} contextName={contextName} />
      </Section>
      <Section title="Rules">
        {detail.rules.length === 0 && <p className="text-xs text-muted-foreground">No forwarding rules configured.</p>}
        <div className="space-y-3">
          {detail.rules.map((rule, index) => (
            <div key={index} className="overflow-x-auto rounded border border-border">
              <div className="bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
                {rule.name || `Rule ${index + 1}`}
              </div>
              {rule.backends.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">No backends configured.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr><Th>Group / kind</Th><Th>Backend</Th><Th>Port</Th><Th>Weight</Th></tr>
                  </thead>
                  <tbody>
                    {rule.backends.map((backend, backendIndex) => (
                      <tr key={backendIndex} className="border-t border-border">
                        <Td className="font-mono">{backend.group || 'core'} / {backend.kind}</Td>
                        <Td className="font-mono"><GatewayReferenceLink reference={backend} namespace={detail.namespace} contextName={contextName} /></Td>
                        <Td className="text-right font-mono tabular-nums">{backend.port || '—'}</Td>
                        <Td className="text-right font-mono tabular-nums">{backend.weight}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Parent status">
        {detail.status.length === 0 && <p className="text-xs text-muted-foreground">No parent status reported yet.</p>}
        <div className="space-y-4">
          {detail.status.map((status, index) => (
            <div key={index} className="space-y-2">
              <GatewayReferences references={[status.parent]} namespace={detail.namespace} contextName={contextName} />
              <Field label="Controller" mono><Copyable value={status.controller} /></Field>
              <GatewayConditions conditions={status.conditions} />
            </div>
          ))}
        </div>
      </Section>
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
