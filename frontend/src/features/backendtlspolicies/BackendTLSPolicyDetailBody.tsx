import { useCallback } from 'react'
import { api, type BackendTLSPolicyDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { GatewayConditions, GatewayReferences } from '@/features/gateways/GatewayDetailPrimitives'

export function BackendTLSPolicyDetailBody({ contextName, namespace, name }: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((context: string) => api.getBackendTLSPolicy(context, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<BackendTLSPolicyDetail>(contextName, 'BackendTLSPolicy', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="TLS validation">
        <Field label="Hostname / SNI" mono><Copyable value={detail.hostname} /></Field>
        <Field label="Well-known CA certificates">{detail.wellKnownCACertificates || 'Not configured'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <Section title="Targets">
        <GatewayReferences references={detail.targetRefs} namespace={namespace} contextName={contextName} />
      </Section>
      {detail.caCertificateRefs.length > 0 && (
        <Section title="CA certificate references">
          <GatewayReferences references={detail.caCertificateRefs} namespace={namespace} contextName={contextName} />
        </Section>
      )}
      <Section title="Subject alternative names">
        {detail.subjectAltNames.length === 0 ? (
          <p className="text-xs text-muted-foreground">The backend certificate must match the validation hostname.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground"><tr><Th>Type</Th><Th>Value</Th></tr></thead>
              <tbody>
                {detail.subjectAltNames.map((san, index) => (
                  <tr key={index} className="border-t border-border">
                    <Td>{san.type}</Td><Td className="font-mono"><Copyable value={san.value} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title="Ancestor status">
        {detail.ancestors.length === 0 && <p className="text-xs text-muted-foreground">No ancestor status reported yet.</p>}
        <div className="space-y-4">
          {detail.ancestors.map((ancestor, index) => (
            <div key={index} className="space-y-2">
              <GatewayReferences references={[ancestor.ancestor]} namespace={namespace} contextName={contextName} />
              <Field label="Controller" mono><Copyable value={ancestor.controller} /></Field>
              <GatewayConditions conditions={ancestor.conditions} />
            </div>
          ))}
        </div>
      </Section>
      <MaybeSection title="Options" items={detail.options} render={() => <Chips items={detail.options} />} />
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
