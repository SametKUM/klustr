import { useCallback } from 'react'
import { api, type IstioObjectRef, type IstioPort, type IstioWorkloads, type OwnerRef } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ConditionsSection } from '@/features/_shared/ConditionsTable'
import { CustomResourceReference } from '@/features/_shared/CustomResourceReference'
import { Chips, ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { OwnerLink } from '@/features/_shared/OwnerLink'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import type { IntegrationDetailProps } from '@/features/integrationDetails'
import { ActionPill } from './IstioViews'
import { ISTIO_NETWORKING_GROUP, ISTIO_VIRTUALSERVICE_RESOURCE } from './istioKinds'
import { useIstioRelationsReload } from './useIstioRelationsReload'

function portLabel(p: IstioPort): string {
  let out = String(p.number)
  if (p.protocol) out += `/${p.protocol}`
  if (p.name) out += ` (${p.name})`
  if (p.targetPort) out += ` → ${p.targetPort}`
  return out
}

function Lines({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <div className="space-y-0.5">
      {items.map((s, i) => (
        <div key={i}>{s}</div>
      ))}
    </div>
  )
}

// WorkloadsSection lists the pods a selector picks, linked to their detail.
export function WorkloadsSection({
  title = 'Workloads',
  contextName,
  workloads,
  empty,
}: {
  title?: string
  contextName: string | null
  workloads: IstioWorkloads
  empty: string
}) {
  return (
    <Section title={`${title} (${workloads.total})`}>
      <WorkloadLinks contextName={contextName} workloads={workloads} empty={empty} />
    </Section>
  )
}

export function WorkloadLinks({
  contextName,
  workloads,
  empty,
}: {
  contextName: string | null
  workloads: IstioWorkloads
  empty: string
}) {
  if (workloads.total === 0) return <p className="text-xs text-muted-foreground">{empty}</p>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
      {workloads.pods.map((p) => (
        <span key={`${p.namespace}/${p.name}`}>
          <span className="text-muted-foreground">{p.namespace}/</span>
          <OwnerLink owner={{ kind: 'Pod', name: p.name } as OwnerRef} namespace={p.namespace} context={contextName} />
        </span>
      ))}
      {workloads.total > workloads.pods.length && (
        <span className="text-muted-foreground">and {workloads.total - workloads.pods.length} more</span>
      )}
    </div>
  )
}

function SelectorField({
  labels,
  scope,
  meshWide = false,
}: {
  labels: Record<string, string>
  scope: string
  meshWide?: boolean
}) {
  return (
    <Field label="Applies to">
      {Object.keys(labels).length > 0 ? (
        <>
          <Chips items={labels} />
          {meshWide && <div className="mt-1 text-xs text-muted-foreground">in all namespaces</div>}
        </>
      ) : (
        <span className="text-muted-foreground">{scope}</span>
      )}
    </Field>
  )
}

