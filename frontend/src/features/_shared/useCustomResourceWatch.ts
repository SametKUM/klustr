import { useEffect, useState } from 'react'
import { api, type CRDInfo } from '@/lib/api'

type WatchState = {
  key: string
  error: string | null
  ready: boolean
}

const INITIAL_STATE: WatchState = { key: '', error: null, ready: false }

export function useCustomResourceWatch(
  contextName: string | null,
  crd: Pick<CRDInfo, 'group' | 'version' | 'resource'> | null,
): { error: string | null; ready: boolean } {
  const key = crd
    ? `${contextName}\u0000${crd.group}\u0000${crd.version}\u0000${crd.resource}`
    : ''
  const [state, setState] = useState<WatchState>(INITIAL_STATE)

  useEffect(() => {
    if (!contextName || !crd) return
    let cancelled = false
    api
      .ensureCustomResourceWatch(contextName, crd.group, crd.version, crd.resource)
      .then(() => {
        if (!cancelled) setState({ key, error: null, ready: true })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            key,
            error: error instanceof Error ? error.message : String(error),
            ready: false,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [contextName, crd, key])

  if (state.key !== key) return { error: null, ready: false }
  return { error: state.error, ready: state.ready }
}
