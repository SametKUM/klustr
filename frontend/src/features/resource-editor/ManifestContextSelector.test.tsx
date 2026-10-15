import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManifestContextSelector } from './ManifestContextSelector'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('manifest context selection', () => {
  let container: HTMLDivElement
  let root: Root
  const onValueChange = vi.fn()
  const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  const render = async (props = {}) => {
    await act(async () => root.render(
      <ManifestContextSelector contexts={['dev', 'prod', 'dev']} value="dev" disabled={false} container={container} onValueChange={onValueChange} {...props} />,
    ))
  }
  const trigger = () => container.querySelector('[aria-label="Target context"]') as HTMLButtonElement
  const options = () => [...container.querySelectorAll<HTMLElement>('[role="option"]')]
  const open = async () => { await act(async () => trigger().click()) }
  const search = async (value: string) => {
    const input = container.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  beforeEach(() => {
    onValueChange.mockClear()
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    if (scrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoView)
    else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  it('shows connected contexts once and marks the current target inside the supplied portal', async () => {
    await render(); await open()
    expect(container.querySelector('select')).toBeNull()
    expect(trigger().getAttribute('role')).toBe('combobox')
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(options().map((item) => item.textContent)).toEqual(['dev', 'prod'])
    expect(options()[0].querySelector('span[aria-hidden] .lucide-check')).not.toBeNull()
    expect(options()[1].querySelector('span[aria-hidden] .lucide-check')).toBeNull()
    await act(async () => options()[1].click())
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('prod')
    expect(container.querySelector('[data-slot="popover-content"]')).toBeNull()
  })

  it('filters case-insensitively and selects a context with the keyboard', async () => {
    await render(); await open(); await search(' PROD ')
    expect(options().map((item) => item.textContent)).toEqual(['prod'])
    await act(async () => container.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('prod')
    await open()
    expect(container.querySelector('input')!.value).toBe('')
    expect(options()).toHaveLength(2)
  })

  it('does not choose a target implicitly and shows empty search results', async () => {
    await render({ value: '' }); await open()
    expect(trigger().textContent).toBe('Select a context')
    expect(onValueChange).not.toHaveBeenCalled()
    await search('missing')
    expect(options()).toHaveLength(0)
    expect(container.textContent).toContain('No active contexts match.')
    await render({ contexts: [], value: '' })
    await search('')
    expect(options()).toHaveLength(0)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('retains a disconnected target without allowing it to be selected', async () => {
    await render({ contexts: ['prod'] }); await open()
    expect(trigger().textContent).toBe('dev (disconnected)')
    const disconnected = options().find((item) => item.textContent === 'dev (disconnected)')!
    expect(disconnected.getAttribute('aria-disabled')).toBe('true')
    await act(async () => disconnected.click())
    expect(onValueChange).not.toHaveBeenCalled()
    await act(async () => options().find((item) => item.textContent === 'prod')!.click())
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('prod')
  })

  it('closes without invalidating the target when the current context is selected', async () => {
    await render(); await open()
    await act(async () => options()[0].click())
    expect(onValueChange).not.toHaveBeenCalled()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('disables opening and rejects selection when the target becomes locked', async () => {
    await render({ disabled: true }); await open()
    expect(container.querySelector('input')).toBeNull()
    await render(); await open()
    const row = options()[1]
    await render({ disabled: true })
    await act(async () => row.click())
    expect(trigger().disabled).toBe(true)
    expect(container.querySelector('input')).toBeNull()
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
