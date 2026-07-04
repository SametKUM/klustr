import { useCallback } from 'react'
import { api, type NetworkPolicyDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function NetworkPolicyDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getNetworkPolicy(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<NetworkPolicyDetail>(contextName, 'NetworkPolicy', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Status">
        <Field label="Pod Selector" mono>{detail.podSelector}</Field>
        <Field label="Policy Types">{detail.policyTypes.join(', ') || '—'}</Field>
        <Field label="Ingress Rules">{detail.ingress}</Field>
        <Field label="Egress Rules">{detail.egress}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
