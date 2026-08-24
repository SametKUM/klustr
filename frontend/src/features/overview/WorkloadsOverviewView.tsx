import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  type CronJobInfo,
  type DaemonSetInfo,
  type DeploymentInfo,
  type EventInfo,
  type JobInfo,
  type PodInfo,
  type ReplicaSetInfo,
  type ReplicationControllerInfo,
  type StatefulSetInfo,
} from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { formatAge } from '@/lib/time'
import { useNowTick } from '@/lib/nowTick'
import { namespaceQuery } from '@/lib/namespaceFilter'
import { useActiveContexts, useIsAggregated, useUIStore, type ResourceView } from '@/store/ui'

const POLL_INTERVAL_MS = 30_000
const EVENTS_LIMIT = 200

type WorkloadHealth = {
  kind: string
  view: ResourceView
  total: number
  healthy: number
  // Intentionally-inactive members (e.g. suspended CronJobs) — shown as a neutral
  // segment, not red, so a deliberately-disabled resource doesn't read as broken.
  neutral?: number
}

type TaggedEvent = EventInfo & { contextName: string }

export function WorkloadsOverviewView() {
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const setSelectedView = useUIStore((s) => s.setSelectedView)
  const { apiNamespace, matches } = useMemo(
    () => namespaceQuery(selectedNamespaces),
    [selectedNamespaces],
  )
  const multi = selectedNamespaces.length > 1
  const ctxKey = activeContexts.join('|')

  const [pods, setPods] = useState<PodInfo[]>([])
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([])
  const [statefulSets, setStatefulSets] = useState<StatefulSetInfo[]>([])
  const [daemonSets, setDaemonSets] = useState<DaemonSetInfo[]>([])
  const [replicaSets, setReplicaSets] = useState<ReplicaSetInfo[]>([])
  const [replicationControllers, setReplicationControllers] = useState<ReplicationControllerInfo[]>([])
  const [jobs, setJobs] = useState<JobInfo[]>([])
  const [cronJobs, setCronJobs] = useState<CronJobInfo[]>([])
  const [events, setEvents] = useState<TaggedEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const debounceRef = useRef<number | null>(null)
  const epochRef = useRef(0)

  const filterByNs = useCallback(
    <T extends { namespace: string }>(list: T[]): T[] =>
      multi ? list.filter((r) => matches(r.namespace)) : list,
    [multi, matches],
  )

  // Workload counts are cheap informer-cache reads, so they refresh on every
  // debounced kube:change burst. Events are a real apiserver List (there is no
  // Events informer), so they're pulled separately on the slow poll only —
  // otherwise pod churn would hammer the Events endpoint every ~300ms.
  const pullCounts = useCallback(() => {
    if (activeContexts.length === 0) return
    const epoch = epochRef.current
    const fetches = activeContexts.map((ctx) =>
      Promise.all([
        api.listPods(ctx, apiNamespace),
        api.listDeployments(ctx, apiNamespace),
        api.listStatefulSets(ctx, apiNamespace),
        api.listDaemonSets(ctx, apiNamespace),
        api.listReplicaSets(ctx, apiNamespace),
        api.listReplicationControllers(ctx, apiNamespace),
        api.listJobs(ctx, apiNamespace),
        api.listCronJobs(ctx, apiNamespace),
      ])
        .then(([p, d, s, ds, rs, rc, j, cj]) => ({
          p: p ?? [],
          d: d ?? [],
          s: s ?? [],
          ds: ds ?? [],
          rs: rs ?? [],
          rc: rc ?? [],
          j: j ?? [],
          cj: cj ?? [],
          err: null as string | null,
        }))
        .catch((err: unknown) => ({
          p: [] as PodInfo[],
          d: [] as DeploymentInfo[],
          s: [] as StatefulSetInfo[],
          ds: [] as DaemonSetInfo[],
          rs: [] as ReplicaSetInfo[],
          rc: [] as ReplicationControllerInfo[],
          j: [] as JobInfo[],
          cj: [] as CronJobInfo[],
          err: String(err),
        })),
    )

    Promise.all(fetches)
      .then((results) => {
        if (epoch !== epochRef.current) return
        const mergedPods: PodInfo[] = []
        const mergedDeployments: DeploymentInfo[] = []
        const mergedStatefulSets: StatefulSetInfo[] = []
        const mergedDaemonSets: DaemonSetInfo[] = []
        const mergedReplicaSets: ReplicaSetInfo[] = []
        const mergedReplicationControllers: ReplicationControllerInfo[] = []
        const mergedJobs: JobInfo[] = []
        const mergedCronJobs: CronJobInfo[] = []
        const firstError = results.find((r) => r.err && !r.err.includes('no active watcher'))?.err
        for (const r of results) {
          mergedPods.push(...filterByNs(r.p))
          mergedDeployments.push(...filterByNs(r.d))
          mergedStatefulSets.push(...filterByNs(r.s))
          mergedDaemonSets.push(...filterByNs(r.ds))
          mergedReplicaSets.push(...filterByNs(r.rs))
          mergedReplicationControllers.push(...filterByNs(r.rc))
          mergedJobs.push(...filterByNs(r.j))
          mergedCronJobs.push(...filterByNs(r.cj))
        }
        setPods(mergedPods)
        setDeployments(mergedDeployments)
        setStatefulSets(mergedStatefulSets)
        setDaemonSets(mergedDaemonSets)
        setReplicaSets(mergedReplicaSets)
        setReplicationControllers(mergedReplicationControllers)
        setJobs(mergedJobs)
        setCronJobs(mergedCronJobs)
        setError(firstError ?? null)
        setLastUpdatedAt(Date.now())
      })
      .catch(() => {
        /* per-context errors handled above */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, apiNamespace, filterByNs])

  const pullEvents = useCallback(() => {
    if (activeContexts.length === 0) return
    const epoch = epochRef.current
    const fetches = activeContexts.map((ctx) =>
      api
        .listEvents(ctx, apiNamespace, '', '')
        .then((e) => ({ ctx, e: e ?? [] }))
        .catch(() => ({ ctx, e: [] as EventInfo[] })),
    )
    Promise.all(fetches)
      .then((results) => {
        if (epoch !== epochRef.current) return
        const mergedEvents: TaggedEvent[] = []
        for (const r of results) {
          for (const ev of filterByNs(r.e)) {
            mergedEvents.push(Object.assign(ev, { contextName: r.ctx }) as TaggedEvent)
          }
        }
        mergedEvents.sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''))
        setEvents(mergedEvents.slice(0, EVENTS_LIMIT))
      })
      .catch(() => {
        /* per-context errors handled above */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, apiNamespace, filterByNs])

  useEffect(() => {
    if (activeContexts.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Workload snapshots are scoped to active contexts.
      setPods([])
      setDeployments([])
      setStatefulSets([])
      setDaemonSets([])
      setReplicaSets([])
      setReplicationControllers([])
      setJobs([])
      setCronJobs([])
      setEvents([])
      return
    }
    pullCounts()
    pullEvents()

    const scheduleSoon = () => {
      if (debounceRef.current !== null) return
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        pullCounts()
      }, 300)
    }

    const id = window.setInterval(() => {
      pullCounts()
      pullEvents()
    }, POLL_INTERVAL_MS)
    const kinds = [
      'Pod',
      'Deployment',
      'StatefulSet',
      'DaemonSet',
      'ReplicaSet',
      'ReplicationController',
      'Job',
      'CronJob',
    ]
    const unsubs = kinds.map((kind) =>
      onKubeChange(kind, (ctx) => {
        if (activeContexts.includes(ctx)) scheduleSoon()
      }),
    )
    const epochAtSetup = epochRef.current

    return () => {
      epochRef.current = epochAtSetup + 1
      window.clearInterval(id)
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      unsubs.forEach((u) => u())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, pullCounts, pullEvents])

  // Memoize so typing in the events search (same component) doesn't
  // re-filter all 8 workload lists on every keystroke — they didn't change.
  const cards = useMemo<WorkloadHealth[]>(() => [
    {
      kind: 'Pods',
      view: 'pods',
      total: pods.length,
      healthy: pods.filter(isPodHealthy).length,
    },
    {
      kind: 'Deployments',
      // Scaled-to-0 workloads are intentionally idle, not unhealthy — exclude
      // them from the total so they stay out of the red bar, mirroring the
      // ReplicaSet/ReplicationController handling below.
      view: 'deployments',
      total: deployments.filter((d) => !isScaledToZero(d.ready)).length,
      healthy: deployments.filter((d) => isReadyString(d.ready)).length,
    },
    {
      kind: 'StatefulSets',
      view: 'statefulsets',
      total: statefulSets.filter((s) => !isScaledToZero(s.ready)).length,
      healthy: statefulSets.filter((s) => isReadyString(s.ready)).length,
    },
    {
      kind: 'DaemonSets',
      view: 'daemonsets',
      total: daemonSets.filter((d) => d.desired > 0).length,
      healthy: daemonSets.filter((d) => d.desired > 0 && d.ready === d.desired).length,
    },
    {
      kind: 'ReplicaSets',
      view: 'replicasets',
      // Scaled-down ReplicaSets (desired 0) are kept around for rollback and are
      // not unhealthy; excluding them from the total keeps them out of the red bar.
      total: replicaSets.filter((r) => r.desired > 0).length,
      healthy: replicaSets.filter((r) => r.desired > 0 && r.ready === r.desired).length,
    },
    {
      kind: 'ReplicationControllers',
      view: 'replicationcontrollers',
      total: replicationControllers.filter((r) => r.desired > 0).length,
      healthy: replicationControllers.filter((r) => r.desired > 0 && r.ready === r.desired).length,
    },
    {
      kind: 'Jobs',
      view: 'jobs',
      total: jobs.length,
      healthy: jobs.filter((j) => j.status !== 'Failed').length,
    },
    {
      kind: 'CronJobs',
      view: 'cronjobs',
      total: cronJobs.length,
      healthy: cronJobs.filter((c) => !c.suspend).length,
      neutral: cronJobs.filter((c) => c.suspend).length,
    },
  ], [pods, deployments, statefulSets, daemonSets, replicaSets, replicationControllers, jobs, cronJobs])

  if (activeContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a context to see the workloads overview.
      </div>
    )
  }

  const filteredEvents = filterEvents(events, query)
  const scopeLabel = isAggregated
    ? `${activeContexts.length} contexts`
    : (activeContexts[0] ?? '')
  const namespaceLabel =
    selectedNamespaces.length === 0
      ? 'all namespaces'
      : selectedNamespaces.length === 1
        ? selectedNamespaces[0]
        : `${selectedNamespaces.length} namespaces`

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-medium">Workloads Overview</h1>
          <span
            className="text-xs text-muted-foreground"
            title={isAggregated ? activeContexts.join(', ') : undefined}
          >
            {scopeLabel}
            {' · '}
            {namespaceLabel}
          </span>
        </div>
        <UpdatedAgo at={lastUpdatedAt} />
      </div>

      {error && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3 px-6 py-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <WorkloadCard
            key={c.kind}
            kind={c.kind}
            total={c.total}
            healthy={c.healthy}
            neutral={c.neutral}
            onClick={() => setSelectedView(c.view)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 pb-2">
        <div className="text-xs text-muted-foreground">
          {filteredEvents.length} of {events.length} events
        </div>
        <input
          type="text"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events…"
          className="h-7 w-64 rounded-md border border-input bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <EventsTable events={filteredEvents} showContext={isAggregated} />
    </div>
  )
}

function isPodHealthy(p: PodInfo): boolean {
  // A finished pod reads as "Completed" (terminated-container reason) far more
  // often than the bare "Succeeded" phase; both mean the pod did its job and
  // must not be counted as failing.
  if (p.status === 'Succeeded' || p.status === 'Completed') return true
  if (p.status !== 'Running') return false
  return isReadyString(p.ready)
}

function isReadyString(s: string): boolean {
  if (!s) return false
  const parts = s.split('/')
  if (parts.length !== 2) return false
  const r = parseInt(parts[0], 10)
  const t = parseInt(parts[1], 10)
  if (Number.isNaN(r) || Number.isNaN(t)) return false
  return t > 0 && r === t
}

function isScaledToZero(s: string): boolean {
  const parts = s.split('/')
  if (parts.length !== 2) return false
  return parseInt(parts[1], 10) === 0
}

type WorkloadCardProps = {
  kind: string
  total: number
  healthy: number
  neutral?: number
  onClick: () => void
}

function WorkloadCard({ kind, total, healthy, neutral = 0, onClick }: WorkloadCardProps) {
  const unhealthy = Math.max(0, total - healthy - neutral)
  const healthyPct = total > 0 ? (healthy / total) * 100 : 0
  const neutralPct = total > 0 ? (neutral / total) * 100 : 0
  const unhealthyPct = total > 0 ? (unhealthy / total) * 100 : 0

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 text-sm text-sky-500 underline-offset-2 hover:underline"
      >
        {kind} ({total})
      </button>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
        {total > 0 && (
          <>
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500"
              style={{ width: `${healthyPct}%` }}
            />
            <div
              className="absolute inset-y-0 bg-muted-foreground/50"
              style={{ left: `${healthyPct}%`, width: `${neutralPct}%` }}
            />
            <div
              className="absolute inset-y-0 bg-destructive"
              style={{ left: `${healthyPct + neutralPct}%`, width: `${unhealthyPct}%` }}
            />
          </>
        )}
      </div>
      <div className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {healthy}/{total}
      </div>
    </div>
  )
}

