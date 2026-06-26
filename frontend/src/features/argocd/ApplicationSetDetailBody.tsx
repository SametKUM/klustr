import { useCallback } from 'react'
import { api, type ArgoApplicationSetDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { ConditionPill } from '@/features/_shared/ConditionPill'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'
import { useUIStore } from '@/store/ui'
import { useCRDStore } from '@/store/crds'

export function ApplicationSetDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getArgoApplicationSet(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<ArgoApplicationSetDetail>(
    contextName,
    'ApplicationSet',
    load,
  )
  const openResource = useUIStore((s) => s.openResource)
  const argoAppCRD = useCRDStore(
    (s) => s.crds.find((c) => c.group === 'argoproj.io' && c.resource === 'applications') ?? null,
  )

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  const openApp = (appName: string) => {
    if (!argoAppCRD || !contextName) return
    setTimeout(() => {
      openResource({
        kind: 'Application',
        namespace,
        name: appName,
        context: contextName,
        gvr: {
          group: argoAppCRD.group,
          version: argoAppCRD.version,
          resource: argoAppCRD.resource,
        },
      })
    }, 0)
  }

  return (
    <div className="space-y-6">
      <Section title="ApplicationSet">
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      {detail.generators.length > 0 && (
        <Section title={`Generators (${detail.generators.length})`}>
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Summary</Th>
                </tr>
              </thead>
              <tbody>
                {detail.generators.map((g, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {g.type}
                      </span>
                    </Td>
                    <Td className="font-mono">{g.summary || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {(detail.templateName ||
        detail.templateProject ||
        detail.templateRepoURL ||
        detail.templateDestNs) && (
        <Section title="Template">
          {detail.templateName && (
            <Field label="Name pattern" mono>
              <Copyable value={detail.templateName} />
            </Field>
          )}
          {detail.templateProject && <Field label="Project">{detail.templateProject}</Field>}
          {detail.templateRepoURL && (
            <Field label="Repo URL" mono>
              <Copyable value={detail.templateRepoURL} />
            </Field>
          )}
          {detail.templatePath && (
            <Field label="Path" mono>
              <Copyable value={detail.templatePath} />
            </Field>
          )}
          {detail.templateRevision && (
            <Field label="Target revision" mono>
              <Copyable value={detail.templateRevision} />
            </Field>
          )}
          {detail.templateDestNs && (
            <Field label="Destination namespace" mono>
              {detail.templateDestNs}
            </Field>
          )}
        </Section>
      )}

      {detail.generatedApps.length > 0 && (
        <Section title={`Generated Applications (${detail.generatedApps.length})`}>
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Application</Th>
                  <Th>Status</Th>
                  <Th>Step</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {detail.generatedApps.map((a, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>
                      <Copyable value={a.application}>
                        {argoAppCRD ? (
                          <button
                            type="button"
                            className="cursor-pointer font-mono text-left hover:underline"
                            onClick={() => openApp(a.application)}
                          >
                            {a.application}
                          </button>
                        ) : (
                          <span className="font-mono">{a.application}</span>
                        )}
                      </Copyable>
                    </Td>
                    <Td>
                      <AppSetStatusPill value={a.status} />
                    </Td>
                    <Td className="font-mono">{a.step || '—'}</Td>
                    <Td className="text-muted-foreground">{a.message || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {detail.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td className="font-mono">{c.type}</Td>
                    <Td>
                      <ConditionPill status={c.status} />
                    </Td>
                    <Td className="font-mono">{c.reason || '—'}</Td>
                    <Td>{c.message || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}

function AppSetStatusPill({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const cls =
    value === 'Healthy' || value === 'Synced'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : value === 'Progressing' || value === 'Pending' || value === 'Waiting'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : value === 'Failed' || value === 'Error' || value === 'Degraded'
          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
          : 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {value}
    </span>
  )
}
