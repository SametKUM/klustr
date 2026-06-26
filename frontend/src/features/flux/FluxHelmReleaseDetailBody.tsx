import { useCallback } from 'react'
import { api, type FluxHelmReleaseDetail } from '@/lib/api'
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

export function FluxHelmReleaseDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getFluxHelmRelease(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<FluxHelmReleaseDetail>(
    contextName,
    'FluxHelmRelease',
    load,
  )
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="HelmRelease">
        <Field label="Ready">
          <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="Chart">{detail.chart || '—'}</Field>
        <Field label="Version">{detail.version || '—'}</Field>
        <Field label="Source">{detail.sourceRef || '—'}</Field>
        <Field label="Interval">{detail.interval || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title="Release">
        <Field label="Release name">{detail.releaseName || `(default: ${name})`}</Field>
        <Field label="Target namespace">{detail.targetNamespace || namespace}</Field>
        <Field label="Storage namespace">{detail.storageNamespace || '—'}</Field>
        <Field label="Service account">{detail.serviceAccount || '—'}</Field>
        <Field label="Timeout">{detail.timeout || '—'}</Field>
        <Field label="Last applied chart version">
          {detail.lastAppliedRevision ? (
            <Copyable className="font-mono text-xs" value={detail.lastAppliedRevision} />
          ) : (
            '—'
          )}
        </Field>
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
