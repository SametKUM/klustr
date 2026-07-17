import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [loading, setLoading] = useState(false)
  const requestRef = useRef(0)

  // CR-backed detail bodies pass a bare kind (e.g. 'Challenge') but the CR
  // watcher only emits under the gvr key ('cr:<group>/<resource>'). The viewed
  // object's gvr is present on the selection for exactly those CR kinds (and
  // absent for built-ins), so subscribe under that key when it exists.
  const gvr = useUIStore((s) => s.selectedResource?.gvr)
  const changeKind = gvr ? `cr:${gvr.group}/${gvr.resource}` : kind

  const reload = useCallback(async () => {
    const request = ++requestRef.current
    if (!contextName) {
      setDetail(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const next = await load(contextName)
      if (request !== requestRef.current) return
      setDetail(next)
      setError(null)
    } catch (e: unknown) {
      if (request !== requestRef.current) return
      setError(String(e))
      setDetail(null)
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [contextName, load])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial detail loading belongs to this remote subscription lifecycle.
    void reload()
    if (!contextName) return
    const unsub = onKubeChange(changeKind, (ctx, delta) => {
      if (ctx !== contextName) return
      // Skip bursts from other objects of the same kind — a busy cluster would
      // otherwise refetch the open detail on every debounced batch. Absent or
      // reset deltas can't be attributed and fall through to a reload.
      if (delta && !delta.reset && !deltaTouches(delta, namespace, name)) return
      void reload()
    })
    return () => {
      requestRef.current += 1
      unsub()
    }
  }, [contextName, changeKind, namespace, name, reload])

  return { detail, error, loading, reload }
}
