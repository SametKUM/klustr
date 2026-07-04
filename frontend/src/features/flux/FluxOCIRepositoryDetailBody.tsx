import { useCallback } from 'react'
import { api, type FluxOCIRepositoryDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { FluxReadyPill } from './FluxReadyPill'
import { FluxConditionsTable } from './FluxConditionsTable'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function FluxOCIRepositoryDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getFluxOCIRepository(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<FluxOCIRepositoryDetail>(contextName, 'FluxOCIRepository', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="OCIRepository">
        <Field label="Ready">
          <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="URL">
          {detail.url ? <Copyable className="font-mono text-xs" value={detail.url} /> : '—'}
        </Field>
        <Field label="Ref">{detail.ref || '—'}</Field>
        <Field label="Provider">{detail.provider || 'generic'}</Field>
        <Field label="Interval">{detail.interval || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title="Artifact">
        <Field label="Last fetched revision">
          {detail.revision ? (
            <Copyable className="font-mono text-xs" value={detail.revision} />
          ) : (
            '—'
          )}
        </Field>
      </Section>

      <Section title="Auth + verification">
        <Field label="Secret ref">{detail.secretRef || '—'}</Field>
        <Field label="Service account">{detail.serviceAccountName || '—'}</Field>
        <Field label="Cert secret">{detail.certSecretRef || '—'}</Field>
        <Field label="Verify provider">{detail.verify || '—'}</Field>
        <Field label="Insecure">{detail.insecure ? 'true' : 'false'}</Field>
        <Field label="Timeout">{detail.timeout || '—'}</Field>
      </Section>

      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}
