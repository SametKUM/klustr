import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
type Handler = (contextName: string) => void
const handlers = vi.hoisted(() => new Map<string, Set<(contextName: string) => void>>())
vi.mock('@/lib/events', () => ({
  onKubeChange: (kind: string, handler: Handler) => {
    if (!handlers.has(kind)) handlers.set(kind, new Set())
    handlers.get(kind)!.add(handler)
    return () => handlers.get(kind)!.delete(handler)
  },
}))
const { ISTIO_RELATIONS_RELOAD_MS, useIstioRelationsReload } = await import('./useIstioRelationsReload')

function emit(kind: string, contextName: string) {
  handlers.get(kind)?.forEach((h) => h(contextName))
}

function Probe({ contextName, reload }: { contextName: string | null; reload: () => void }) {
  useIstioRelationsReload(contextName, ['Service', 'Pod'], reload)
  return null
}

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.useFakeTimers()
  handlers.clear()
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
})

it('reloads once per window when a related kind changes in the same context', () => {
  const reload = vi.fn()
  act(() => root.render(<Probe contextName="dev" reload={reload} />))

  emit('Service', 'dev')
  emit('Pod', 'dev')
  emit('Pod', 'dev')
  expect(reload).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(ISTIO_RELATIONS_RELOAD_MS))
  expect(reload).toHaveBeenCalledTimes(1)

  emit('Pod', 'dev')
  act(() => vi.advanceTimersByTime(ISTIO_RELATIONS_RELOAD_MS))
  expect(reload).toHaveBeenCalledTimes(2)
})

it('ignores other contexts and unrelated kinds', () => {
  const reload = vi.fn()
  act(() => root.render(<Probe contextName="dev" reload={reload} />))

  emit('Service', 'prod')
  emit('Node', 'dev')
  act(() => vi.advanceTimersByTime(ISTIO_RELATIONS_RELOAD_MS))
  expect(reload).not.toHaveBeenCalled()
})

it('keeps one subscription per kind across renders and drops it on unmount', () => {
  const reload = vi.fn()
  act(() => root.render(<Probe contextName="dev" reload={reload} />))
  act(() => root.render(<Probe contextName="dev" reload={vi.fn()} />))
  expect(handlers.get('Service')?.size).toBe(1)

  emit('Service', 'dev')
  act(() => root.unmount())
  act(() => vi.advanceTimersByTime(ISTIO_RELATIONS_RELOAD_MS))
  expect(reload).not.toHaveBeenCalled()
  expect(handlers.get('Service')?.size).toBe(0)
  root = createRoot(container)
})
