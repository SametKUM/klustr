import { act, useCallback, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ColumnDef } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KubeDelta } from '@/lib/events'
import type { ByContext } from '@/store/resources'
import type { ContextHealth } from '@/store/ui.types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({
  contexts: ['cluster-a', 'cluster-b'],
  namespaces: [] as string[],
  contextHealth: {} as Record<string, ContextHealth>,
  onKubeChange: vi.fn(),
  setData: vi.fn(),
  applyDelta: vi.fn(),
}))

vi.mock('@/lib/events', () => ({
  isKindSynced: () => true,
  onKubeChange: mocks.onKubeChange,
}))

vi.mock('@/store/ui', () => ({
  useActiveContexts: () => mocks.contexts,
  useIsAggregated: () => mocks.contexts.length > 1,
  useUIStore: (selector: (state: object) => unknown) => selector({
    selectedNamespaces: mocks.namespaces,
    selectedResource: null,
    lastSelectedResource: null,
    globalReadOnly: true,
    contextHealth: mocks.contextHealth,
  }),
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
      index, start: index * 33, end: (index + 1) * 33,
    })),
    getTotalSize: () => count * 33,
    measureElement: vi.fn(),
  }),
}))

vi.mock('@/lib/nowTick', () => ({ useNowTick: vi.fn() }))
vi.mock('./ColumnControls', () => ({ ColumnControls: () => null }))
vi.mock('./RowContextMenu', () => ({
  RowContextMenu: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./BulkActionDialogs', () => ({
  BulkDeleteDialog: () => null,
  BulkRestartDialog: () => null,
  BulkCordonDialog: () => null,
  BulkDrainDialog: () => null,
}))

import { ResourceTable } from './ResourceTable'

type Item = { name: string; namespace: string }
const columns: ColumnDef<Item>[] = [{ accessorKey: 'name', header: 'Name' }]

