import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({ listEvents: vi.fn() }))

vi.mock('@/lib/api', () => ({ api: { listEvents: mocks.listEvents } }))

import { EventsTab } from './EventsTab'

function event(name: string, message: string) {
  return {
    name,
    namespace: 'default',
    type: 'Warning',
    reason: 'FreeDiskSpaceFailed',
    message,
    source: 'kubelet',
    count: 1,
    lastSeen: new Date().toISOString(),
  }
}

describe('EventsTab', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    mocks.listEvents.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  const render = () =>
    act(async () => root.render(<EventsTab contextName="cluster-a" namespace="" kind="Node" name="node-1" />))

  it('polls for new events without showing the loading state', async () => {
    mocks.listEvents.mockResolvedValueOnce([event('e1', 'invalid capacity 0 on image filesystem')])
    await render()
    expect(container.textContent).toContain('1 event')

    let resolve!: (list: unknown[]) => void
    mocks.listEvents.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    expect(mocks.listEvents).toHaveBeenCalledTimes(2)
    expect(container.textContent).not.toContain('Loading')
    expect(container.textContent).toContain('invalid capacity 0')

    await act(async () => resolve([event('e1', 'invalid capacity 0 on image filesystem'), event('e2', 'disk pressure')]))
    expect(container.textContent).toContain('2 events')
    expect(container.textContent).toContain('disk pressure')
  })

  it('stops polling once unmounted and drops the in-flight response', async () => {
    mocks.listEvents.mockResolvedValueOnce([])
    await render()

    let resolve!: (list: unknown[]) => void
    mocks.listEvents.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    await act(async () => root.render(null))
    await act(async () => resolve([event('late', 'late event')]))
    await act(async () => vi.advanceTimersByTimeAsync(60_000))

    expect(mocks.listEvents).toHaveBeenCalledTimes(2)
    expect(container.textContent).not.toContain('late event')
  })

  it('keeps the last list when a poll fails and clears the error on the next success', async () => {
    mocks.listEvents.mockResolvedValueOnce([event('e1', 'first message')])
    await render()

    mocks.listEvents.mockRejectedValueOnce(new Error('etcdserver: request timed out'))
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    expect(container.textContent).toContain('request timed out')
    expect(container.textContent).toContain('first message')

    mocks.listEvents.mockResolvedValueOnce([event('e1', 'first message')])
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    expect(container.textContent).not.toContain('request timed out')
  })
})
