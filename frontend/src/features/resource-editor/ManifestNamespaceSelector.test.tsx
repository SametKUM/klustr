import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNamespaceFavorites } from '@/store/namespaceFavorites'
import { ManifestNamespaceSelector } from './ManifestNamespaceSelector'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('manifest namespace selection', () => {
  let container: HTMLDivElement
  let root: Root
  const onValueChange = vi.fn()
  const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  const render = async (props = {}) => {
    await act(async () => root.render(
      <ManifestNamespaceSelector key="ctx" contextName="ctx" namespaces={['staging', 'default', 'staging', 'zebra']} value="default" disabled={false} container={container} onValueChange={onValueChange} {...props} />,
    ))
  }
  const trigger = () => container.querySelector('[aria-label="Default namespace"]') as HTMLButtonElement
  const options = () => [...container.querySelectorAll('[role="option"]')]
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
    useNamespaceFavorites.setState({ byContext: {} })
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    useNamespaceFavorites.setState({ byContext: {} })
    vi.unstubAllGlobals()
    if (scrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoView)
    else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  it('sorts and deduplicates namespaces, marks the current target and omits all-namespaces scope', async () => {
    await render(); await open()
    expect(options().map((item) => item.textContent)).toEqual(['default', 'staging', 'zebra'])
    expect(options()[0].querySelector('span[aria-hidden] .lucide-check')).not.toBeNull()
    expect(options()[1].querySelector('span[aria-hidden] .lucide-check')).toBeNull()
    expect(container.textContent).not.toContain('All namespaces')
    await act(async () => (options()[1] as HTMLElement).click())
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('staging')
    expect(container.querySelector('[data-slot="popover-content"]')).toBeNull()
  })

  it('filters names and selects the matching namespace with the keyboard', async () => {
    await render(); await open(); await search('STAG')
    expect(options().map((item) => item.textContent)).toEqual(['staging'])
    await act(async () => container.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('staging')
    await open()
    expect(container.querySelector('input')!.value).toBe('')
  })

  it('uses favorites for the target context and toggles them without selecting a namespace', async () => {
    useNamespaceFavorites.setState({ byContext: { ctx: ['staging'], other: ['zebra'] } })
    await render(); await open()
    expect(options().map((item) => item.textContent)).toEqual(['staging', 'default', 'zebra'])
    expect(container.querySelector('[cmdk-group-heading]')!.textContent).toBe('Favorites')
    const favorite = container.querySelector('[aria-label="Favorite zebra"]') as HTMLButtonElement
    await act(async () => favorite.click())
    expect(useNamespaceFavorites.getState().byContext.ctx).toEqual(['staging', 'zebra'])
    expect(useNamespaceFavorites.getState().byContext.other).toEqual(['zebra'])
    expect(onValueChange).not.toHaveBeenCalled()
    expect(container.querySelector('input')).not.toBeNull()
    const unfavorite = container.querySelector('[aria-label="Unfavorite zebra"]') as HTMLButtonElement
    await act(async () => {
      unfavorite.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      unfavorite.click()
    })
    expect(onValueChange).not.toHaveBeenCalled()
    expect(useNamespaceFavorites.getState().byContext.ctx).toEqual(['staging'])
  })

  it('keeps a kubeconfig target available when namespace discovery is empty', async () => {
    await render({ namespaces: [], value: 'restricted' }); await open()
    expect(options().map((item) => item.textContent)).toEqual(['restricted'])
    expect(trigger().textContent).toBe('restricted')
  })

  it('allows valid custom namespace targets without creating them', async () => {
    await render(); await open(); await search('new-project')
    expect(options().map((item) => item.textContent)).toEqual(['Use "new-project"'])
    await act(async () => (options()[0] as HTMLElement).click())
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('new-project')
  })

  it.each(['Invalid_Name', '-invalid', 'a'.repeat(64), 'no spaces'])('rejects invalid custom namespace %s', async (name) => {
    await render(); await open(); await search(name)
    expect(options()).toHaveLength(0)
    expect(container.textContent).toContain('No namespaces match.')
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('disables opening and rejects selection if the target becomes locked', async () => {
    await render({ disabled: true }); await open()
    expect(container.querySelector('input')).toBeNull()
    await render(); await open()
    const row = options()[1] as HTMLElement
    await render({ disabled: true })
    await act(async () => row.click())
    expect(onValueChange).not.toHaveBeenCalled()
    expect(trigger().disabled).toBe(true)
  })
})
