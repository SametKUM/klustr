import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkloadHealth } from '@/lib/api'

const mocks = vi.hoisted(() => ({
  contexts: { current: ['ctx-a'] as string[] },
  handlers: new Map<string, (ctx: string) => void>(),
  getWorkloadsOverview: vi.fn<(ctx: string, namespace: string) => Promise<WorkloadHealth[]>>(),
  // Stable like the real store's state: a fresh selectedNamespaces array per
  // render would re-run the view's effects on every render.
  uiState: { selectedNamespaces: [], setSelectedView: () => {}, setSelectedResource: () => {} },
}))

vi.mock('@/lib/api', () => ({
  api: {
    getWorkloadsOverview: mocks.getWorkloadsOverview,
    listEvents: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('@/lib/events', () => ({
  onKubeChange: (kind: string, handler: (ctx: string) => void) => {
    mocks.handlers.set(kind, handler)
    return () => mocks.handlers.delete(kind)
  },
}))

vi.mock('@/store/ui', () => ({
  useActiveContexts: () => mocks.contexts.current,
  useIsAggregated: () => mocks.contexts.current.length > 1,
  useUIStore: (selector: (state: unknown) => unknown) => selector(mocks.uiState),
}))

vi.mock('@/lib/nowTick', () => ({ useNowTick: () => 0 }))

import { WorkloadsOverviewView } from './WorkloadsOverviewView'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function pods(total: number, healthy: number): WorkloadHealth[] {
  return [{ kind: 'Pod', total, healthy, neutral: 0 }]
}

describe('WorkloadsOverviewView', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.contexts.current = ['ctx-a']
    mocks.handlers.clear()
    mocks.getWorkloadsOverview.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it('sums the counts of every active context', async () => {
    mocks.contexts.current = ['ctx-a', 'ctx-b']
    mocks.getWorkloadsOverview.mockImplementation((ctx) =>
      Promise.resolve(
        ctx === 'ctx-a'
          ? [...pods(2, 1), { kind: 'CronJob', total: 1, healthy: 0, neutral: 1 }]
          : pods(3, 3),
      ),
    )

    await act(async () => root.render(<WorkloadsOverviewView />))

    expect(container.textContent).toContain('Pods (5)')
    expect(container.textContent).toContain('4/5')
    expect(container.textContent).toContain('CronJobs (1)')
    expect(container.textContent).toContain('Deployments (0)')
  })

  it('keeps one count request in flight and pulls once more after a change burst', async () => {
    vi.useFakeTimers()
    const first = deferred<WorkloadHealth[]>()
    const second = deferred<WorkloadHealth[]>()
    mocks.getWorkloadsOverview.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    await act(async () => root.render(<WorkloadsOverviewView />))
    expect(mocks.getWorkloadsOverview).toHaveBeenCalledTimes(1)

    for (let i = 0; i < 3; i++) {
      act(() => mocks.handlers.get('Pod')?.('ctx-a'))
      await act(async () => {
        vi.advanceTimersByTime(300)
      })
    }
    expect(mocks.getWorkloadsOverview).toHaveBeenCalledTimes(1)

    await act(async () => first.resolve(pods(1, 0)))
    expect(mocks.getWorkloadsOverview).toHaveBeenCalledTimes(2)

    await act(async () => second.resolve(pods(2, 2)))
    expect(container.textContent).toContain('Pods (2)')
    expect(mocks.getWorkloadsOverview).toHaveBeenCalledTimes(2)
  })

  it('drops a response that lands after the context changed', async () => {
    const stale = deferred<WorkloadHealth[]>()
    const fresh = deferred<WorkloadHealth[]>()
    mocks.getWorkloadsOverview.mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise)

    await act(async () => root.render(<WorkloadsOverviewView />))
    mocks.contexts.current = ['ctx-b']
    await act(async () => root.render(<WorkloadsOverviewView />))
    expect(mocks.getWorkloadsOverview).toHaveBeenLastCalledWith('ctx-b', '')

    await act(async () => fresh.resolve(pods(4, 4)))
    await act(async () => stale.resolve(pods(9, 0)))

    expect(container.textContent).toContain('Pods (4)')
    expect(mocks.getWorkloadsOverview).toHaveBeenCalledTimes(2)
  })
})
