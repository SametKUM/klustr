import { createContext, useContext, useEffect, useState } from 'react'
import { api, type ResourceManager } from '@/lib/api'
import type { SelectedResource } from '@/store/ui'

const NO_MANAGERS: ResourceManager[] = []

// The detail panel loads a resource's owners once and shares them with the
// header chips, the YAML tab and the action dialogs through this context.
export const ResourceManagersContext = createContext<ResourceManager[]>(NO_MANAGERS)

export function useManagers(): ResourceManager[] {
  return useContext(ResourceManagersContext)
}

// managersKind is the kind GetResourceManagers resolves: built-ins and Flux
// aliases by name, other CRs by group and resource.
function managersKind(resource: SelectedResource): string {
  return resource.gvr ? `cr:${resource.gvr.group}/${resource.gvr.resource}` : resource.kind
}

// useResourceManagers loads the owners of the open resource. A Helm release
// is itself the owner, and a failed lookup leaves the list empty: the chips
// and warnings are hints, not something to block the panel on.
export function useResourceManagers(
  contextName: string | null,
  resource: SelectedResource | null,
): ResourceManager[] {
  const kind = resource && resource.kind !== 'HelmRelease' ? managersKind(resource) : null
  const namespace = resource?.namespace ?? ''
  const name = resource?.name ?? ''
  const identity = contextName && kind ? [contextName, kind, namespace, name].join('\u0000') : null
  const [state, setState] = useState<{ identity: string | null; managers: ResourceManager[] }>({
    identity: null,
    managers: NO_MANAGERS,
  })

  useEffect(() => {
    if (!identity || !contextName || !kind) return
    let cancelled = false
    api
      .getResourceManagers(contextName, kind, namespace, name)
      .then((managers) => {
        if (!cancelled) setState({ identity, managers: managers ?? NO_MANAGERS })
      })
      .catch(() => {
        if (!cancelled) setState({ identity, managers: NO_MANAGERS })
      })
    return () => {
      cancelled = true
    }
  }, [identity, contextName, kind, namespace, name])

  return state.identity === identity ? state.managers : NO_MANAGERS
}
