import { createContext, useContext, useSyncExternalStore, type SetStateAction } from 'react'
import type { SelectedResource } from '@/store/ui'

// Holding an arrow key repeats it ~30 times a second, and every resource the
// inspector opens fetches its detail and may start a log stream. Rows follow
// a held arrow only once it pauses this long; Alt+Arrow moves at most once
// per interval.
export const HELD_KEY_SETTLE_MS = 150

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
