import { useEffect, useState } from 'react'
import { deltaTouches, onKubeChange } from '@/lib/events'

export function useResourceDetail<T>(
  contextName: string | null,
  kind: string,
  namespace: string,
  name: string,
  load: (ctx: string) => Promise<T>,
) {
  const [detail, setDetail] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!contextName) {
      setDetail(null)
      setError(null)
      return
    }
    let cancelled = false
    const reload = () => {
      load(contextName)
        .then((d) => {
          if (cancelled) return
          setDetail(d)
          setError(null)
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setError(String(e))
          setDetail(null)
        })
    }
    reload()
    const unsub = onKubeChange(kind, (ctx, delta) => {
      if (ctx !== contextName) return
      // Skip bursts from other objects of the same kind — a busy cluster would
      // otherwise refetch the open detail on every debounced batch. Absent or
      // reset deltas can't be attributed and fall through to a reload.
      if (delta && !delta.reset && !deltaTouches(delta, namespace, name)) return
      reload()
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [contextName, kind, namespace, name, load])

  return { detail, error }
}
