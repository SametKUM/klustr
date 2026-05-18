import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import {
  api,
  type ClusterOverview,
  type ClusterPods,
  type ClusterResource,
  type EventInfo,
} from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { formatAge } from '@/lib/time'
import { useActiveContexts, useIsAggregated } from '@/store/ui'

const POLL_INTERVAL_MS = 15_000
const WARNING_LIMIT = 50

function isWatcherNotReady(err: unknown): boolean {
  return String(err).includes('no active watcher')
}

type ClusterState = {
  overview: ClusterOverview | null
  overviewError: string | null
  warnings: EventInfo[]
  warningsError: string | null
  lastUpdatedAt: number | null
}

const EMPTY_STATE: ClusterState = {
  overview: null,
  overviewError: null,
  warnings: [],
  warningsError: null,
  lastUpdatedAt: null,
}

export function OverviewView() {
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const [byContext, setByContext] = useState<Record<string, ClusterState>>({})
  const debounceRef = useRef<number | null>(null)
  const ctxKey = activeContexts.join('|')

  useEffect(() => {
    if (activeContexts.length === 0) {
      setByContext({})
      return
    }
    let cancelled = false
    const attempts = new Map<string, number>()
    const retryTimers = new Map<string, number>()

    const clearRetry = (ctx: string) => {
      const id = retryTimers.get(ctx)
      if (id !== undefined) {
        window.clearTimeout(id)
        retryTimers.delete(ctx)
      }
    }

    const updateContext = (ctx: string, patch: Partial<ClusterState>) => {
      setByContext((prev) => ({
        ...prev,
        [ctx]: { ...(prev[ctx] ?? EMPTY_STATE), ...patch },
      }))
    }

    const pullOne = (ctx: string) => {
      clearRetry(ctx)
      api
        .getClusterOverview(ctx)
        .then((v) => {
          if (cancelled) return
          updateContext(ctx, {
            overview: v,
            overviewError: null,
            lastUpdatedAt: Date.now(),
          })
          attempts.set(ctx, 0)
        })
        .catch((e) => {
          if (cancelled) return
          const n = attempts.get(ctx) ?? 0
          if (isWatcherNotReady(e) && n < 6) {
            const next = n + 1
            attempts.set(ctx, next)
            const delay = Math.min(250 * 2 ** next, 4000)
            retryTimers.set(ctx, window.setTimeout(() => pullOne(ctx), delay))
            return
          }
          updateContext(ctx, { overviewError: String(e) })
        })
      api
        .listClusterWarningEvents(ctx, WARNING_LIMIT)
        .then((v) => {
          if (cancelled) return
          updateContext(ctx, { warnings: v ?? [], warningsError: null })
        })
        .catch((e) => {
          if (cancelled) return
          updateContext(ctx, { warningsError: String(e) })
        })
    }

    const pullAll = () => {
      for (const ctx of activeContexts) {
        attempts.set(ctx, 0)
        pullOne(ctx)
      }
    }

    const scheduleSoon = () => {
      if (debounceRef.current !== null) return
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        pullAll()
      }, 300)
    }

    setByContext((prev) => {
      const keep: Record<string, ClusterState> = {}
      for (const ctx of activeContexts) {
        keep[ctx] = prev[ctx] ?? EMPTY_STATE
      }
      return keep
    })
    pullAll()
    const id = window.setInterval(pullAll, POLL_INTERVAL_MS)
    const unsubs = ['Node', 'Pod', 'Namespace'].map((kind) =>
      onKubeChange(kind, (ctx) => {
        if (activeContexts.includes(ctx)) scheduleSoon()
      }),
    )

    return () => {
      cancelled = true
      for (const id of retryTimers.values()) window.clearTimeout(id)
      retryTimers.clear()
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      window.clearInterval(id)
      unsubs.forEach((u) => u())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey])

  if (activeContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a context to see the cluster overview.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {activeContexts.map((ctx, idx) => (
        <ClusterSection
          key={ctx}
          contextName={ctx}
          isAggregated={isAggregated}
          state={byContext[ctx] ?? EMPTY_STATE}
          isFirst={idx === 0}
        />
      ))}
    </div>
  )
}

