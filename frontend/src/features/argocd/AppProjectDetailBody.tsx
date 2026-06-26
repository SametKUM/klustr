import { useCallback } from 'react'
import { api, type ArgoAppProjectDetail } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ErrorBox, Field, Section, Td, Th } from '@/features/_shared/DetailPrimitives'
import { Copyable } from '@/features/_shared/Copyable'
import { useResourceDetail } from '@/features/_shared/useResourceDetail'

export function AppProjectDetailBody({
  contextName,
  namespace,
  name,
}: {
  contextName: string | null
  namespace: string
  name: string
}) {
  const load = useCallback(
    (ctx: string) => api.getArgoAppProject(ctx, namespace, name),
    [namespace, name],
  )
  const { detail, error } = useResourceDetail<ArgoAppProjectDetail>(contextName, 'AppProject', load)
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <Section title="AppProject">
        <Field label="Description">{detail.description || '—'}</Field>
        <Field label="Age">{formatAge(detail.createdAt)}</Field>
      </Section>

      <StringListSection title="Source repositories" items={detail.sourceRepos} />
      <StringListSection
        title="Source namespaces"
        items={detail.sourceNamespaces}
        emptyHint="(controls which namespaces can host Applications referencing this project)"
      />

      {detail.destinations.length > 0 && (
        <Section title={`Destinations (${detail.destinations.length})`}>
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Server</Th>
                  <Th>Namespace</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {detail.destinations.map((d, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td className="font-mono">{d.server ? <Copyable value={d.server} /> : '*'}</Td>
                    <Td className="font-mono">{d.namespace || '*'}</Td>
                    <Td className="font-mono">{d.name || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <GroupKindSection
        title="Cluster resource whitelist"
        items={detail.clusterResourceWhitelist}
      />
      <GroupKindSection
        title="Cluster resource blacklist"
        items={detail.clusterResourceBlacklist}
      />
      <GroupKindSection
        title="Namespace resource whitelist"
        items={detail.namespaceResourceWhitelist}
      />
      <GroupKindSection
        title="Namespace resource blacklist"
        items={detail.namespaceResourceBlacklist}
      />

      {detail.roles.length > 0 && (
        <Section title={`Roles (${detail.roles.length})`}>
          <div className="space-y-3">
            {detail.roles.map((r, i) => (
              <div key={i} className="overflow-hidden rounded border border-border">
                <div className="flex items-center justify-between bg-muted/40 px-2 py-1 text-xs">
                  <span className="font-mono font-medium">{r.name}</span>
                  {r.description && (
                    <span className="text-muted-foreground">{r.description}</span>
                  )}
                </div>
                <div className="space-y-2 px-2 py-2 text-xs">
                  {r.policies.length > 0 && (
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Policies
                      </div>
                      <ul className="mt-1 space-y-0.5 font-mono">
                        {r.policies.map((p, j) => (
                          <li key={j}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.groups.length > 0 && (
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Groups
                      </div>
                      <ul className="mt-1 space-y-0.5 font-mono">
                        {r.groups.map((g, j) => (
                          <li key={j}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {detail.syncWindows.length > 0 && (
        <Section title={`Sync windows (${detail.syncWindows.length})`}>
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <Th>Kind</Th>
                  <Th>Schedule</Th>
                  <Th>Duration</Th>
                  <Th>Scope</Th>
                  <Th>Manual</Th>
                </tr>
              </thead>
              <tbody>
                {detail.syncWindows.map((w, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <Td>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          w.kind === 'allow'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {w.kind || '—'}
                      </span>
                    </Td>
                    <Td className="font-mono">{w.schedule || '—'}</Td>
                    <Td className="font-mono">
                      {w.duration || '—'}
                      {w.timeZone ? ` (${w.timeZone})` : ''}
                    </Td>
                    <Td>
                      <SyncWindowScope window={w} />
                    </Td>
                    <Td>{w.manualSync ? 'yes' : 'no'}</Td>
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

function StringListSection({
  title,
  items,
  emptyHint,
}: {
  title: string
  items: string[]
  emptyHint?: string
}) {
  if (items.length === 0) return null
  return (
    <Section title={`${title} (${items.length})`}>
      <ul className="space-y-1 font-mono text-xs">
        {items.map((s, i) => (
          <li key={i}>
            <Copyable value={s} />
          </li>
        ))}
      </ul>
      {emptyHint && <p className="mt-1 text-[11px] text-muted-foreground">{emptyHint}</p>}
    </Section>
  )
}

function GroupKindSection({
  title,
  items,
}: {
  title: string
  items: { group: string; kind: string }[]
}) {
  if (items.length === 0) return null
  return (
    <Section title={`${title} (${items.length})`}>
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Group</Th>
              <Th>Kind</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((gk, i) => (
              <tr key={i} className="border-t border-border">
                <Td className="font-mono">{gk.group || '*'}</Td>
                <Td className="font-mono">{gk.kind || '*'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function SyncWindowScope({
  window,
}: {
  window: { applications: string[]; namespaces: string[]; clusters: string[] }
}) {
  const parts: string[] = []
  if (window.applications.length > 0) parts.push(`apps: ${window.applications.join(', ')}`)
  if (window.namespaces.length > 0) parts.push(`ns: ${window.namespaces.join(', ')}`)
  if (window.clusters.length > 0) parts.push(`clusters: ${window.clusters.join(', ')}`)
  if (parts.length === 0) return <span className="text-muted-foreground">all</span>
  return <span className="font-mono">{parts.join(' • ')}</span>
}

