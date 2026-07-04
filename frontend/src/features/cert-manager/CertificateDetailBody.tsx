import { useCallback } from 'react'
import { api, type CertManagerCertificateDetail } from '@/lib/api'
import { formatAge, formatTimestamp } from '@/lib/time'
import { ErrorBox, Field, Section } from '@/features/_shared/DetailPrimitives'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { CertManagerConditionsTable } from './CertManagerConditionsTable'
import { ExpiryCell } from './ExpiryCell'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function CertificateDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getCertManagerCertificate(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<CertManagerCertificateDetail>(contextName, 'Certificate', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  const issuer = detail.issuer
    ? detail.issuerGroup
      ? `${detail.issuer} (${detail.issuerGroup})`
      : detail.issuer
    : '—'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Certificate">
          <Field label="Ready">
            <ConditionPill status={detail.ready} />
          </Field>
          <Field label="Status message">{detail.status || '—'}</Field>
          <Field label="Common name">
            {detail.commonName ? <Copyable value={detail.commonName} /> : '—'}
          </Field>
          <Field label="Issuer">{issuer}</Field>
          <Field label="Secret name">
            {detail.secretName ? (
              <Copyable className="font-mono text-xs" value={detail.secretName} />
            ) : (
              '—'
            )}
          </Field>
          {detail.isCA && <Field label="CA certificate">yes</Field>}
          <Field label="Age">{formatAge(detail.createdAt)}</Field>
        </Section>

        <Section title="Validity">
          <Field label="Not before">
            <span title={detail.notBefore}>{formatTimestamp(detail.notBefore)}</span>
          </Field>
          <Field label="Not after">
            <span title={detail.notAfter}>{formatTimestamp(detail.notAfter)}</span>
          </Field>
          <Field label="Expires">
            {detail.notAfter ? <ExpiryCell iso={detail.notAfter} /> : '—'}
          </Field>
          <Field label="Renewal time">
            <span title={detail.renewalTime}>{formatTimestamp(detail.renewalTime)}</span>
          </Field>
          <Field label="Duration">{detail.duration || '—'}</Field>
          <Field label="Renew before">{detail.renewBefore || '—'}</Field>
        </Section>
      </div>

      {(detail.dnsNames.length > 0 ||
        detail.ipAddresses.length > 0 ||
        detail.uris.length > 0) && (
        <Section title="Subject Alternative Names">
          {detail.dnsNames.length > 0 && (
            <Field label="DNS names">
              <Copyable className="font-mono text-xs" value={detail.dnsNames.join(',')}>
                {detail.dnsNames.join(', ')}
              </Copyable>
            </Field>
          )}
          {detail.ipAddresses.length > 0 && (
            <Field label="IP addresses">
              <Copyable className="font-mono text-xs" value={detail.ipAddresses.join(',')}>
                {detail.ipAddresses.join(', ')}
              </Copyable>
            </Field>
          )}
          {detail.uris.length > 0 && (
            <Field label="URIs">
              <Copyable className="font-mono text-xs" value={detail.uris.join(',')}>
                {detail.uris.join(', ')}
              </Copyable>
            </Field>
          )}
        </Section>
      )}

      {detail.usages.length > 0 && (
        <Section title="Usages">
          <Field label="Key usages">{detail.usages.join(', ')}</Field>
        </Section>
      )}

      <CertManagerConditionsTable conditions={detail.conditions} />
    </div>
  )
}
