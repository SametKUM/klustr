import { useEffect, useRef } from 'react'
import { onKubeChange } from '@/lib/events'

// A busy cluster reports Pod changes on every debounce tick, and each reload
// is a backend round trip, so changes within this window share one reload.
export const ISTIO_RELATIONS_RELOAD_MS = 1000

// useIstioRelationsReload reloads a detail whose links come from other kinds'
// caches (the Services a host resolves to, the pods a selector picks) when
// those kinds change in the same context; useResourceDetail only follows the
// viewed object. The backend touches a kind once its cache syncs, so a detail
// opened before Services were watched corrects itself.
export function useIstioRelationsReload(contextName: string | null, kinds: readonly string[], reload: () => unknown) {
  const reloadRef = useRef(reload)
  useEffect(() => {
    reloadRef.current = reload
  }, [reload])

  // A joined key keeps callers' inline arrays from resubscribing every render.
  const kindsKey = kinds.join(',')
  useEffect(() => {
    if (!contextName || !kindsKey) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const onChange = (ctx: string) => {
      if (ctx !== contextName || timer) return
      timer = setTimeout(() => {
        timer = null
        void reloadRef.current()
      }, ISTIO_RELATIONS_RELOAD_MS)
    }
    const unsubs = kindsKey.split(',').map((kind) => onKubeChange(kind, onChange))
    return () => {
      if (timer) clearTimeout(timer)
      unsubs.forEach((unsub) => unsub())
    }
  }, [contextName, kindsKey])
}
