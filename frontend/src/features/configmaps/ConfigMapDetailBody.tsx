import { useCallback } from 'react'
import { api, type ConfigMapDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

const VALUE_PREVIEW = 600

export function ConfigMapDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback((ctx: string) => api.getConfigMap(ctx, namespace, name), [namespace, name])
  const { detail, error } = useResourceDetail<ConfigMapDetail>(contextName, 'ConfigMap', namespace, name, load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  const dataEntries = Object.entries(detail.data ?? {})
  return (
    <div className="space-y-6">
      <Section title="Metadata">
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
        <Field label="Keys">{`${dataEntries.length} data, ${detail.binaryKeys.length} binary`}</Field>
      </Section>
      {dataEntries.length > 0 && (
        <Section title="Data">
          <div className="space-y-2">
            {dataEntries
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => (
                <div key={k} className="overflow-hidden rounded border border-border">
                  <div className="border-b border-border bg-muted/40 px-2 py-1 font-mono text-xs">{k}</div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-xs">
                    {v.length > VALUE_PREVIEW ? `${v.slice(0, VALUE_PREVIEW)}…` : v}
                  </pre>
                </div>
              ))}
          </div>
        </Section>
      )}
      {detail.binaryKeys.length > 0 && (
        <Section title="Binary Data">
          <Chips items={Object.fromEntries(detail.binaryKeys.map((k) => [k, '']))} />
        </Section>
      )}
      <MaybeSection title="Labels" items={detail.labels} render={() => <Chips items={detail.labels} />} />
      <MaybeSection title="Annotations" items={detail.annotations} render={() => <Chips items={detail.annotations} />} />
    </div>
  )
}
