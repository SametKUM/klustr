import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DetailResizeHandle } from './DetailResizeHandle'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('inspector resizing', () => {
  let container: HTMLDivElement
  let root: Root
  let handle: HTMLDivElement
  const resize = vi.fn()
  const commit = vi.fn()
  const pointer = (type: string, clientX: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX })
    Object.defineProperty(event, 'pointerId', { value: 7 })
    act(() => handle.dispatchEvent(event))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.cursor = 'crosshair'
    document.body.style.userSelect = 'text'
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() =>
      root.render(
        <DetailResizeHandle width={560} maxWidth={700} onResize={resize} onCommit={commit} />,
      ),
    )
    handle = container.firstElementChild as HTMLDivElement
    handle.setPointerCapture = vi.fn()
    handle.releasePointerCapture = vi.fn()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  it('previews a bounded drag and persists once when pointer capture ends', () => {
    pointer('pointerdown', 400)
    pointer('pointermove', 200)
    expect(resize).toHaveBeenLastCalledWith(700)
    expect(commit).not.toHaveBeenCalled()
    pointer('pointerup', 200)
    pointer('lostpointercapture', 200)
    expect(commit).toHaveBeenCalledExactlyOnceWith(700)
    expect(document.body.style.cursor).toBe('crosshair')
    expect(document.body.style.userSelect).toBe('text')
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('restores text selection if the inspector closes during a drag', () => {
    pointer('pointerdown', 400)
    expect(document.body.style.userSelect).toBe('none')
    act(() => root.render(null))
    expect(document.body.style.cursor).toBe('crosshair')
    expect(document.body.style.userSelect).toBe('text')
    expect(commit).not.toHaveBeenCalled()
  })

  it('allows keyboard resizing and clamps it to the available workspace', () => {
    act(() =>
      handle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }),
      ),
    )
    expect(commit).toHaveBeenLastCalledWith(624)
    act(() => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })))
    expect(commit).toHaveBeenLastCalledWith(480)
    act(() => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })))
    expect(commit).toHaveBeenLastCalledWith(700)
  })

  it('resets the preferred width with a double-click or Enter', () => {
    act(() => handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(commit).toHaveBeenLastCalledWith(560)
    act(() => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(commit).toHaveBeenLastCalledWith(560)
  })

  it('does not save the window-fitted width for a click without a drag', () => {
    act(() =>
      root.render(
        <DetailResizeHandle width={499} maxWidth={499} onResize={resize} onCommit={commit} />,
      ),
    )
    pointer('pointerdown', 400)
    pointer('pointermove', 401)
    pointer('pointerup', 401)
    pointer('lostpointercapture', 401)
    expect(resize).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
    expect(document.body.style.cursor).toBe('crosshair')
    expect(document.body.style.userSelect).toBe('text')
  })

  it('resets to the default rather than the window-fitted width', () => {
    act(() =>
      root.render(
        <DetailResizeHandle width={499} maxWidth={520} onResize={resize} onCommit={commit} />,
      ),
    )
    act(() => handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(commit).toHaveBeenLastCalledWith(560)
    act(() => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(commit).toHaveBeenLastCalledWith(560)
  })
})
