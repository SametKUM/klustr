import { useEffect } from 'react'
import { api } from '@/lib/api'
import { useMetrics } from '@/store/metrics'

const POLL_MS = 15_000

// Polls metrics.k8s.io node usage every 15s (it is List-only, so polled rather
// than watched), mirroring usePodMetricsPoll. Node usage is rendered against
// each node's allocatable from the informer-backed NodeInfo.
export function useNodeMetricsPoll(contexts: readonly string[]) {
  const setNodeMetrics = useMetrics((s) => s.setNodeMetrics)
  const setUnavailable = useMetrics((s) => s.setUnavailable)
  const ctxKey = contexts.join('|')

  useEffect(() => {
    if (contexts.length === 0) return
    let cancelled = false

    const tick = async (ctx: string) => {
      try {
        const list = await api.listNodeMetrics(ctx)
        if (cancelled) return
        if (list === null) setUnavailable(ctx)
        else setNodeMetrics(ctx, list)
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
      for (const id of intervalIds) window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctxKey is the stable dep; the setters are store-stable
  }, [ctxKey, setNodeMetrics, setUnavailable])
}
