import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useElementWidth } from './useElementWidth'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

afterEach(() => vi.unstubAllGlobals())

function Measured({ show }: { show: boolean }) {
  const { attach, width } = useElementWidth<HTMLDivElement>()
  return show ? <div ref={attach}>{width}</div> : null
}

it('measures an element that mounts after the first render', () => {
  const observers: Array<(entries: Array<{ contentRect: { width: number } }>) => void> = []
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: (typeof observers)[number]) { observers.push(callback) }
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
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
