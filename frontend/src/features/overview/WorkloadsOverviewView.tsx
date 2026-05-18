import { useEffect, useMemo, useRef, useState } from 'react'
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
import { namespaceQuery } from '@/lib/namespaceFilter'
import { useIsAggregated, useUIStore, type ResourceView } from '@/store/ui'

const POLL_INTERVAL_MS = 30_000
const EVENTS_LIMIT = 200

type WorkloadHealth = {
  kind: string
  view: ResourceView
  total: number
  healthy: number
}

export function WorkloadsOverviewView() {
  const contextName = useUIStore((s) => s.selectedContext)
  const isAggregated = useIsAggregated()
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const setSelectedView = useUIStore((s) => s.setSelectedView)
  const { apiNamespace, matches } = useMemo(
    () => namespaceQuery(selectedNamespaces),
    [selectedNamespaces],
  )
  const multi = selectedNamespaces.length > 1

  const [pods, setPods] = useState<PodInfo[]>([])
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([])
  const [statefulSets, setStatefulSets] = useState<StatefulSetInfo[]>([])
  const [daemonSets, setDaemonSets] = useState<DaemonSetInfo[]>([])
  const [replicaSets, setReplicaSets] = useState<ReplicaSetInfo[]>([])
  const [replicationControllers, setReplicationControllers] = useState<ReplicationControllerInfo[]>([])
  const [jobs, setJobs] = useState<JobInfo[]>([])
  const [cronJobs, setCronJobs] = useState<CronJobInfo[]>([])
  const [events, setEvents] = useState<EventInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!contextName) {
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
    let cancelled = false

    const filterByNs = <T extends { namespace: string }>(list: T[]): T[] =>
      multi ? list.filter((r) => matches(r.namespace)) : list

    const pull = () => {
      Promise.all([
        api.listPods(contextName, apiNamespace),
        api.listDeployments(contextName, apiNamespace),
        api.listStatefulSets(contextName, apiNamespace),
        api.listDaemonSets(contextName, apiNamespace),
        api.listReplicaSets(contextName, apiNamespace),
        api.listReplicationControllers(contextName, apiNamespace),
        api.listJobs(contextName, apiNamespace),
        api.listCronJobs(contextName, apiNamespace),
        api.listEvents(contextName, apiNamespace, '', ''),
      ])
        .then(([p, d, s, ds, rs, rc, j, cj, e]) => {
          if (cancelled) return
          setPods(filterByNs(p ?? []))
          setDeployments(filterByNs(d ?? []))
          setStatefulSets(filterByNs(s ?? []))
          setDaemonSets(filterByNs(ds ?? []))
          setReplicaSets(filterByNs(rs ?? []))
          setReplicationControllers(filterByNs(rc ?? []))
          setJobs(filterByNs(j ?? []))
          setCronJobs(filterByNs(cj ?? []))
          setEvents(filterByNs(e ?? []).slice(0, EVENTS_LIMIT))
          setError(null)
          setLastUpdatedAt(Date.now())
        })
        .catch((err) => {
          if (cancelled) return
          if (String(err).includes('no active watcher')) return
          setError(String(err))
        })
    }

    const scheduleSoon = () => {
      if (debounceRef.current !== null) return
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        pull()
      }, 300)
    }

    pull()
    const id = window.setInterval(pull, POLL_INTERVAL_MS)
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
        if (ctx === contextName) scheduleSoon()
      }),
    )

    return () => {
      cancelled = true
      window.clearInterval(id)
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      unsubs.forEach((u) => u())
    }
  }, [contextName, apiNamespace, matches, multi])

  if (isAggregated) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Workloads overview is only available in single-context mode. Pick one context to see it.
      </div>
    )
  }

  if (!contextName) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a context to see the workloads overview.
      </div>
    )
  }

  const cards: WorkloadHealth[] = [
    {
      kind: 'Pods',
      view: 'pods',
      total: pods.length,
      healthy: pods.filter(isPodHealthy).length,
    },
    {
      kind: 'Deployments',
      view: 'deployments',
      total: deployments.length,
      healthy: deployments.filter((d) => isReadyString(d.ready)).length,
    },
    {
      kind: 'StatefulSets',
      view: 'statefulsets',
      total: statefulSets.length,
      healthy: statefulSets.filter((s) => isReadyString(s.ready)).length,
    },
    {
      kind: 'DaemonSets',
      view: 'daemonsets',
      total: daemonSets.length,
      healthy: daemonSets.filter((d) => d.desired > 0 && d.ready === d.desired).length,
    },
    {
      kind: 'ReplicaSets',
      view: 'replicasets',
      total: replicaSets.length,
      healthy: replicaSets.filter((r) => r.desired > 0 && r.ready === r.desired).length,
    },
    {
      kind: 'ReplicationControllers',
      view: 'replicationcontrollers',
      total: replicationControllers.length,
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
    },
  ]

  const filteredEvents = filterEvents(events, query)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-medium">Workloads Overview</h1>
          <span className="text-xs text-muted-foreground">
            {contextName}
            {' · '}
            {selectedNamespaces.length === 0
              ? 'all namespaces'
              : selectedNamespaces.length === 1
                ? selectedNamespaces[0]
                : `${selectedNamespaces.length} namespaces`}
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
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events…"
          className="h-7 w-64 rounded-md border border-input bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <EventsTable events={filteredEvents} />
    </div>
  )
}

function isPodHealthy(p: PodInfo): boolean {
  if (p.status === 'Succeeded') return true
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

type WorkloadCardProps = {
  kind: string
  total: number
  healthy: number
  onClick: () => void
}

function WorkloadCard({ kind, total, healthy, onClick }: WorkloadCardProps) {
  const unhealthy = Math.max(0, total - healthy)
  const healthyPct = total > 0 ? (healthy / total) * 100 : 0
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
              className="absolute inset-y-0 bg-destructive"
              style={{ left: `${healthyPct}%`, width: `${unhealthyPct}%` }}
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
  const [, force] = useState(0)
  useEffect(() => {
    if (at === null) return
    const id = window.setInterval(() => force((n) => n + 1), 5_000)
    return () => window.clearInterval(id)
  }, [at])
  if (at === null) {
    return <span className="text-xs text-muted-foreground">Loading…</span>
  }
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      Updated {formatAge(new Date(at).toISOString())} ago
    </span>
  )
}

function filterEvents(events: EventInfo[], query: string): EventInfo[] {
  const q = query.trim().toLowerCase()
  if (!q) return events
  return events.filter((e) =>
    [e.message, e.objectKind, e.objectName, e.reason, e.source, e.namespace, e.type]
      .some((v) => v && v.toLowerCase().includes(q)),
  )
}

function EventsTable({ events }: { events: EventInfo[] }) {
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
          {events.map((e, i) => (
            <tr
              key={`${e.namespace}/${e.name}/${i}`}
              className="border-b border-border/50 last:border-0 hover:bg-muted/40"
            >
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
