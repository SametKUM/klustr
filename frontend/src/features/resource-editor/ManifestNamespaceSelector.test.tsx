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
  const onCreateNamespace = vi.fn(() => true)
  const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  const render = async (props = {}) => {
    await act(async () => root.render(
      <ManifestNamespaceSelector key="ctx" contextName="ctx" namespaces={['staging', 'default', 'staging', 'zebra']} value="default" disabled={false} container={container} onValueChange={onValueChange} onCreateNamespace={onCreateNamespace} {...props} />,
    ))
  }
  const trigger = () => container.querySelector('[aria-label="Namespace"]') as HTMLButtonElement
  const options = () => [...container.querySelectorAll('[role="option"]')]
  const open = async () => { await act(async () => trigger().click()) }
  const button = (text: string) => [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === text)!
  const search = async (value: string) => {
    const input = container.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  beforeEach(() => {
    onValueChange.mockClear()
    onCreateNamespace.mockReset().mockReturnValue(true)
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
    expect(onCreateNamespace).not.toHaveBeenCalled()
  })

  it('always offers namespace creation and stages it only after explicit submission', async () => {
    await render(); await open()
    expect(button('New namespace…')).toBeDefined()
    await search('new-project')
    await act(async () => button('New namespace…').click())
    expect(container.querySelector('input')!.value).toBe('new-project')
    expect(container.textContent).toContain('Added to this draft and created after review.')
    expect(onCreateNamespace).not.toHaveBeenCalled()
    await act(async () => button('Add namespace').click())
    expect(onCreateNamespace).toHaveBeenCalledExactlyOnceWith('new-project')
    expect(onValueChange).not.toHaveBeenCalled()
    expect(container.querySelector('[data-slot="popover-content"]')).toBeNull()
  })

  it('validates new namespace names and prevents adding an already listed namespace', async () => {
    await render(); await open()
    await act(async () => button('New namespace…').click())
    for (const name of ['', 'Invalid_Name', '-invalid', 'a'.repeat(64), 'default']) {
      await search(name)
      expect(button('Add namespace').disabled).toBe(true)
      await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    }
    expect(container.textContent).toContain('This namespace is already listed.')
    expect(onCreateNamespace).not.toHaveBeenCalled()
    expect(onValueChange).not.toHaveBeenCalled()
    await act(async () => button('Back').click())
    expect(options().map((item) => item.textContent)).toEqual(['default', 'staging', 'zebra'])
  })

  it('keeps the name and form open when adding to the draft fails', async () => {
    onCreateNamespace.mockReturnValue(false)
    await render(); await open()
    await act(async () => button('New namespace…').click())
    await search('new-project')
    await act(async () => button('Add namespace').click())
    expect(container.querySelector('input')!.value).toBe('new-project')
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('Check the manifest for errors.')
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('can create a selected target that is absent from the namespace list', async () => {
    await render({ namespaces: [], value: 'new-project' }); await open()
    await act(async () => button('New namespace…').click())
    expect(container.querySelector('input')!.value).toBe('new-project')
    expect(button('Add namespace').disabled).toBe(false)
    await act(async () => button('Add namespace').click())
    expect(onCreateNamespace).toHaveBeenCalledExactlyOnceWith('new-project')
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
