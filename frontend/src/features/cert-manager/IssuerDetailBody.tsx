import { useCallback } from 'react'
import { api, type CertManagerIssuerDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { CertManagerConditionPill } from './CertManagerConditionPill'
import { CertManagerConditionsTable } from './CertManagerConditionsTable'

type Props = {
  contextName: string | null
  namespace: string
  name: string
  cluster: boolean
}

export function IssuerDetailBody({ contextName, namespace, name, cluster }: Props) {
  const load = useCallback(
    (ctx: string) =>
      cluster
        ? api.getCertManagerClusterIssuer(ctx, name)
        : api.getCertManagerIssuer(ctx, namespace, name),
    [cluster, namespace, name],
  )
  const { detail, error } = useResourceDetail<CertManagerIssuerDetail>(
    contextName,
    cluster ? 'ClusterIssuer' : 'Issuer',
    cluster ? '' : namespace,
    name,
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title={cluster ? 'ClusterIssuer' : 'Issuer'}>
        <Field label="Ready">
          <CertManagerConditionPill kind="ready" status={detail.ready} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="Type">
          {detail.type ? <span className="font-mono text-xs">{detail.type}</span> : '—'}
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.type === 'acme' && (
        <Section title="ACME">
          <Field label="Server">
            {detail.acmeServer ? (
              <Copyable className="font-mono text-xs" value={detail.acmeServer} />
            ) : (
              '—'
            )}
          </Field>
          <Field label="Email">{detail.acmeEmail || '—'}</Field>
        </Section>
      )}

      <CertManagerConditionsTable conditions={detail.conditions} />
    </div>
  )
}