function UpdatedAgo({ at }: { at: number | null }) {
  // Re-render on the shared 10s heartbeat instead of a per-instance interval,
  // so aggregated mode doesn't run one ticking timer per visible context.
  useNowTick()
  if (at === null) {
    return <span className="text-xs text-muted-foreground">Loading…</span>
  }
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      Updated {formatAge(new Date(at).toISOString())} ago
    </span>
  )
}

function filterEvents(events: TaggedEvent[], query: string): TaggedEvent[] {
  const q = query.trim().toLowerCase()
  if (!q) return events
  return events.filter((e) =>
    [e.message, e.objectKind, e.objectName, e.reason, e.source, e.namespace, e.type, e.contextName]
      .some((v) => v && v.toLowerCase().includes(q)),
  )
}

function EventsTable({ events, showContext }: { events: TaggedEvent[]; showContext: boolean }) {
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  if (events.length === 0) {
    return (
      <div className="mx-6 mb-6 rounded-lg border border-border bg-card px-3 py-4 text-center text-xs text-muted-foreground">
        No events.
      </div>
    )
  }
  return (
    <div className="mx-6 mb-6 overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {showContext && <th className="px-3 py-2 font-medium">Context</th>}
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Namespace</th>
            <th className="px-3 py-2 font-medium">Object</th>
            <th className="px-3 py-2 font-medium">Message</th>
            <th className="px-3 py-2 font-medium">Reason</th>
            <th className="px-3 py-2 font-medium">Count</th>
            <th className="px-3 py-2 font-medium">Age</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => {
            const clickable = Boolean(e.objectKind && e.objectName)
            return (
              <tr
                key={`${e.contextName}/${e.namespace}/${e.name}/${i}`}
                className={`border-b border-border/50 last:border-0 hover:bg-muted/40 ${clickable ? 'cursor-pointer' : ''}`}
                onClick={
                  clickable
                    ? () =>
                        setSelectedResource({
                          kind: e.objectKind,
                          namespace: e.namespace,
                          name: e.objectName,
                          context: e.contextName,
                        })
                    : undefined
                }
              >
                {showContext && (
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground">
                    {e.contextName}
                  </td>
                )}
                <td className={`px-3 py-2 align-top font-medium ${e.type === 'Warning' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {e.type}
                </td>
                <td className="px-3 py-2 align-top text-muted-foreground">{e.source}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{e.namespace}</td>
                <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground">
                  {e.objectKind}: {e.objectName}
                </td>
                <td className="px-3 py-2 align-top text-foreground">{e.message}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{e.reason}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{e.count}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">
                  {formatAge(e.lastSeen)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
