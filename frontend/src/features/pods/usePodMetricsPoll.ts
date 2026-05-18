import { useEffect } from 'react'
import { api } from '@/lib/api'
import { useMetrics } from '@/store/metrics'

const POLL_MS = 15_000

export function usePodMetricsPoll(contexts: readonly string[], namespace: string) {
  const setPodMetrics = useMetrics((s) => s.setPodMetrics)
  const setUnavailable = useMetrics((s) => s.setUnavailable)
  const clearContext = useMetrics((s) => s.clearContext)
  const ctxKey = contexts.join('|')

  useEffect(() => {
    if (contexts.length === 0) return
    let cancelled = false

    const tick = async (ctx: string) => {
      try {
        const list = await api.listPodMetrics(ctx, namespace)
        if (cancelled) return
        setPodMetrics(ctx, list)
      } catch {
        if (cancelled) return
        setUnavailable(ctx)
      }
    }

    const intervalIds: number[] = []
    for (const ctx of contexts) {
      tick(ctx)
      const id = window.setInterval(() => tick(ctx), POLL_MS)
      intervalIds.push(id)
    }
    return () => {
      cancelled = true
      for (const ctx of contexts) clearContext(ctx)
      for (const id of intervalIds) window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, namespace, setPodMetrics, setUnavailable, clearContext])
}
