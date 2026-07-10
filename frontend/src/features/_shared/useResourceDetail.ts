import { useEffect, useState } from 'react'
import { deltaTouches, onKubeChange } from '@/lib/events'
import { useUIStore } from '@/store/ui'

export function useResourceDetail<T>(
  contextName: string | null,
  kind: string,
  namespace: string,
  name: string,
  load: (ctx: string) => Promise<T>,
) {
  const [detail, setDetail] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  // CR-backed detail bodies pass a bare kind (e.g. 'Challenge') but the CR
  // watcher only emits under the gvr key ('cr:<group>/<resource>'). The viewed
  // object's gvr is present on the selection for exactly those CR kinds (and
  // absent for built-ins), so subscribe under that key when it exists.
  const gvr = useUIStore((s) => s.selectedResource?.gvr)
  const changeKind = gvr ? `cr:${gvr.group}/${gvr.resource}` : kind

  useEffect(() => {
    if (!contextName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Connection loss invalidates the remote detail snapshot.
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
    const unsub = onKubeChange(changeKind, (ctx, delta) => {
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
  }, [contextName, changeKind, namespace, name, load])

  return { detail, error }
}
