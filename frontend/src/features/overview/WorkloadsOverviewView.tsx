import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type EventInfo, type WorkloadHealth } from '@/lib/api'
import { Copyable } from '@/features/_shared/Copyable'
import { selectsTextWithin } from '@/features/_shared/textSelection'
import { onKubeChange } from '@/lib/events'
import { formatAge } from '@/lib/time'
import { useNowTick } from '@/lib/nowTick'
import { namespaceQuery } from '@/lib/namespaceFilter'
import { useActiveContexts, useIsAggregated, useUIStore, type ResourceView } from '@/store/ui'

const POLL_INTERVAL_MS = 30_000
const EVENTS_LIMIT = 200

const CARDS: { kind: string; label: string; view: ResourceView }[] = [
  { kind: 'Pod', label: 'Pods', view: 'pods' },
  { kind: 'Deployment', label: 'Deployments', view: 'deployments' },
  { kind: 'StatefulSet', label: 'StatefulSets', view: 'statefulsets' },
  { kind: 'DaemonSet', label: 'DaemonSets', view: 'daemonsets' },
  { kind: 'ReplicaSet', label: 'ReplicaSets', view: 'replicasets' },
  { kind: 'ReplicationController', label: 'ReplicationControllers', view: 'replicationcontrollers' },
  { kind: 'Job', label: 'Jobs', view: 'jobs' },
  { kind: 'CronJob', label: 'CronJobs', view: 'cronjobs' },
]

// Intentionally inactive members (suspended CronJobs) are the neutral segment,
// not red, so a deliberately disabled resource doesn't read as broken.
type WorkloadCounts = { total: number; healthy: number; neutral: number }

const NO_COUNTS: WorkloadCounts = { total: 0, healthy: 0, neutral: 0 }

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

  const [counts, setCounts] = useState<Record<string, WorkloadCounts>>({})
  const [events, setEvents] = useState<TaggedEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const debounceRef = useRef<number | null>(null)
  const epochRef = useRef(0)
  const countsInFlightRef = useRef(false)
  const countsDirtyRef = useRef(false)

  const filterByNs = useCallback(
    <T extends { namespace: string }>(list: T[]): T[] =>
      multi ? list.filter((r) => matches(r.namespace)) : list,
    [multi, matches],
  )

  // Workload counts are summed from the informer caches on the Go side, so they
  // refresh on every debounced kube:change burst. One request runs at a time: a
  // burst during a slow round trip marks the counts dirty and the request pulls
  // once more when it lands, so responses can't arrive out of order or pile up.
  // Events are a real apiserver List (there is no Events informer), so they're
  // pulled separately on the slow poll only — otherwise pod churn would hammer
  // the Events endpoint every ~300ms.
  const pullCounts = useCallback(() => {
    if (activeContexts.length === 0) return
    if (countsInFlightRef.current) {
      countsDirtyRef.current = true
      return
    }
    const epoch = epochRef.current
    const run = () => {
      countsInFlightRef.current = true
      countsDirtyRef.current = false
      const fetches = activeContexts.map((ctx) =>
        api
          .getWorkloadsOverview(ctx, apiNamespace)
          .then((health) => ({ health: health ?? [], err: null as string | null }))
          .catch((err: unknown) => ({ health: [] as WorkloadHealth[], err: String(err) })),
      )
      void Promise.all(fetches)
        .then((results) => {
          if (epoch !== epochRef.current) return
          setCounts(sumWorkloadHealth(results.map((r) => r.health)))
          setError(results.find((r) => r.err && !r.err.includes('no active watcher'))?.err ?? null)
          setLastUpdatedAt(Date.now())
        })
        .finally(() => {
          // After a context or namespace change the next setup owns the flags.
          if (epoch !== epochRef.current) return
          countsInFlightRef.current = false
          if (countsDirtyRef.current) run()
        })
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, apiNamespace])

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
      setCounts({})
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
      countsInFlightRef.current = false
      countsDirtyRef.current = false
      window.clearInterval(id)
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      unsubs.forEach((u) => u())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, pullCounts, pullEvents])

  const cards = useMemo(
    () => CARDS.map((c) => ({ ...c, ...(counts[c.kind] ?? NO_COUNTS) })),
    [counts],
  )

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
            kind={c.label}
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

function sumWorkloadHealth(perContext: WorkloadHealth[][]): Record<string, WorkloadCounts> {
  const sums: Record<string, WorkloadCounts> = {}
  for (const health of perContext) {
    for (const h of health) {
      const sum = (sums[h.kind] ??= { ...NO_COUNTS })
      sum.total += h.total
      sum.healthy += h.healthy
      sum.neutral += h.neutral
    }
  }
  return sums
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
        <tbody className="allow-select">
          {events.map((e, i) => {
            const clickable = Boolean(e.objectKind && e.objectName)
            return (
              <tr
                key={`${e.contextName}/${e.namespace}/${e.name}/${i}`}
                className={`border-b border-border/50 last:border-0 hover:bg-muted/40 ${clickable ? 'cursor-pointer' : ''}`}
                onClick={
                  clickable
                    ? (ev) => {
                        if (selectsTextWithin(ev.currentTarget)) return
                        setSelectedResource({
                          kind: e.objectKind,
                          namespace: e.namespace,
                          name: e.objectName,
                          context: e.contextName,
                        })
                      }
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
                <td className="px-3 py-2 align-top text-foreground"><Copyable value={e.message} /></td>
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
