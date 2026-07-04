import { useCallback } from 'react'
import { api, type FluxGitRepositoryDetail } from '@/lib/api'
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

export function FluxGitRepositoryDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getFluxGitRepository(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<FluxGitRepositoryDetail>(contextName, 'FluxGitRepository', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="GitRepository">
        <Field label="Ready">
          <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="URL">
          {detail.url ? <Copyable className="font-mono text-xs" value={detail.url} /> : '—'}
        </Field>
        <Field label="Ref">{detail.ref || '—'}</Field>
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

      <Section title="Spec">
        <Field label="Secret ref">{detail.secretRef || '—'}</Field>
        <Field label="Timeout">{detail.timeout || '—'}</Field>
        <Field label="Verification mode">{detail.verification || '—'}</Field>
        {detail.ignorePatterns && (
          <Field label="Ignore patterns">
            <pre className="whitespace-pre-wrap text-[11px] font-mono leading-snug text-muted-foreground">
              {detail.ignorePatterns}
            </pre>
          </Field>
        )}
      </Section>

      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}