function Harness({ fetch, deltas = false }: {
  fetch: (context: string, namespace: string) => Promise<Item[]>
  deltas?: boolean
}) {
  const [data, setDataState] = useState<ByContext<Item>>({})
  const setData = useCallback((ctx: string, list: Item[]) => {
    mocks.setData(ctx, list)
    setDataState((prev) => ({ ...prev, [ctx]: list }))
  }, [])
  return (
    <ResourceTable
      kind="Pod"
      noun={{ singular: 'pod', plural: 'pods' }}
      scope="namespaced"
      data={data}
      setData={setData}
      fetch={fetch}
      columns={columns}
      applyDelta={deltas ? mocks.applyDelta : undefined}
    />
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('ResourceTable load failures', () => {
  let container: HTMLDivElement
  let root: Root
  let change: (ctx: string, delta?: KubeDelta) => void

  beforeEach(() => {
    mocks.contexts = ['cluster-a', 'cluster-b']
    mocks.namespaces = []
    mocks.contextHealth = {}
    mocks.setData.mockReset()
    mocks.applyDelta.mockReset()
    mocks.onKubeChange.mockReset().mockImplementation((_, handler) => {
      change = handler
      return vi.fn()
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  function retryButton(ctx: string) {
    const button = container.querySelector(`[aria-label="Retry loading pods from ${ctx}"]`)
    if (!(button instanceof HTMLButtonElement)) throw new Error('Retry button not found')
    return button
  }

  it('preserves cached rows and healthy contexts, then retries only the failed context', async () => {
    const load = vi.fn(async (ctx: string) => [{ name: `${ctx}-pod`, namespace: 'default' }])
    await act(async () => root.render(<Harness fetch={load} />))
    load.mockRejectedValueOnce(new Error('connection lost'))
    await act(async () => change('cluster-b'))

    expect(container.textContent).toContain('cluster-a-pod')
    expect(container.textContent).toContain('cluster-b-pod')
    expect(container.textContent).toContain('Results may be outdated or incomplete.')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('connection lost')
    expect(mocks.setData).not.toHaveBeenCalledWith('cluster-b', [])

    const retry = deferred<Item[]>()
    load.mockReturnValueOnce(retry.promise)
    await act(async () => retryButton('cluster-b').click())
    expect(retryButton('cluster-b').disabled).toBe(true)
    expect(container.textContent).toContain('Retrying…')
    expect(container.textContent).toContain('cluster-b-pod')
    await act(async () => {
      retryButton('cluster-b').click()
      retry.resolve([{ name: 'recovered-pod', namespace: 'default' }])
    })

    expect(load.mock.calls.map(([ctx]) => ctx)).toEqual(['cluster-a', 'cluster-b', 'cluster-b', 'cluster-b'])
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('cluster-a-pod')
    expect(container.textContent).toContain('recovered-pod')
    expect(container.textContent).not.toContain('cluster-b-pod')
  })

  it('warns about offline cached data even when list reads succeed, until connection recovery', async () => {
    const load = vi.fn(async (ctx: string) => [{ name: `${ctx}-pod`, namespace: 'default' }])
    await act(async () => root.render(<Harness fetch={load} />))
    const offline: ContextHealth = {
      status: 'error', latencyMs: -1, error: 'connection refused', version: 'v1.35.0',
      lastPingAt: Date.now(), failures: 2,
    }
    mocks.contextHealth = { 'cluster-b': { ...offline, status: 'slow', failures: 1 } }
    await act(async () => root.render(<Harness fetch={load} />))
    expect(container.querySelector('[aria-label="Cluster connection warnings"]')).toBeNull()
    expect(container.textContent).not.toContain('(possibly outdated)')
    mocks.contextHealth = { 'cluster-b': offline, 'inactive-cluster': offline }
    await act(async () => root.render(<Harness fetch={load} />))
    await act(async () => change('cluster-b'))

    const warning = () => container.querySelector('[aria-label="Cluster connection warnings"]')
    expect(warning()?.textContent).toContain('Offline: cluster-b')
    expect(warning()?.textContent).toContain('Showing cached data. Resource status may be outdated.')
    expect(warning()?.textContent).not.toContain('cluster-a')
    expect(warning()?.textContent).not.toContain('inactive-cluster')
    expect(container.textContent).toContain('cluster-a-pod')
    expect(container.textContent).toContain('cluster-b-pod')
    expect(container.textContent).toContain('(possibly outdated)')

    load.mockRejectedValueOnce(new Error('list unavailable'))
    await act(async () => change('cluster-b'))
    mocks.contextHealth = { 'cluster-b': { ...offline, status: 'ok', error: null, failures: 0 } }
    await act(async () => root.render(<Harness fetch={load} />))
    expect(warning()).toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('list unavailable')
    expect(container.textContent).not.toContain('(possibly outdated)')
  })

  it('warns about stale checks but does not mark a slow successful connection as offline', async () => {
    mocks.contexts = ['cluster-a']
    const load = vi.fn(async () => [{ name: 'cached-pod', namespace: 'default' }])
    const health: ContextHealth = {
      status: 'stale', latencyMs: 400, error: null, version: 'v1.35.0',
      lastPingAt: Date.now() - 90_000, failures: 0,
    }
    mocks.contextHealth = { 'cluster-a': health }
    await act(async () => root.render(<Harness fetch={load} />))
    expect(container.textContent).toContain('Connection status unknown: cluster-a')
    mocks.contextHealth = { 'cluster-a': { ...health, status: 'slow', lastPingAt: Date.now() } }
    await act(async () => root.render(<Harness fetch={load} />))
    expect(container.querySelector('[aria-label="Cluster connection warnings"]')).toBeNull()
  })

  it('does not present an empty offline cache as proof that no pods exist', async () => {
    mocks.contexts = ['cluster-a']
    mocks.contextHealth = { 'cluster-a': {
      status: 'error', latencyMs: -1, error: 'connection refused', version: null,
      lastPingAt: Date.now(), failures: 2,
    } }
    await act(async () => root.render(<Harness fetch={async () => []} />))
    expect(container.textContent).toContain('No cached pods for the current selection.')
    expect(container.textContent).not.toContain('No pods.')
  })

  it('distinguishes an initial failure from an empty list and keeps retry errors visible', async () => {
    mocks.contexts = ['cluster-a']
    const load = vi.fn<() => Promise<Item[]>>().mockRejectedValueOnce('forbidden')
    await act(async () => root.render(<Harness fetch={load} />))
    expect(container.textContent).toContain('Could not load a complete list of pods.')
    expect(container.textContent).not.toContain('No pods.')

    load.mockRejectedValueOnce('still forbidden')
    await act(async () => retryButton('cluster-a').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('still forbidden')
    expect(retryButton('cluster-a').disabled).toBe(false)

    load.mockResolvedValueOnce([])
    await act(async () => retryButton('cluster-a').click())
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('No pods.')
  })

  it('recovers with a full snapshot before accepting deltas after a failed fetch', async () => {
    mocks.contexts = ['cluster-a']
    const load = vi.fn<() => Promise<Item[]>>().mockRejectedValueOnce('unavailable')
    await act(async () => root.render(<Harness fetch={load} deltas />))
    load.mockResolvedValueOnce([{ name: 'snapshot-pod', namespace: 'default' }])
    const delta = { gen: 10, upserts: [{ name: 'delta-pod', namespace: 'default' }], removed: [] }
    await act(async () => change('cluster-a', delta))
    expect(load).toHaveBeenCalledTimes(2)
    expect(mocks.applyDelta).not.toHaveBeenCalled()
    expect(container.textContent).toContain('snapshot-pod')
    expect(container.querySelector('[role="alert"]')).toBeNull()

    await act(async () => change('cluster-a', { ...delta, gen: 11 }))
    expect(mocks.applyDelta).toHaveBeenCalledWith('cluster-a', delta.upserts, [])
  })

  it('clears only the recovered context error when several contexts fail', async () => {
    const load = vi.fn<() => Promise<Item[]>>().mockRejectedValue('unavailable')
    await act(async () => root.render(<Harness fetch={load} />))
    load.mockResolvedValueOnce([{ name: 'recovered-a', namespace: 'default' }])
    await act(async () => retryButton('cluster-a').click())

    expect(container.textContent).toContain('recovered-a')
    expect(container.querySelector('[aria-label="Retry loading pods from cluster-a"]')).toBeNull()
    expect(retryButton('cluster-b').disabled).toBe(false)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('cluster-b')
    expect(container.textContent).toContain('(incomplete)')
  })

  it('ignores failures from an old namespace and retries using the current namespace', async () => {
    mocks.contexts = ['cluster-a']
    mocks.namespaces = ['old']
    const old = deferred<Item[]>()
    const load = vi.fn<(ctx: string, namespace: string) => Promise<Item[]>>()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce([{ name: 'new-pod', namespace: 'new' }])
    await act(async () => root.render(<Harness fetch={load} />))
    mocks.namespaces = ['new']
    await act(async () => root.render(<Harness fetch={load} />))
    await act(async () => old.reject('old request failed'))
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('new-pod')

    load.mockRejectedValueOnce('current request failed')
    await act(async () => change('cluster-a'))
    load.mockResolvedValueOnce([])
    await act(async () => retryButton('cluster-a').click())
    expect(load).toHaveBeenLastCalledWith('cluster-a', 'new')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})
