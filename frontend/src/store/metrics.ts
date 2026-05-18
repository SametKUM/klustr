import { create } from 'zustand'
import type { PodMetrics } from '@/lib/api'

export type MetricsByPod = Record<string, PodMetrics>

type MetricsState = {
  available: Record<string, boolean>
  byPodByContext: Record<string, MetricsByPod>
  setPodMetrics: (ctx: string, list: PodMetrics[]) => void
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
  setPodMetrics: (ctx, list) =>
    set((s) => {
      if (list.length === 0) {
        return {
          available: { ...s.available, [ctx]: false },
          byPodByContext: { ...s.byPodByContext, [ctx]: {} },
        }
      }
      const byPod: MetricsByPod = {}
      for (const m of list) byPod[podKey(m.namespace, m.name)] = m
      return {
        available: { ...s.available, [ctx]: true },
        byPodByContext: { ...s.byPodByContext, [ctx]: byPod },
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
      return { available: nextAvail, byPodByContext: nextBy }
    }),
  reset: () => set({ available: {}, byPodByContext: {} }),
}))

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
