import { useEffect, useState } from 'react'
import { api, type ArgoApplicationResource } from '@/lib/api'
import { useCRDStore } from '@/store/crds'
import { useUIStore, type ResourceKind, type SelectedResource } from '@/store/ui'

const BUILTIN_KINDS = new Set<ResourceKind>([
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'PersistentVolumeClaim',
  'PersistentVolume',
  'StorageClass',
  'NetworkPolicy',
  'HorizontalPodAutoscaler',
  'PodDisruptionBudget',
  'EndpointSlice',
  'ResourceQuota',
  'LimitRange',
  'IngressClass',
  'PriorityClass',
  'RuntimeClass',
  'Lease',
  'MutatingWebhookConfiguration',
  'ValidatingWebhookConfiguration',
  'Endpoints',
  'ReplicationController',
  'Job',
  'CronJob',
  'Service',
  'ConfigMap',
  'Secret',
  'Ingress',
  'Node',
  'Namespace',
])

type Props = {
  contextName: string | null
  namespace: string
  name: string
}

export function ApplicationResourcesTab({ contextName, namespace, name }: Props) {
  const [rows, setRows] = useState<ArgoApplicationResource[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const openResource = useUIStore((s) => s.openResource)
  const crds = useCRDStore((s) => s.crds)

  useEffect(() => {
    if (!contextName) return
    let cancelled = false
    setRows(null)
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
