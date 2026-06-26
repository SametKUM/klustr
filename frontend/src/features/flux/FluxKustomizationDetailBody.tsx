import { useCallback } from 'react'
import { api, type FluxKustomizationDetail } from '@/lib/api'
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

export function FluxKustomizationDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getFluxKustomization(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<FluxKustomizationDetail>(
    contextName,
    'FluxKustomization',
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="Kustomization">
        <Field label="Ready">
          <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="Source">{detail.sourceRef || '—'}</Field>
        <Field label="Path">{detail.path || '—'}</Field>
        <Field label="Interval">{detail.interval || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title="Revision">
        <Field label="Last attempted">
          {detail.revision ? (
            <Copyable className="font-mono text-xs" value={detail.revision} />
          ) : (
            '—'
          )}
        </Field>
        <Field label="Last applied">
          {detail.lastAppliedRevision ? (
            <Copyable className="font-mono text-xs" value={detail.lastAppliedRevision} />
          ) : (
            '—'
          )}
        </Field>
      </Section>

      <Section title="Spec">
        <Field label="Prune">{boolLabel(detail.prune)}</Field>
        <Field label="Wait">{boolLabel(detail.wait)}</Field>
        <Field label="Force">{boolLabel(detail.force)}</Field>
        <Field label="Target namespace">{detail.targetNamespace || '—'}</Field>
        <Field label="Service account">{detail.serviceAccountName || '—'}</Field>
        <Field label="Timeout">{detail.timeout || '—'}</Field>
        <Field label="Retry interval">{detail.retryInterval || '—'}</Field>
      </Section>

      {detail.dependsOn && detail.dependsOn.length > 0 && (
        <Section title={`Depends on (${detail.dependsOn.length})`}>
          <ul className="space-y-1 text-xs">
            {detail.dependsOn.map((d) => (
              <li key={d} className="font-mono">
                {d}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}

function boolLabel(v: boolean): string {
  return v ? 'true' : 'false'
}
