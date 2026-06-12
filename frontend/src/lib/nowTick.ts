import { useSyncExternalStore } from 'react'

// Shared 10s heartbeat for relative-time cells (Age columns). Subscribing at
// the row level keeps periodic refresh working after rows are memoized,
// without a parent-level tick re-rendering the entire table.
const TICK_MS = 10_000

const listeners = new Set<() => void>()
let now = Date.now()
let timer: number | undefined

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  if (timer === undefined) {
    timer = window.setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
  }
}

export function useNowTick(): number {
  return useSyncExternalStore(subscribe, () => now)
}