export function IstioGatewayDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getIstioGateway(ctx, namespace, name), [namespace, name])
  const { detail: d, error, reload } = useResourceDetail(contextName, 'IstioGateway', namespace, name, load)
  useIstioRelationsReload(contextName, ['Pod'], reload)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <Section title="Gateway">
        <Field label="Selector">
          {Object.keys(d.selectorLabels).length > 0 ? <Chips items={d.selectorLabels} /> : '—'}
        </Field>
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
      <Section title={`Servers (${d.servers.length})`}>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th>Port</Th>
                <Th>Hosts</Th>
                <Th>TLS</Th>
                <Th>Credential</Th>
              </tr>
            </thead>
            <tbody>
              {d.servers.map((s, i) => (
                <tr key={`${s.name}-${i}`} className="border-t border-border align-top">
                  <Td className="font-mono">
                    {portLabel(s.port)}
                    {s.bind && <div className="text-muted-foreground">bind {s.bind}</div>}
                  </Td>
                  <Td className="font-mono">
                    <Lines items={s.hosts} />
                  </Td>
                  <Td>{s.httpsRedirect ? 'Redirect to HTTPS' : s.tlsMode || '—'}</Td>
                  <Td className="font-mono">{s.credentialName || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          A credentialName is a Secret in the namespace of the gateway proxies below.
        </p>
      </Section>
      <WorkloadsSection
        title="Gateway proxies"
        contextName={contextName}
        workloads={d.workloads}
        empty="No pods match the selector."
      />
      <Section title={`VirtualServices (${d.virtualServices.length})`}>
        <RefLinks
          contextName={contextName}
          refs={d.virtualServices}
          resource={ISTIO_VIRTUALSERVICE_RESOURCE}
          kind="IstioVirtualService"
          empty="No watched VirtualService binds to this Gateway."
        />
      </Section>
    </div>
  )
}

export function RefLinks({
  contextName,
  refs,
  resource,
  kind,
  empty,
}: {
  contextName: string | null
  refs: IstioObjectRef[]
  resource: string
  kind: string
  empty: string
}) {
  if (refs.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {refs.map((r) => (
        <span key={`${r.namespace}/${r.name}`} className="font-mono text-xs">
          <span className="text-muted-foreground">{r.namespace}/</span>
          <CustomResourceReference
            contextName={contextName}
            group={ISTIO_NETWORKING_GROUP}
            resource={resource}
            kind={kind}
            namespace={r.namespace}
            name={r.name}
          />
        </span>
      ))}
    </div>
  )
}

export function IstioServiceEntryDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getIstioServiceEntry(ctx, namespace, name), [namespace, name])
  const { detail: d, error } = useResourceDetail(contextName, 'IstioServiceEntry', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <Section title="ServiceEntry">
        <Field label="Hosts" mono>
          <Lines items={d.hosts} />
        </Field>
        {d.addresses.length > 0 && (
          <Field label="Addresses" mono>
            {d.addresses.join(', ')}
          </Field>
        )}
        <Field label="Location">{d.location}</Field>
        <Field label="Resolution">{d.resolution}</Field>
        <Field label="Ports" mono>
          <Lines items={d.portList.map(portLabel)} />
        </Field>
        {Object.keys(d.workloadSelector).length > 0 && (
          <Field label="Workload selector">
            <Chips items={d.workloadSelector} />
          </Field>
        )}
        <Field label="Exported to">{d.exportTo.length ? d.exportTo.join(', ') : 'all namespaces'}</Field>
        {d.subjectAltNames.length > 0 && (
          <Field label="Subject alt names" mono>
            {d.subjectAltNames.join(', ')}
          </Field>
        )}
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
      {d.endpointList.length > 0 && (
        <Section title={`Endpoints (${d.endpointList.length})`}>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Address</Th>
                  <Th>Ports</Th>
                  <Th>Locality</Th>
                  <Th>Weight</Th>
                  <Th>Labels</Th>
                </tr>
              </thead>
              <tbody>
                {d.endpointList.map((e, i) => (
                  <tr key={`${e.address}-${i}`} className="border-t border-border align-top">
                    <Td className="font-mono">{e.address || '—'}</Td>
                    <Td className="font-mono">{e.ports || '—'}</Td>
                    <Td>{e.locality || e.network || '—'}</Td>
                    <Td className="tabular-nums">{e.weight || '—'}</Td>
                    <Td>{Object.keys(e.labels).length ? <Chips items={e.labels} /> : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <ConditionsSection conditions={d.conditions} hideWhenEmpty />
    </div>
  )
}

export function IstioSidecarDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getIstioSidecar(ctx, namespace, name), [namespace, name])
  const { detail: d, error, reload } = useResourceDetail(contextName, 'IstioSidecar', namespace, name, load)
  useIstioRelationsReload(contextName, ['Pod'], reload)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <Section title="Sidecar">
        <SelectorField labels={d.selectorLabels} scope={d.selector} />
        <Field label="Outbound traffic">{d.outboundPolicy}</Field>
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
      {d.egress.length > 0 && (
        <Section title="Egress">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Port</Th>
                  <Th>Hosts</Th>
                  <Th>Capture</Th>
                </tr>
              </thead>
              <tbody>
                {d.egress.map((l, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <Td className="font-mono">{l.port.number ? portLabel(l.port) : 'all'}</Td>
                    <Td className="font-mono">
                      <Lines items={l.hosts} />
                    </Td>
                    <Td>{l.captureMode || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {d.ingress.length > 0 && (
        <Section title="Ingress">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Port</Th>
                  <Th>Default endpoint</Th>
                  <Th>Capture</Th>
                </tr>
              </thead>
              <tbody>
                {d.ingress.map((l, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <Td className="font-mono">{portLabel(l.port)}</Td>
                    <Td className="font-mono">{l.defaultEndpoint || '—'}</Td>
                    <Td>{l.captureMode || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <WorkloadsSection contextName={contextName} workloads={d.workloads} empty="No pods match." />
    </div>
  )
}

export function IstioAuthorizationPolicyDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getIstioAuthorizationPolicy(ctx, namespace, name), [namespace, name])
  const { detail: d, error, reload } = useResourceDetail(contextName, 'IstioAuthorizationPolicy', namespace, name, load)
  useIstioRelationsReload(contextName, ['Pod'], reload)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <Section title="AuthorizationPolicy">
        <Field label="Action">
          <ActionPill action={d.action} />
          {d.provider && <span className="ml-2 font-mono text-xs">{d.provider}</span>}
        </Field>
        {d.effect && (
          <Field label="Effect">
            <span className="text-amber-700 dark:text-amber-300">{d.effect}</span>
          </Field>
        )}
        {d.targetRefs.length > 0 ? (
          <Field label="Targets" mono>
            <Lines items={d.targetRefs} />
          </Field>
        ) : (
          <SelectorField labels={d.selectorLabels} scope={d.scope} meshWide={d.meshWide} />
        )}
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
      {d.ruleList.length > 0 && (
        <Section title={`Rules (${d.ruleList.length})`}>
          <p className="text-xs text-muted-foreground">
            A request matches a rule when it matches every clause; the policy applies when any rule matches.
          </p>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {d.ruleList.map((r, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <Td className="break-words font-mono">
                      <Lines items={r.from.length ? r.from : ['any']} />
                    </Td>
                    <Td className="break-words font-mono">
                      <Lines items={r.to.length ? r.to : ['any']} />
                    </Td>
                    <Td className="break-words font-mono">
                      <Lines items={r.when} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {d.targetRefs.length === 0 && (
        <WorkloadsSection contextName={contextName} workloads={d.workloads} empty="No pods match." />
      )}
    </div>
  )
}

export function IstioRequestAuthenticationDetailBody({ contextName, namespace, name }: IntegrationDetailProps) {
  const load = useCallback((ctx: string) => api.getIstioRequestAuthentication(ctx, namespace, name), [namespace, name])
  const { detail: d, error, reload } = useResourceDetail(contextName, 'IstioRequestAuthentication', namespace, name, load)
  useIstioRelationsReload(contextName, ['Pod'], reload)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!d) return null
  return (
    <div className="space-y-6">
      <Section title="RequestAuthentication">
        {d.targetRefs.length > 0 ? (
          <Field label="Targets" mono>
            <Lines items={d.targetRefs} />
          </Field>
        ) : (
          <SelectorField labels={d.selectorLabels} scope={d.scope} meshWide={d.meshWide} />
        )}
        <Field label="Age">{formatAge(d.createdAt)}</Field>
      </Section>
      {d.jwtRules.map((r, i) => (
        <Section key={`${r.issuer}-${i}`} title={`JWT issuer ${i + 1}`}>
          <Field label="Issuer" mono>
            {r.issuer || '—'}
          </Field>
          <Field label="Audiences" mono>
            {r.audiences.length ? r.audiences.join(', ') : 'any'}
          </Field>
          <Field label="Keys" mono>
            {r.inlineJwks ? 'inline JWKS' : r.jwksUri || 'issuer discovery'}
          </Field>
          <Field label="Token from">
            {[...r.fromHeaders.map((h) => `header ${h}`), ...r.fromParams.map((p) => `query ${p}`), ...r.fromCookies.map((c) => `cookie ${c}`)].join(', ') ||
              'Authorization header'}
          </Field>
          <Field label="Forwards token">{r.forwardOriginalToken ? 'Yes' : 'No'}</Field>
          {r.outputPayloadHeader && (
            <Field label="Payload header" mono>
              {r.outputPayloadHeader}
            </Field>
          )}
        </Section>
      ))}
      <p className="text-xs text-muted-foreground">
        A request without a token passes RequestAuthentication; requiring one takes an AuthorizationPolicy on
        requestPrincipals.
      </p>
      {d.targetRefs.length === 0 && (
        <WorkloadsSection contextName={contextName} workloads={d.workloads} empty="No pods match." />
      )}
    </div>
  )
}
