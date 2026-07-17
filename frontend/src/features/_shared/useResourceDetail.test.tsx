import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/events', () => ({
  deltaTouches: vi.fn(() => false),
  onKubeChange: vi.fn(() => vi.fn()),
}))

vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: { selectedResource: null }) => unknown) =>
    selector({ selectedResource: null }),
}))

import { useResourceDetail } from './useResourceDetail'

type Detail = { name: string }

type HookState = {
  detail: Detail | null
  error: string | null
  loading: boolean
  reload: () => Promise<void>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useResourceDetail', () => {
  let container: HTMLDivElement
  let root: Root
  let current: HookState | null

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    current = null
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('recovers from a failed detail load when reloaded', async () => {
    const initial = deferred<Detail>()
    const retry = deferred<Detail>()
    const load = vi
      .fn<(contextName: string) => Promise<Detail>>()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(retry.promise)

    function Harness() {
      current = useResourceDetail('test-context', 'Pod', 'default', 'api-pod', load)
      return null
    }

    await act(async () => {
      root.render(<Harness />)
    })

    await act(async () => {
      initial.reject(new Error('temporary failure'))
      await initial.promise.catch(() => {})
    })

    expect(current?.detail).toBeNull()
    expect(current?.error).toContain('temporary failure')

    let reloadPromise!: Promise<void>
    act(() => {
      reloadPromise = current!.reload()
    })
    expect(current?.loading).toBe(true)

    await act(async () => {
      retry.resolve({ name: 'api-pod' })
      await reloadPromise
    })

    expect(current?.detail).toEqual({ name: 'api-pod' })
    expect(current?.error).toBeNull()
    expect(current?.loading).toBe(false)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
