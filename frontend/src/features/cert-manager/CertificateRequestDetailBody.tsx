import { useCallback } from 'react'
import { api, type CertManagerCertificateRequestDetail } from '@/lib/api'
import { formatAge, formatTimestamp } from '@/lib/time'
import { ErrorBox, Field, Section } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { CertManagerConditionPill } from './CertManagerConditionPill'
import { CertManagerConditionsTable } from './CertManagerConditionsTable'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function CertificateRequestDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getCertManagerCertificateRequest(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<CertManagerCertificateRequestDetail>(contextName, 'CertificateRequest', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  const issuer = detail.issuer
    ? detail.issuerGroup
      ? `${detail.issuer} (${detail.issuerGroup})`
      : detail.issuer
    : '—'

  return (
    <div className="space-y-6">
      <Section title="CertificateRequest">
        <Field label="Ready">
          <CertManagerConditionPill kind="ready" status={detail.ready} />
        </Field>
        <Field label="Approved">
          <CertManagerConditionPill kind="approved" status={detail.approved} />
        </Field>
        <Field label="Denied">
          <CertManagerConditionPill kind="denied" status={detail.denied} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="Issuer">{issuer}</Field>
        {detail.isCA && <Field label="CA request">yes</Field>}
        {detail.failureTime && (
          <Field label="Failure time">
            <span title={detail.failureTime}>{formatTimestamp(detail.failureTime)}</span>
          </Field>
        )}
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.usages.length > 0 && (
        <Section title="Usages">
          <Field label="Key usages">{detail.usages.join(', ')}</Field>
        </Section>
      )}

      <CertManagerConditionsTable conditions={detail.conditions} />
    </div>
  )
}
