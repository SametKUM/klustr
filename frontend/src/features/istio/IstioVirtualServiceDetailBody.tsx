import { useCallback } from 'react'
import {
  api,
  type IstioDestinationWeight,
  type IstioRouteRule,
  type IstioServiceRef,
  type IstioVirtualServiceDetail,
  type OwnerRef,
} from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { OwnerLink } from '@/features/_shared/OwnerLink'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { RefLinks } from './IstioDetailBodies'
import { ISTIO_GATEWAY_RESOURCE } from './istioKinds'
import { useIstioRelationsReload } from './useIstioRelationsReload'

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
  const { detail, error, reload } = useResourceDetail<IstioVirtualServiceDetail>(contextName, 'IstioVirtualService', namespace, name, load)
  useIstioRelationsReload(contextName, ['Service'], reload)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  // The sidecars ("mesh") serve the routes when no gateway is listed, or
  // when "mesh" is listed next to gateways.
  const servesMesh = detail.gateways.length === 0 || detail.gateways.includes('mesh')

  return (
    <div className="space-y-6">
      <Section title="VirtualService">
        <Field label="Hosts">
          {detail.hostServices.length > 0 ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {detail.hostServices.map((h) => (
                <HostLink key={h.host} contextName={contextName} host={h} />
              ))}
            </div>
          ) : (
            '—'
          )}
        </Field>
        <Field label="Gateways">
          <div className="space-y-1">
            {servesMesh && <div className="text-xs">mesh (sidecars)</div>}
            {detail.gatewayRefs.length > 0 && (
              <RefLinks
                contextName={contextName}
                refs={detail.gatewayRefs}
                resource={ISTIO_GATEWAY_RESOURCE}
                kind="IstioGateway"
                empty=""
              />
            )}
          </div>
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <RouteRulesSection title="HTTP routes" rules={detail.httpRoutes} contextName={contextName} />
      <RouteRulesSection title="TLS routes" rules={detail.tlsRoutes} contextName={contextName} />
      <RouteRulesSection title="TCP routes" rules={detail.tcpRoutes} contextName={contextName} />
    </div>
  )
}

// HostLink opens the Service a host resolves to, or offers the host to copy
// when it is not a Service of this cluster.
function HostLink({ contextName, host }: { contextName: string | null; host: IstioServiceRef }) {
  if (!host.name) return <Copyable className="font-mono text-xs" value={host.host} />
  return (
    <span className="font-mono text-xs" title={`Service ${host.namespace}/${host.name}`}>
      <OwnerLink owner={{ kind: 'Service', name: host.name } as OwnerRef} namespace={host.namespace} context={contextName} />
      {host.host !== host.name && <span className="text-muted-foreground"> ({host.host})</span>}
    </span>
  )
}

function DestinationLink({ contextName, d }: { contextName: string | null; d: IstioDestinationWeight }) {
  const suffix = `${d.subset ? `/${d.subset}` : ''}${d.port > 0 ? `:${d.port}` : ''}`
  if (!d.serviceName) return <Copyable value={destinationLabel(d.host, d.subset, d.port)} />
  return (
    <span title={`Service ${d.serviceNamespace}/${d.serviceName}`}>
      <OwnerLink owner={{ kind: 'Service', name: d.serviceName } as OwnerRef} namespace={d.serviceNamespace} context={contextName} />
      {d.host !== d.serviceName && <span className="text-muted-foreground"> ({d.host})</span>}
      {suffix}
    </span>
  )
}

function RouteRulesSection({
  title,
  rules,
  contextName,
}: {
  title: string
  rules: IstioRouteRule[]
  contextName: string | null
}) {
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
                          <DestinationLink contextName={contextName} d={d} />
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
