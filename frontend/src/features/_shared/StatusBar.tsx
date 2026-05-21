import { useEffect, useState } from 'react'
import { Boxes, Folder, Network } from 'lucide-react'
import { useActiveContexts, useIsAggregated, useUIStore } from '@/store/ui'
import { usePortForwards } from '@/store/portForwards'
import { api } from '@/lib/api'

type Health = {
  status: 'pinging' | 'ok' | 'slow' | 'stale' | 'error'
  latencyMs: number
  error: string | null
  version: string | null
  lastPingAt: number
}

const PING_INTERVAL_MS = 25_000
const SLOW_THRESHOLD_MS = 300
const STALE_THRESHOLD_MS = 60_000

export function StatusBar() {
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const portForwards = usePortForwards((s) => s.list)
  const [healthByCtx, setHealthByCtx] = useState<Record<string, Health>>({})
  const [appVersion, setAppVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .version()
      .then((v) => {
        if (!cancelled) setAppVersion(v)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeContexts.length === 0) {
      setHealthByCtx({})
      return
    }
    let cancelled = false
    const intervals: number[] = []

    const ping = (ctx: string) => {
      const start = performance.now()
      setHealthByCtx((prev) => ({
        ...prev,
        [ctx]: prev[ctx]
          ? { ...prev[ctx], status: 'pinging' }
          : { status: 'pinging', latencyMs: -1, error: null, version: null, lastPingAt: 0 },
      }))
      api
        .pingContext(ctx)
        .then((v) => {
          if (cancelled) return
          const ms = Math.round(performance.now() - start)
          setHealthByCtx((prev) => ({
            ...prev,
            [ctx]: {
              status: ms > SLOW_THRESHOLD_MS ? 'slow' : 'ok',
              latencyMs: ms,
              error: null,
              version: v.gitVersion,
              lastPingAt: Date.now(),
            },
          }))
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setHealthByCtx((prev) => ({
            ...prev,
            [ctx]: {
              status: 'error',
              latencyMs: -1,
              error: String(e),
              version: prev[ctx]?.version ?? null,
              lastPingAt: Date.now(),
            },
          }))
        })
    }

    for (const ctx of activeContexts) {
      ping(ctx)
      intervals.push(window.setInterval(() => ping(ctx), PING_INTERVAL_MS))
    }

    // Mark stale health for contexts whose last ping was too old.
    const staleChecker = window.setInterval(() => {
      setHealthByCtx((prev) => {
        let changed = false
        const next = { ...prev }
        const now = Date.now()
        for (const [ctx, h] of Object.entries(prev)) {
          if (!activeContexts.includes(ctx)) continue
          if (h.status === 'ok' || h.status === 'slow') {
            if (now - h.lastPingAt > STALE_THRESHOLD_MS) {
              next[ctx] = { ...h, status: 'stale' }
              changed = true
            }
          }
        }
        return changed ? next : prev
      })
    }, 10_000)

    return () => {
      cancelled = true
      for (const id of intervals) window.clearInterval(id)
      window.clearInterval(staleChecker)
    }
  }, [activeContexts])

  const namespaceText =
    selectedNamespaces.length === 0
      ? 'all namespaces'
      : selectedNamespaces.length === 1
        ? selectedNamespaces[0]
        : `${selectedNamespaces.length} namespaces`

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-background px-3 text-[10px] text-muted-foreground">
      {activeContexts.length === 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-label="No context"
            className="inline-block size-2 rounded-full bg-muted-foreground/40"
          />
          <Boxes className="size-3" />
          no context
        </span>
      ) : (
        activeContexts.map((ctx, i) => {
          const h = healthByCtx[ctx]
          const status = h?.status ?? 'pinging'
          const dotClass =
            status === 'ok'
              ? 'bg-emerald-500'
              : status === 'slow' || status === 'stale'
                ? 'bg-amber-500'
                : status === 'error'
                  ? 'bg-destructive'
                  : 'bg-muted-foreground/40 animate-pulse'
          const tooltip = h?.error
            ? `${ctx}: ${h.error}`
            : h?.version
              ? status === 'stale'
                ? `${ctx}: stale (last ${h.version}, ${h.latencyMs}ms)`
                : `${ctx}: ${h.version} · ${h.latencyMs}ms`
              : `${ctx}: pinging…`
          return (
            <span key={ctx} className="inline-flex items-center gap-1.5" title={tooltip}>
              <span
                aria-label={`${ctx} ${status}`}
                className={['inline-block size-2 rounded-full', dotClass].join(' ')}
              />
              {i === 0 && <Boxes className="size-3" />}
              <span className="font-medium">{ctx}</span>
              {h && h.latencyMs >= 0 && status !== 'error' && (
                <span className="font-mono text-muted-foreground/70">{h.latencyMs}ms</span>
              )}
              {status === 'error' && (
                <span className="font-mono text-destructive">offline</span>
              )}
            </span>
          )
        })
      )}
      {activeContexts.length > 0 && (
        <span
          className="inline-flex items-center gap-1.5"
          title={selectedNamespaces.length > 1 ? selectedNamespaces.join(', ') : undefined}
        >
          <Folder className="size-3" />
          {namespaceText}
        </span>
      )}
      {!isAggregated && activeContexts.length === 1 && healthByCtx[activeContexts[0]]?.version && (
        <span className="font-mono">Kubernetes {healthByCtx[activeContexts[0]].version}</span>
      )}
      {portForwards.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <Network className="size-3" />
          {portForwards.length} forward{portForwards.length === 1 ? '' : 's'}
        </span>
      )}
      <span
        className="ml-auto cursor-help font-mono text-muted-foreground/80 hover:text-foreground"
        title="Press ? to view keyboard shortcuts"
      >
        Press <kbd className="rounded border border-border bg-muted px-1 py-px text-[9px] text-foreground">?</kbd> for shortcuts
      </span>
      {appVersion && <span className="font-mono">Klustr {appVersion}</span>}
    </footer>
  )
}
