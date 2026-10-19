import { createContext, useContext, useSyncExternalStore, type SetStateAction } from 'react'
import type { SelectedResource } from '@/store/ui'

export type ResourceNavigation = {
  resource: SelectedResource
  index: number
  total: number
  previous: (() => void) | null
  next: (() => void) | null
}

// The list rebuilds this on every informer update. Holding it in React state
// at the workspace would re-render the whole inspector each time, so it lives
// in a small workspace-local store: only the navigator subscribes, and the
// keyboard handler reads it when a key is pressed.
export type ResourceNavigationStore = {
  get: () => ResourceNavigation | null
  set: (next: SetStateAction<ResourceNavigation | null>) => void
  subscribe: (listener: () => void) => () => void
}

export function createResourceNavigationStore(): ResourceNavigationStore {
  let current: ResourceNavigation | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (next) => {
      const value = typeof next === 'function' ? next(current) : next
      if (value === current) return
      current = value
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const ResourceNavigationContext = createContext<ResourceNavigationStore | null>(null)

const noSubscription = () => () => {}

export function useResourceNavigation(): ResourceNavigation | null {
  const store = useContext(ResourceNavigationContext)
  return useSyncExternalStore(store?.subscribe ?? noSubscription, () => store?.get() ?? null)
}
