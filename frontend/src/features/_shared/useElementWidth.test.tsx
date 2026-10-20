import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useElementWidth } from './useElementWidth'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

afterEach(() => vi.unstubAllGlobals())

const renders = vi.fn()

function Measured({ show, max }: { show: boolean; max?: number }) {
  const { attach, width } = useElementWidth<HTMLDivElement>(max)
  renders()
  return show ? <div ref={attach}>{width}</div> : null
}

const observers: Array<(entries: Array<{ contentRect: { width: number } }>) => void> = []

beforeEach(() => {
  observers.length = 0
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: (typeof observers)[number]) { observers.push(callback) }
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
})

it('caps the width so resizes above the cap do not re-render', () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    act(() => root.render(<Measured show max={720} />))
    act(() => observers[0]([{ contentRect: { width: 900 } }]))
    expect(container.textContent).toBe('720')
    const count = renders.mock.calls.length
    act(() => observers[0]([{ contentRect: { width: 1000 } }]))
    expect(renders).toHaveBeenCalledTimes(count)
    act(() => observers[0]([{ contentRect: { width: 600 } }]))
    expect(container.textContent).toBe('600')
  } finally {
    act(() => root.unmount())
  }
})

it('measures an element that mounts after the first render', () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    act(() => root.render(<Measured show={false} />))
    act(() => root.render(<Measured show />))
    expect(observers).toHaveLength(1)
    act(() => observers[0]([{ contentRect: { width: 640.4 } }]))
    expect(container.textContent).toBe('640')
  } finally {
    act(() => root.unmount())
  }
})
