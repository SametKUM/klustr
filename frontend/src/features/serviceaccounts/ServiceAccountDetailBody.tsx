import { useCallback } from 'react'
import { api, type ServiceAccountDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { Chips, ErrorBox, Field, MaybeSection, Section } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { useUIStore } from '@/store/ui'

export function ServiceAccountDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getServiceAccount(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<ServiceAccountDetail>(
    contextName,
    'ServiceAccount',
    load,
  )
  const openResource = useUIStore((s) => s.openResource)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null
  return (
    <div className="space-y-6">
      <Section title="Metadata">
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
        <Field label="Auto-mount Token">{detail.automountServiceAccountToken || '—'}</Field>
      </Section>
      {detail.secrets.length > 0 && (
        <Section title="Secrets">
          <div className="space-y-1">
            {detail.secrets.map((s) => (
              <button
                key={`${s.namespace}/${s.name}`}
                type="button"
                onClick={() =>
                  openResource({
                    kind: 'Secret',
                    namespace: s.namespace || namespace,
                    name: s.name,
                    context: contextName ?? undefined,
                  })
                }
                className="block w-full truncate rounded border border-border bg-background px-2 py-1 text-left font-mono text-xs hover:bg-muted"
              >
                {s.namespace || namespace}/{s.name}
              </button>
            ))}
          </div>
        </Section>
      )}
      {detail.imagePullSecrets.length > 0 && (
        <Section title="Image Pull Secrets">
          <div className="space-y-1">
            {detail.imagePullSecrets.map((s) => (
              <button
                key={`${s.namespace}/${s.name}`}
                type="button"
                onClick={() =>
                  openResource({
                    kind: 'Secret',
                    namespace: s.namespace || namespace,
                    name: s.name,
                    context: contextName ?? undefined,
                  })
                }
                className="block w-full truncate rounded border border-border bg-background px-2 py-1 text-left font-mono text-xs hover:bg-muted"
              >
                {s.namespace || namespace}/{s.name}
              </button>
            ))}
          </div>
        </Section>
      )}
      <MaybeSection
        title="Labels"
        items={detail.labels}
        render={() => <Chips items={detail.labels} />}
      />
      <MaybeSection
        title="Annotations"
        items={detail.annotations}
        render={() => <Chips items={detail.annotations} />}
      />
    </div>
  )
}
