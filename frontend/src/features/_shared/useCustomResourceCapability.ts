import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { resolveCRDsByContext, useCRDStore } from '@/store/crds'
import { useActiveContexts } from '@/store/ui'
import { ensureCustomResourceWatches } from './customResourceModel'

type WatchState = {
  key: string
  pending: boolean
  readyContexts: string[]
  errors: Record<string, string>
}

const EMPTY_STATE: WatchState = {
  key: '',
  pending: false,
  readyContexts: [],
  errors: {},
}

export function useCustomResourceCapability(group: string, resource: string) {
  const activeContexts = useActiveContexts()
  const catalog = useCRDStore((state) => state.byContext)
  const crdsByContext = useMemo(
    () => resolveCRDsByContext(catalog, activeContexts, group, resource),
    [activeContexts, catalog, group, resource],
  )
  const supportedContexts = useMemo(() => Object.keys(crdsByContext), [crdsByContext])
  const key = supportedContexts
    .map((contextName) => {
      const crd = crdsByContext[contextName]
      return `${contextName}\u0000${crd.group}\u0000${crd.version}\u0000${crd.resource}`
    })
    .join('\u0001')
  const [state, setState] = useState<WatchState>(EMPTY_STATE)

  useEffect(() => {
    if (supportedContexts.length === 0) return
    let cancelled = false
    ensureCustomResourceWatches(crdsByContext, (contextName, crd) =>
      api.ensureCustomResourceWatch(contextName, crd.group, crd.version, crd.resource),
    ).then((result) => {
      if (cancelled) return
      setState({ key, pending: false, ...result })
    })
    return () => {
      cancelled = true
    }
  }, [crdsByContext, key, supportedContexts])

  const current =
    state.key === key ? state : { ...EMPTY_STATE, key, pending: supportedContexts.length > 0 }
  return {
    activeContexts,
    crdsByContext,
    supportedContexts,
    primaryCRD: crdsByContext[supportedContexts[0]] ?? null,
    pending: current.pending,
    readyContexts: current.readyContexts,
    errors: current.errors,
  }
}
