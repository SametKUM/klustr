import { useEffect, useState } from 'react'
import {
  api,
  type ArgoApplicationHealth,
  type ArgoApplicationResource,
} from '@/lib/api'
import { RESOURCE_GROUPS } from '@/features/_shared/resourceGroups'
import { useCRDStore } from '@/store/crds'
import { useUIStore, type ResourceKind, type SelectedResource } from '@/store/ui'

// Derive the clickable built-in kinds from the same static sidebar groups that
// drive ResourceDetailPanel dispatch, so a kind with a detail view can never
// drift out of this allow-list (CR-backed groups are handled via the crds
// store below, not here).
const BUILTIN_KINDS: ReadonlySet<ResourceKind> = new Set(
  RESOURCE_GROUPS.flatMap((g) => g.items)
    .map((i) => i.kind)
    .filter((k): k is ResourceKind => k !== undefined),
)

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function ApplicationResourcesTab({ contextName, namespace, name }: Props) {
  const [rows, setRows] = useState<ArgoApplicationResource[] | null>(null)
  const [health, setHealth] = useState<ArgoApplicationHealth | null>(null)
  const [error, setError] = useState<string | null>(null)
  const openResource = useUIStore((s) => s.openResource)
  const crds = useCRDStore((s) => s.crds)

  useEffect(() => {
    if (!contextName) return
    let cancelled = false
    setRows(null)
    setHealth(null)
    setError(null)
    api
      .listArgoApplicationResources(contextName, namespace, name)
      .then((list) => {
        if (cancelled) return
        setRows(list ?? [])
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
    api
      .getArgoApplicationHealth(contextName, namespace, name)
      .then((h) => {
        if (!cancelled) setHealth(h)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [contextName, namespace, name])

  const onRowClick = (row: ArgoApplicationResource) => {
    if (!contextName) return
    const next = resolveSelection(row, contextName, crds)
    if (next) openResource(next)
  }

  if (error) {
    return (
      <div className="px-6 py-4 text-xs text-destructive">
        Failed to load managed resources: {error}
      </div>
    )
  }
  if (rows === null) {
    return (
      <div className="px-6 py-4 text-xs text-muted-foreground">Loading managed resources…</div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="px-6 py-4 text-xs text-muted-foreground">
        Argo has not yet recorded any managed resources for this Application.
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <HealthBanner health={health} resourceHasHealth={rows.some((r) => !!r.health)} />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-1.5 text-left font-medium">Kind</th>
            <th className="px-2 py-1.5 text-left font-medium">Namespace</th>
            <th className="px-2 py-1.5 text-left font-medium">Name</th>
            <th className="px-2 py-1.5 text-left font-medium">Sync</th>
            <th className="px-2 py-1.5 text-left font-medium">Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const clickable = isClickable(r, crds)
            return (
              <tr
                key={`${r.group}/${r.kind}/${r.namespace}/${r.name}/${idx}`}
                onClick={clickable ? () => onRowClick(r) : undefined}
                className={[
                  'border-b border-border/60 transition-colors',
                  clickable
                    ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
                    : 'cursor-default opacity-75',
                ].join(' ')}
                title={clickable ? `Open ${r.kind} ${r.namespace}/${r.name}` : undefined}
              >
                <td className="px-2 py-1.5 font-medium">{r.kind}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.namespace || '—'}</td>
                <td className="px-2 py-1.5">{r.name}</td>
                <td className="px-2 py-1.5">
                  <SyncPill value={r.sync} />
                </td>
                <td className="px-2 py-1.5">
                  <HealthPill value={r.health} title={r.message || undefined} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function resolveSelection(
  row: ArgoApplicationResource,
  contextName: string,
  crds: ReturnType<typeof useCRDStore.getState>['crds'],
): SelectedResource | null {
  const kind = row.kind as ResourceKind
  if (BUILTIN_KINDS.has(kind)) {
    return {
      kind,
      namespace: row.namespace,
      name: row.name,
      context: contextName,
    }
  }
  const crd = crds.find((c) => c.group === row.group && c.kind === row.kind)
  if (!crd) return null
  return {
    kind: row.kind,
    namespace: row.namespace,
    name: row.name,
    context: contextName,
    gvr: { group: crd.group, version: crd.version, resource: crd.resource },
  }
}

function isClickable(
  row: ArgoApplicationResource,
  crds: ReturnType<typeof useCRDStore.getState>['crds'],
): boolean {
  if (BUILTIN_KINDS.has(row.kind as ResourceKind)) return true
  return crds.some((c) => c.group === row.group && c.kind === row.kind)
}

function HealthBanner({
  health,
  resourceHasHealth,
}: {
  health: ArgoApplicationHealth | null
  resourceHasHealth: boolean
}) {
  if (!health) return null
  const { status, message, conditions } = health
  const isHealthy = status === '' || status === 'Healthy'
  // Nothing worth a banner: app is Healthy and Argo logged no conditions.
  if (isHealthy && conditions.length === 0) return null

  const dest = health.destName || health.destServer
  const destLabel = [dest, health.destNamespace].filter(Boolean).join(' / ')
  const degraded = status === 'Degraded' || status === 'Missing'
  // Argo's per-resource degraded reason lives only in argocd-server's resource
  // tree. When the controller doesn't persist resource health into the CR and
  // carries no app-level message/condition, there is genuinely no reason for
  // Klustr to show from the K8s API — say so instead of looking like a bug.
  const reasonAbsent =
    degraded && !message && conditions.length === 0 && !health.resourceHealthPersisted && !resourceHasHealth

  const tone = degraded
    ? 'border-rose-500/40 bg-rose-500/10'
    : status === 'Progressing' || status === 'Suspended'
      ? 'border-amber-500/40 bg-amber-500/10'
      : 'border-border bg-muted/40'

  return (
    <div className={`mb-4 rounded-md border px-3 py-2.5 text-xs ${tone}`}>
      <div className="flex items-center gap-2">
        <HealthPill value={status} />
        {destLabel && (
          <span className="text-muted-foreground">
            destination: <span className="font-mono">{destLabel}</span>
          </span>
        )}
      </div>
      {message && <p className="mt-1.5 text-foreground/90">{message}</p>}
      {conditions.map((c, i) => (
        <p key={`${c.type}/${i}`} className="mt-1.5">
          <span className="font-medium">{c.type}:</span>{' '}
          <span className="text-foreground/90">{c.message}</span>
        </p>
      ))}
      {reasonAbsent && (
        <p className="mt-1.5 text-muted-foreground">
          Argo CD did not persist per-resource health for this Application, so the degraded reason
          is not in the cluster API — it lives only in the Argo CD server's resource tree. Open the
          managed resources{destLabel ? ` on ${destLabel}` : ''} to see which one is unhealthy.
        </p>
      )}
    </div>
  )
}

export function SyncPill({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground/70">—</span>
  const cls =
    value === 'Synced'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : value === 'OutOfSync'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {value}
    </span>
  )
}

export function HealthPill({ value, title }: { value: string; title?: string }) {
  if (!value) return <span className="text-muted-foreground/70">—</span>
  const cls =
    value === 'Healthy'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : value === 'Degraded' || value === 'Missing'
        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
        : value === 'Progressing' || value === 'Suspended'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
  return (
    <span
      title={title}
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {value}
    </span>
  )
}
