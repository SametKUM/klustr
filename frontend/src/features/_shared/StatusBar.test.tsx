import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
  return { ping: vi.fn() }
})

vi.mock('@/lib/api', () => ({
  api: {
    pingContext: mocks.ping,
    version: async () => 'dev',
    checkForUpdate: async () => null,
  },
}))
vi.mock('@/lib/wails/wailsjs/runtime/runtime', () => ({ BrowserOpenURL: vi.fn() }))

import { useUIStore } from '@/store/ui'
import { StatusBar } from './StatusBar'

describe('StatusBar shared connection health', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    mocks.ping.mockReset()
    useUIStore.setState({ selectedContext: 'cluster-a', aggregatedContexts: [], contextHealth: {} })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it('keeps offline health during a pending check and clears it only on successful recovery', async () => {
    mocks.ping.mockRejectedValue(new Error('connection refused'))
    await act(async () => root.render(<StatusBar />))
    expect(useUIStore.getState().contextHealth['cluster-a']).toMatchObject({
      status: 'slow', failures: 1, error: 'Error: connection refused',
    })
    await act(async () => vi.advanceTimersByTimeAsync(25_000))
    expect(useUIStore.getState().contextHealth['cluster-a'].status).toBe('error')
    expect(container.textContent).toContain('offline')

    let recover!: (result: { gitVersion: string }) => void
    mocks.ping.mockImplementationOnce(() => new Promise((resolve) => { recover = resolve }))
    await act(async () => vi.advanceTimersByTimeAsync(25_000))
    expect(useUIStore.getState().contextHealth['cluster-a'].status).toBe('error')
    expect(container.textContent).toContain('offline')

    await act(async () => recover({ gitVersion: 'v1.35.0' }))
    expect(useUIStore.getState().contextHealth['cluster-a']).toMatchObject({
      status: 'ok', error: null, failures: 0, version: 'v1.35.0',
    })
    expect(container.textContent).not.toContain('offline')
    expect(mocks.ping).toHaveBeenCalledTimes(3)
  })

  it('drops disconnected contexts and ignores their pending checks', async () => {
    let fail!: (error: Error) => void
    mocks.ping.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject }))
    await act(async () => root.render(<StatusBar />))
    mocks.ping.mockResolvedValue({ gitVersion: 'v1.35.0' })
    await act(async () => useUIStore.setState({ selectedContext: 'cluster-b' }))
    await act(async () => fail(new Error('old connection failed')))
    expect(Object.keys(useUIStore.getState().contextHealth)).toEqual(['cluster-b'])
    expect(useUIStore.getState().contextHealth['cluster-b'].error).toBeNull()

    await act(async () => root.render(null))
    expect(useUIStore.getState().contextHealth).toEqual({})
    await act(async () => vi.advanceTimersByTimeAsync(25_000))
    expect(mocks.ping).toHaveBeenCalledTimes(2)
  })

  it('does not notify subscribers when a check starts without changing health', async () => {
    mocks.ping.mockResolvedValueOnce({ gitVersion: 'v1.35.0' })
    await act(async () => root.render(<StatusBar />))
    const health = useUIStore.getState().contextHealth
    const notified = vi.fn()
    const unsubscribe = useUIStore.subscribe(notified)
    mocks.ping.mockImplementation(() => new Promise(() => {}))
    try {
      await act(async () => vi.advanceTimersByTimeAsync(25_000))
      expect(mocks.ping).toHaveBeenCalledTimes(2)
      expect(useUIStore.getState().contextHealth).toBe(health)
      expect(notified).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
    }
  })

  it('marks an overdue check stale and clears it when the check recovers', async () => {
    mocks.ping.mockResolvedValueOnce({ gitVersion: 'v1.35.0' })
    await act(async () => root.render(<StatusBar />))
    let recover!: (result: { gitVersion: string }) => void
    const pending = new Promise((resolve) => { recover = resolve })
    mocks.ping.mockReturnValue(pending)
    await act(async () => vi.advanceTimersByTimeAsync(60_000))
    expect(useUIStore.getState().contextHealth['cluster-a'].status).toBe('ok')
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(useUIStore.getState().contextHealth['cluster-a'].status).toBe('stale')
    await act(async () => recover({ gitVersion: 'v1.35.0' }))
    expect(useUIStore.getState().contextHealth['cluster-a']).toMatchObject({
      error: null, failures: 0, lastPingAt: Date.now(),
    })
    expect(useUIStore.getState().contextHealth['cluster-a'].status).not.toBe('stale')
  })
})
