import { useCallback } from 'react'
import { api, type FluxBucketDetail } from '@/lib/api'
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

export function FluxBucketDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getFluxBucket(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<FluxBucketDetail>(
    contextName,
    'FluxBucket',
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="Bucket">
        <Field label="Ready">
          <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="Provider">{detail.provider}</Field>
        <Field label="Bucket name">{detail.bucketName || '—'}</Field>
        <Field label="Endpoint">
          {detail.endpoint ? <Copyable className="font-mono text-xs" value={detail.endpoint} /> : '—'}
        </Field>
        <Field label="Region">{detail.region || '—'}</Field>
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
        <Field label="Prefix">{detail.prefix || '—'}</Field>
      </Section>

      <Section title="Auth + transport">
        <Field label="Secret ref">{detail.secretRef || '—'}</Field>
        <Field label="Insecure">{detail.insecure ? 'true' : 'false'}</Field>
        <Field label="Timeout">{detail.timeout || '—'}</Field>
      </Section>

      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}
