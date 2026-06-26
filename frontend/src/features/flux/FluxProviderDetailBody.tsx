import { useCallback } from 'react'
import { Lock } from 'lucide-react'
import { api, type FluxProviderDetail } from '@/lib/api'
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

export function FluxProviderDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getFluxProvider(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<FluxProviderDetail>(
    contextName,
    'FluxProvider',
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="Provider">
        <Field label="Ready">
          <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="Type">{detail.type || '—'}</Field>
        <Field label="Channel">{detail.channel || '—'}</Field>
        <Field label="Username">{detail.username || '—'}</Field>
        <Field label="Address">
          {detail.addressFromSecret ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              <Lock className="size-3" /> from Secret
            </span>
          ) : detail.address ? (
            <Copyable className="font-mono text-xs break-all" value={detail.address} />
          ) : (
            '—'
          )}
        </Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title="Auth + transport">
        <Field label="Secret ref">{detail.secretRef || '—'}</Field>
        <Field label="Cert secret">{detail.certSecretRef || '—'}</Field>
        <Field label="Proxy">{detail.proxy || '—'}</Field>
        <Field label="Timeout">{detail.timeout || '—'}</Field>
      </Section>

      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}
