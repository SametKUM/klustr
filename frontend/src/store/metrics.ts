import { create } from 'zustand'
import type { NodeMetrics, PodMetrics } from '@/lib/api'

export type MetricsByPod = Record<string, PodMetrics>
export type MetricsByNode = Record<string, NodeMetrics>

type MetricsState = {
  available: Record<string, boolean>
  byPodByContext: Record<string, MetricsByPod>
  byNodeByContext: Record<string, MetricsByNode>
  setPodMetrics: (ctx: string, list: PodMetrics[]) => void
  setNodeMetrics: (ctx: string, list: NodeMetrics[]) => void
  setUnavailable: (ctx: string) => void
  clearContext: (ctx: string) => void
  reset: () => void
}

export function podKey(namespace: string, name: string): string {
  return namespace + '/' + name
}

export const useMetrics = create<MetricsState>((set) => ({
  available: {},
  byPodByContext: {},
  byNodeByContext: {},
  setNodeMetrics: (ctx, list) =>
    set((s) => {
      const prev = s.byNodeByContext[ctx]
      const byNode: MetricsByNode = {}
      let changed = !prev || Object.keys(prev).length !== list.length
      for (const m of list) {
        const p = prev?.[m.name]
        if (p && p.cpuMC === m.cpuMC && p.memB === m.memB) {
          byNode[m.name] = p
        } else {
          byNode[m.name] = m
          changed = true
        }
      }
      return {
        // metrics-server availability is shared with pods; only flip it true
        // here (a node poll returning empty shouldn't claim metrics are down
        // while pods still report).
        available: list.length > 0 ? { ...s.available, [ctx]: true } : s.available,
        byNodeByContext: changed ? { ...s.byNodeByContext, [ctx]: byNode } : s.byNodeByContext,
      }
    }),
  setPodMetrics: (ctx, list) =>
    set((s) => {
      if (list.length === 0) {
        return {
          available: { ...s.available, [ctx]: false },
          byPodByContext: { ...s.byPodByContext, [ctx]: {} },
        }
      }
      // Unchanged readings keep their previous object (and, when the whole poll
      // is unchanged, the previous map), so per-cell store subscriptions bail
      // out instead of re-rendering every usage cell each poll.
      const prev = s.byPodByContext[ctx]
      const byPod: MetricsByPod = {}
      let changed = !prev || Object.keys(prev).length !== list.length
      for (const m of list) {
        const k = podKey(m.namespace, m.name)
        const p = prev?.[k]
        if (p && p.cpuMC === m.cpuMC && p.memB === m.memB) {
          byPod[k] = p
        } else {
          byPod[k] = m
          changed = true
        }
      }
      return {
        available: { ...s.available, [ctx]: true },
        byPodByContext: changed ? { ...s.byPodByContext, [ctx]: byPod } : s.byPodByContext,
      }
    }),
  setUnavailable: (ctx) =>
    set((s) => ({
      available: { ...s.available, [ctx]: false },
      byPodByContext: { ...s.byPodByContext, [ctx]: {} },
    })),
  clearContext: (ctx) =>
    set((s) => {
      const nextAvail = { ...s.available }
      delete nextAvail[ctx]
      const nextBy = { ...s.byPodByContext }
      delete nextBy[ctx]
      const nextByNode = { ...s.byNodeByContext }
      delete nextByNode[ctx]
      return { available: nextAvail, byPodByContext: nextBy, byNodeByContext: nextByNode }
    }),
  reset: () => set({ available: {}, byPodByContext: {}, byNodeByContext: {} }),
}))

export function selectNodeMetric(ctx: string | null | undefined, name: string) {
  return (s: MetricsState): NodeMetrics | undefined => {
    if (!ctx) return undefined
    return s.byNodeByContext[ctx]?.[name]
  }
}

export function selectPodMetric(ctx: string | null | undefined, namespace: string, name: string) {
  return (s: MetricsState): PodMetrics | undefined => {
    if (!ctx) return undefined
    return s.byPodByContext[ctx]?.[podKey(namespace, name)]
  }
}

export function selectMetricsAvailable(contexts: readonly string[]) {
  return (s: MetricsState): boolean => {
    if (contexts.length === 0) return false
    for (const c of contexts) {
      if (s.available[c]) return true
    }
    return false
  }
}
