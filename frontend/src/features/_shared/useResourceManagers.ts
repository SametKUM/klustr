import { createContext, useContext, useEffect, useState } from 'react'
import { api, type ResourceManager } from '@/lib/api'
import { deltaTouches, onKubeChange, type KubeDelta } from '@/lib/events'
import { findCRD, useCRDStore } from '@/store/crds'
import type { SelectedResource } from '@/store/ui'

const NO_MANAGERS: ResourceManager[] = []

// Changes are folded into at most one lookup per interval: a rollout updates
// its Deployment several times a second, and each lookup can reach other
// clusters.
export const MANAGERS_RELOAD_DELAY_MS = 1000

// The detail panel loads a resource's owners once and shares them with the
// header chips, the YAML tab and the action dialogs through this context.
export const ResourceManagersContext = createContext<ResourceManager[]>(NO_MANAGERS)

export function useManagers(): ResourceManager[] {
  return useContext(ResourceManagersContext)
}

// managersKind is the kind GetResourceManagers resolves: built-ins and Flux
// aliases by name, other CRs by group and resource. It is also the kind the
// resource's change events arrive under.
function managersKind(resource: SelectedResource): string {
  return resource.gvr ? `cr:${resource.gvr.group}/${resource.gvr.resource}` : resource.kind
}

type OwnerRef = Pick<ResourceManager, 'context' | 'group' | 'resource' | 'namespace' | 'name'>

// ownerRefs serializes the owner CRs to follow, so effects depend on their
// identity rather than on a managers array that is new after every lookup.
function ownerRefs(managers: ResourceManager[]): string {
  return JSON.stringify(
    managers
      .filter((m) => m.group && m.context && m.resolved)
      .map(({ context, group, resource, namespace, name }): OwnerRef => ({ context, group, resource, namespace, name })),
  )
}

// Absent or reset deltas cannot be attributed and count as a change.
function touches(delta: KubeDelta | undefined, namespace: string, name: string): boolean {
  return !delta || !!delta.reset || deltaTouches(delta, namespace, name)
}

// useResourceManagers loads the owners of the open resource and reloads them
// when the resource or one of its owner CRs changes, so a self-heal, suspend
// or ignore rule toggled elsewhere reaches the warnings. A Helm release is
// itself the owner, and a failed lookup leaves the list empty: the chips and
// warnings are hints, not something to block the panel on.
export function useResourceManagers(
  contextName: string | null,
  resource: SelectedResource | null,
): ResourceManager[] {
  const kind = resource && resource.kind !== 'HelmRelease' ? managersKind(resource) : null
  const namespace = resource?.namespace ?? ''
  const name = resource?.name ?? ''
  const identity = contextName && kind ? [contextName, kind, namespace, name].join('\u0000') : null
  // Owners whose CRD the context had not reported yet resolve once it does.
  const contextCRDs = useCRDStore((s) => (contextName ? s.byContext[contextName] : undefined))
  const crdsByContext = useCRDStore((s) => s.byContext)
  const [reloads, setReloads] = useState(0)
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
  }, [identity, contextName, kind, namespace, name, contextCRDs, reloads])

  const managers = state.identity === identity ? state.managers : NO_MANAGERS
  const owners = ownerRefs(managers)

  // An owner CR emits change events only while its watch runs; the chip
  // starts the same watch when clicked.
  useEffect(() => {
    for (const o of JSON.parse(owners) as OwnerRef[]) {
      const crd = findCRD(crdsByContext, o.context, o.group, o.resource)
      if (crd) api.ensureCustomResourceWatch(o.context, crd.group, crd.version, crd.resource).catch(() => {})
    }
  }, [owners, crdsByContext])

  useEffect(() => {
    if (!identity || !contextName || !kind) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (timer !== undefined) return
      timer = setTimeout(() => {
        timer = undefined
        setReloads((n) => n + 1)
      }, MANAGERS_RELOAD_DELAY_MS)
    }
    const unsubscribe = [
      onKubeChange(kind, (ctx, delta) => {
        if (ctx === contextName && touches(delta, namespace, name)) schedule()
      }),
      ...(JSON.parse(owners) as OwnerRef[]).map((o) =>
        onKubeChange(`cr:${o.group}/${o.resource}`, (ctx, delta) => {
          if (ctx === o.context && touches(delta, o.namespace, o.name)) schedule()
        }),
      ),
    ]
    return () => {
      clearTimeout(timer)
      unsubscribe.forEach((u) => u())
    }
  }, [identity, contextName, kind, namespace, name, owners])

  return managers
}