function ClusterSection({
  contextName,
  isAggregated,
  state,
  isFirst,
}: {
  contextName: string
  isAggregated: boolean
  state: ClusterState
  isFirst: boolean
}) {
  const { overview, overviewError, warnings, warningsError, lastUpdatedAt } = state
  return (
    <div className={isFirst ? '' : 'border-t border-border'}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-medium">
            {isAggregated ? contextName : 'Cluster Overview'}
          </h1>
          <span className="text-xs text-muted-foreground">
            {!isAggregated && (
              <>
                {contextName}
                {overview && ' · '}
              </>
            )}
            {overview && (
              <>
                {overview.nodeCount} node{overview.nodeCount === 1 ? '' : 's'}
                {' · '}
                {overview.namespaceCount} namespace{overview.namespaceCount === 1 ? '' : 's'}
              </>
            )}
          </span>
        </div>
        <UpdatedAgo at={lastUpdatedAt} />
      </div>

      {overview && !overview.metricsAvailable && (
        <MetricsBanner error={overview.metricsError ?? ''} />
      )}
      {overviewError && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-xs text-destructive">
          {overviewError}
        </div>
      )}

      <div className="grid gap-4 px-6 py-4 sm:grid-cols-1 lg:grid-cols-3">
        <ResourceCard
          title="CPU"
          metric={overview?.cpu ?? null}
          format={formatCores}
          unit="cores"
        />
        <ResourceCard
          title="Memory"
          metric={overview?.memory ?? null}
          format={formatBytes}
          unit=""
        />
        <PodsCard pods={overview?.pods ?? null} />
      </div>

      <WarningsSection warnings={warnings} error={warningsError} />
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

function MetricsBanner({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-xs text-amber-700 dark:text-amber-300">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <div>
        <div className="font-medium">metrics-server not detected</div>
        <div className="opacity-80">
          Usage values require a working metrics.k8s.io API. Install metrics-server in the
          cluster to populate CPU and memory usage. Requests, limits, allocatable, and capacity
          values are still shown.
          {error && (
            <span className="ml-2 opacity-60">
              ({error})
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

type ResourceCardProps = {
  title: string
  metric: ClusterResource | null
  format: (n: number) => string
  unit: string
}

function ResourceCard({ title, metric, format, unit }: ResourceCardProps) {
  const usage = metric?.usage ?? -1
  const allocatable = metric?.allocatable ?? 0
  const usagePct = usage >= 0 && allocatable > 0 ? Math.min(100, (usage / allocatable) * 100) : 0
  const hasUsage = usage >= 0

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
        {unit && <span className="ml-1 normal-case opacity-60">({unit})</span>}
      </div>
      <div className="flex items-start gap-4">
        <Donut percentage={usagePct} dimmed={!hasUsage} />
        <div className="flex flex-1 flex-col gap-1.5 text-xs">
          <Row
            color="bg-emerald-500"
            label="Usage"
            value={hasUsage ? format(usage) : '—'}
          />
          <Row color="bg-sky-500" label="Requests" value={format(metric?.requests ?? 0)} />
          <Row color="bg-indigo-500" label="Limits" value={format(metric?.limits ?? 0)} />
          <Row color="bg-muted-foreground/50" label="Allocatable" value={format(allocatable)} />
          <Row color="bg-muted-foreground/30" label="Capacity" value={format(metric?.capacity ?? 0)} />
        </div>
      </div>
    </div>
  )
}

function PodsCard({ pods }: { pods: ClusterPods | null }) {
  const usage = pods?.usage ?? 0
  const allocatable = pods?.allocatable ?? 0
  const usagePct = allocatable > 0 ? Math.min(100, (usage / allocatable) * 100) : 0

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Pods
      </div>
      <div className="flex items-start gap-4">
        <Donut percentage={usagePct} />
        <div className="flex flex-1 flex-col gap-1.5 text-xs">
          <Row color="bg-emerald-500" label="Usage" value={String(usage)} />
          <Row
            color="bg-muted-foreground/50"
            label="Allocatable"
            value={String(allocatable)}
          />
          <Row
            color="bg-muted-foreground/30"
            label="Capacity"
            value={String(pods?.capacity ?? 0)}
          />
        </div>
      </div>
    </div>
  )
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 tabular-nums">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className={`size-2 shrink-0 rounded-full ${color}`} aria-hidden />
        {label}
      </span>
      <span className="font-mono text-[11px] text-foreground">{value}</span>
    </div>
  )
}

function Donut({ percentage, dimmed = false }: { percentage: number; dimmed?: boolean }) {
  const size = 96
  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percentage / 100)
  const color = usageColor(percentage)
  const labelColor = dimmed ? 'fill-muted-foreground' : 'fill-foreground'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-muted/60"
      />
      {!dimmed && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={`transition-all ${color}`}
        />
      )}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className={`text-[14px] font-semibold tabular-nums ${labelColor}`}
      >
        {dimmed ? '—' : `${Math.round(percentage)}%`}
      </text>
    </svg>
  )
}

function usageColor(pct: number): string {
  if (pct >= 85) return 'stroke-destructive'
  if (pct >= 60) return 'stroke-amber-500'
  return 'stroke-emerald-500'
}

function WarningsSection({ warnings, error }: { warnings: EventInfo[]; error: string | null }) {
  return (
    <div className="flex flex-col px-6 pb-6">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <AlertTriangle className="size-3.5 text-destructive" />
        <span className="font-medium">Warnings: {warnings.length}</span>
        {error && <span className="text-muted-foreground">({error})</span>}
      </div>
      {warnings.length === 0 && !error ? (
        <div className="rounded-lg border border-border bg-card px-3 py-4 text-center text-xs text-muted-foreground">
          No recent warning events.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Message</th>
                <th className="px-3 py-2 font-medium">Object</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Count</th>
                <th className="px-3 py-2 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((w, i) => (
                <tr
                  key={`${w.namespace}/${w.name}/${i}`}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-2 align-top text-foreground">{w.message}</td>
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground">
                    {w.objectKind}/{w.objectName}
                    {w.namespace && (
                      <span className="ml-1 opacity-60">· {w.namespace}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-muted-foreground">{w.reason}</td>
                  <td className="px-3 py-2 align-top text-muted-foreground">{w.count}</td>
                  <td className="px-3 py-2 align-top text-muted-foreground">
                    {formatAge(w.lastSeen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatCores(mc: number): string {
  if (mc <= 0) return '0'
  if (mc < 1000) return `${mc}m`
  const cores = mc / 1000
  return cores >= 10 ? cores.toFixed(0) : cores.toFixed(2)
}

function formatBytes(b: number): string {
  if (b <= 0) return '0'
  const kib = 1024
  const mib = kib * 1024
  const gib = mib * 1024
  if (b >= gib) return `${(b / gib).toFixed(1)}GiB`
  if (b >= mib) return `${(b / mib).toFixed(0)}MiB`
  if (b >= kib) return `${(b / kib).toFixed(0)}KiB`
  return `${b}B`
}
