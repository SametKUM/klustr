import { useCallback } from 'react'
import { api, type FluxHelmRepositoryDetail } from '@/lib/api'
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

export function FluxHelmRepositoryDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getFluxHelmRepository(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<FluxHelmRepositoryDetail>(contextName, 'FluxHelmRepository', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="HelmRepository">
        <Field label="Ready">
          <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="Type">{detail.type}</Field>
        <Field label="Provider">{detail.provider || 'generic'}</Field>
        <Field label="URL">
          {detail.url ? <Copyable className="font-mono text-xs" value={detail.url} /> : '—'}
        </Field>
        <Field label="Interval">{detail.interval || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title="Auth + transport">
        <Field label="Secret ref">{detail.secretRef || '—'}</Field>
        <Field label="Pass credentials">{detail.passCredentials ? 'true' : 'false'}</Field>
        <Field label="Timeout">{detail.timeout || '—'}</Field>
      </Section>

      {detail.type !== 'oci' && (
        <Section title="Artifact">
          <Field label="Last fetched revision">
            {detail.revision ? (
              <Copyable className="font-mono text-xs" value={detail.revision} />
            ) : (
              '—'
            )}
          </Field>
        </Section>
      )}

      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}
