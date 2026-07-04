import { useCallback } from 'react'
import { api, type IstioRouteRule, type IstioVirtualServiceDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function IstioVirtualServiceDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getIstioVirtualService(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<IstioVirtualServiceDetail>(contextName, 'IstioVirtualService', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  const gatewayItems: Record<string, string> = {}
  for (const g of detail.gateways) gatewayItems[g] = ''

  return (
    <div className="space-y-6">
      <Section title="VirtualService">
        <Field label="Hosts">
          {detail.hosts.length > 0 ? (
            <Copyable className="font-mono text-xs" value={detail.hosts.join(',')}>
              {detail.hosts.join(', ')}
            </Copyable>
          ) : (
            '—'
          )}
        </Field>
        <Field label="Gateways">
          {detail.gateways.length > 0 ? <Chips items={gatewayItems} /> : <span>mesh</span>}
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <RouteRulesSection title="HTTP routes" rules={detail.httpRoutes} />
      <RouteRulesSection title="TLS routes" rules={detail.tlsRoutes} />
      <RouteRulesSection title="TCP routes" rules={detail.tcpRoutes} />
    </div>
  )
}

function RouteRulesSection({ title, rules }: { title: string; rules: IstioRouteRule[] }) {
  if (!rules || rules.length === 0) return null
  return (
    <Section title={`${title} (${rules.length})`}>
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Match</Th>
              <Th>Destinations</Th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={i} className="border-t border-border align-top">
                <Td className="font-mono">{r.match}</Td>
                <Td>
                  <div className="space-y-0.5">
                    {r.destinations.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      r.destinations.map((d, j) => (
                        <div key={j} className="font-mono">
                          <Copyable value={destinationLabel(d.host, d.subset, d.port)} />
                          {d.weight > 0 && (
                            <span className="ml-1.5 text-muted-foreground">{d.weight}%</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function destinationLabel(host: string, subset: string, port: number): string {
  let out = host || '—'
  if (subset) out += `/${subset}`
  if (port > 0) out += `:${port}`
  return out
}
