import { useCallback } from 'react'
import { api, type ListenerSetDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { GatewayConditions, GatewayReferences } from '@/features/gateways/GatewayDetailPrimitives'

export function ListenerSetDetailBody({ contextName, namespace, name }: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((context: string) => api.getListenerSet(context, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<ListenerSetDetail>(contextName, 'ListenerSet', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="ListenerSet">
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <Section title="Parent Gateway">
        <GatewayReferences references={[detail.parent]} namespace={namespace} contextName={contextName} />
      </Section>
      <Section title="Conditions"><GatewayConditions conditions={detail.conditions} /></Section>
      <Section title="Listeners">
        {detail.listeners.length === 0 && <p className="text-xs text-muted-foreground">No listeners configured.</p>}
        <div className="space-y-5">
          {detail.listeners.map((listener) => (
            <div key={listener.name} className="space-y-3 rounded border border-border p-3">
              <h4 className="font-mono text-sm font-medium"><Copyable value={listener.name} /></h4>
              <Field label="Protocol / port" mono>{listener.protocol} / {listener.port}</Field>
              <Field label="Hostname" mono>{listener.hostname || '*'}</Field>
              <Field label="Allowed namespaces">{listener.allowedNamespaces || 'Same'}</Field>
              {listener.namespaceSelector && <Field label="Namespace selector" mono><Copyable value={listener.namespaceSelector} /></Field>}
              <Field label="Allowed route kinds" mono>{listener.allowedKinds.join(', ') || 'Protocol defaults'}</Field>
              <Field label="Supported route kinds" mono>{listener.supportedKinds.join(', ') || 'Not reported'}</Field>
              <Field label="Attached routes">{listener.attachedRoutes}</Field>
              <Field label="TLS mode">{listener.tlsMode || 'Not configured'}</Field>
              {listener.certificateRefs.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-muted-foreground">Certificates</h5>
                  <GatewayReferences references={listener.certificateRefs} namespace={namespace} contextName={contextName} />
                </div>
              )}
              <GatewayConditions conditions={listener.conditions} />
            </div>
          ))}
        </div>
      </Section>
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
