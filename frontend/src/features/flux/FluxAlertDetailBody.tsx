import { useCallback } from 'react'
import { api, type FluxAlertDetail, type FluxAlertSource } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { useUIStore } from '@/store/ui'
import { FluxReadyPill } from './FluxReadyPill'
import { FluxConditionsTable } from './FluxConditionsTable'
import {
  FLUX_NOTIFICATION_GROUP,
  FLUX_PROVIDER_RESOURCE,
} from './fluxKinds'

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function FluxAlertDetailBody({ contextName, namespace, name }: Props) {
  const load = useCallback(
    (ctx: string) => api.getFluxAlert(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<FluxAlertDetail>(contextName, 'FluxAlert', namespace, name, load)
  // openResource pushes the current resource onto Klustr's detail nav stack
  // before replacing it, so the dialog's back-arrow returns to the Alert.
  // setSelectedResource would clear the stack and trap the user.
  const openResource = useUIStore((s) => s.openResource)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  const openProvider = () => {
    if (!detail.provider) return
    openResource({
      kind: 'FluxProvider',
      namespace: detail.namespace,
      name: detail.provider,
      context: contextName ?? undefined,
      gvr: {
        group: FLUX_NOTIFICATION_GROUP,
        version: 'v1beta3',
        resource: FLUX_PROVIDER_RESOURCE,
      },
    })
  }

  return (
    <div className="space-y-6">
      <Section title="Alert">
        <Field label="Ready">
          <FluxReadyPill value={detail.ready} suspended={detail.suspended} />
        </Field>
        <Field label="Status message">{detail.status || '—'}</Field>
        <Field label="Severity">{detail.severity || 'info'}</Field>
        <Field label="Provider">
          {detail.provider ? (
            <button
              type="button"
              onClick={openProvider}
              className="font-mono text-xs text-foreground hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Open Provider detail"
            >
              {detail.provider}
            </button>
          ) : (
            '—'
          )}
        </Field>
        <Field label="Summary">{detail.summary || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <Section title={`Event sources (${detail.eventSources.length})`}>
        {detail.eventSources.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No event sources — the alert never fires.
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Kind</Th>
                  <Th>Namespace</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {detail.eventSources.map((s: FluxAlertSource, i: number) => (
                  <tr key={i} className="border-t border-border">
                    <Td className="font-mono">{s.kind}</Td>
                    <Td className="font-mono">{s.namespace || '—'}</Td>
                    <Td className="font-mono">{s.name || '*'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {(detail.inclusionList.length > 0 || detail.exclusionList.length > 0) && (
        <Section title="Filters">
          {detail.inclusionList.length > 0 && (
            <Field label={`Include (${detail.inclusionList.length})`}>
              <ul className="space-y-1 text-xs">
                {detail.inclusionList.map((p) => (
                  <li key={p} className="font-mono">
                    {p}
                  </li>
                ))}
              </ul>
            </Field>
          )}
          {detail.exclusionList.length > 0 && (
            <Field label={`Exclude (${detail.exclusionList.length})`}>
              <ul className="space-y-1 text-xs">
                {detail.exclusionList.map((p) => (
                  <li key={p} className="font-mono">
                    {p}
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </Section>
      )}

      {Object.keys(detail.eventMetadata).length > 0 && (
        <Section title="Event metadata">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 text-xs">
            {Object.entries(detail.eventMetadata).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-muted-foreground">{k}</dt>
                <dd className="font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <FluxConditionsTable conditions={detail.conditions} />
    </div>
  )
}
