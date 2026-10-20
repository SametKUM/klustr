import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
  return { width: 1100, mounted: vi.fn(), stopped: vi.fn(), panelRenders: vi.fn() }
})

vi.mock('./useElementWidth', async () => {
  const { useRef } = await import('react')
  return {
    useElementWidth: () => {
      const ref = useRef(null)
      return { ref, attach: ref, width: mocks.width }
    },
  }
})

vi.mock('./ResourceDetailPanel', async () => {
  const { memo } = await import('react')
  return {
    ResourceDetailPanel: memo(({ resource, onClose }: { resource: object | null; onClose: () => void }) => {
      mocks.panelRenders()
      return resource ? <DetailSession onClose={onClose} /> : null
    }),
  }
})

function DetailSession({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState('retained draft')
  useEffect(() => {
    mocks.mounted()
    return mocks.stopped
  }, [])
  return (
    <section id="resource-detail-panel" data-resource-detail tabIndex={-1}>
      <input aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button aria-label="Close resource details" onClick={onClose}>Close</button>
    </section>
  )
}

const { useUIStore } = await import('@/store/ui')
const { ResourceWorkspace } = await import('./ResourceWorkspace')
const snapshot = useUIStore.getState()
const pod = { kind: 'Pod', context: 'cluster-a', namespace: 'apps', name: 'api' }

describe('resource workspace sessions and focus', () => {
  let container: HTMLDivElement
  let root: Root
  const render = () =>
    root.render(
      <ResourceWorkspace>
        <button data-resource-row="cluster-a/apps/api" aria-current="true">
          Pod
        </button>
      </ResourceWorkspace>,
    )
  const key = (element: Element, key: string) =>
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

  beforeEach(() => {
    mocks.width = 1100
    vi.clearAllMocks()
    useUIStore.setState({ ...snapshot, selectedContext: 'cluster-a', selectedResource: pod })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('keeps the same session, draft and list scroll through expansion and narrow fallback', () => {
    act(render)
    const detail = container.querySelector('[data-resource-detail]')!
    const list = container.querySelector<HTMLElement>('[data-resource-list]')!
    const input = container.querySelector('input')!
    list.scrollTop = 320
    input.focus()

    act(() => useUIStore.getState().setDetailExpanded(true))
    expect(list.hasAttribute('inert')).toBe(true)
    expect(document.activeElement).toBe(input)
    act(() => useUIStore.getState().setDetailExpanded(false))
    mocks.width = 760
    act(render)
    expect(list.hasAttribute('inert')).toBe(true)
    mocks.width = 1100
    act(render)

    expect(container.querySelector('[data-resource-detail]')).toBe(detail)
    expect(container.querySelector('input')).toBe(input)
    expect(input.value).toBe('retained draft')
    expect(list.scrollTop).toBe(320)
    expect(list.hasAttribute('inert')).toBe(false)
    expect(mocks.mounted).toHaveBeenCalledTimes(1)
    expect(mocks.stopped).not.toHaveBeenCalled()
  })

  it('drops an uncommitted drag preview when the divider unmounts', () => {
    act(render)
    const separator = container.querySelector<HTMLElement>('[role="separator"]')!
    separator.setPointerCapture = vi.fn()
    const pointer = (type: string, clientX: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      act(() => separator.dispatchEvent(event))
    }
    const detailWidth = () => container.querySelector<HTMLElement>('[data-resource-detail]')!.parentElement!.style.width
    pointer('pointerdown', 500)
    const renders = mocks.panelRenders.mock.calls.length
    pointer('pointermove', 400)
    expect(detailWidth()).toBe('660px')
    expect(mocks.panelRenders).toHaveBeenCalledTimes(renders)
    mocks.width = 760
    act(render)
    mocks.width = 1100
    act(render)
    expect(detailWidth()).toBe('560px')
  })

  it('leaves focus outside the workspace when the inspector goes full width', () => {
    const terminal = document.createElement('textarea')
    document.body.appendChild(terminal)
    try {
      act(render)
      terminal.focus()
      mocks.width = 760
      act(render)
      expect(document.activeElement).toBe(terminal)
    } finally {
      terminal.remove()
    }
  })

  it('moves focus between panes, closes from the inspector and returns to the inspected row', () => {
    act(render)
    const row = container.querySelector('button')!
    const detail = container.querySelector<HTMLElement>('[data-resource-detail]')!
    row.focus()
    act(() => key(row, 'F6'))
    expect(document.activeElement).toBe(detail)
    act(() => key(detail, 'F6'))
    expect(document.activeElement).toBe(row)
    act(() => key(row, 'F6'))
    act(() => key(detail, 'Escape'))
    expect(useUIStore.getState().selectedResource).toBeNull()
    expect(document.activeElement).toBe(row)
    expect(mocks.stopped).toHaveBeenCalledTimes(1)
  })

  it('closes with Escape from the inspected row and keeps focus there', () => {
    act(render)
    const row = container.querySelector('button')!
    row.focus()
    act(() => key(row, 'Escape'))
    expect(useUIStore.getState().selectedResource).toBeNull()
    expect(document.activeElement).toBe(row)
  })

  it('preserves editing and defers closing while a YAML draft is dirty', () => {
    act(render)
    const input = container.querySelector('input')!
    act(() => key(input, 'Escape'))
    expect(useUIStore.getState().selectedResource).toEqual(pod)
    act(() => useUIStore.getState().setDetailDirty(true))
    act(() => key(container.querySelector('[data-resource-detail]')!, 'Escape'))
    expect(useUIStore.getState().pendingDetailNavigation).not.toBeNull()
    expect(mocks.stopped).not.toHaveBeenCalled()
    act(() => useUIStore.getState().cancelDetailNavigation())
    expect(useUIStore.getState().selectedResource).toEqual(pod)
  })

  it.each(['view', 'context', 'crd'] as const)('does not focus the list when %s navigation clears the inspector', (target) => {
    act(render)
    const sidebar = document.createElement('button')
    document.body.appendChild(sidebar)
    try {
      sidebar.focus()
      act(() => {
        const s = useUIStore.getState()
        if (target === 'view') s.setSelectedView('configmaps')
        else if (target === 'context') s.setSelectedContext('cluster-b')
        else s.setSelectedCRD('example.io/widgets')
      })
      expect(useUIStore.getState().selectedResource).toBeNull()
      expect(document.activeElement).toBe(sidebar)
    } finally {
      sidebar.remove()
    }
  })

  it('leaves global keyboard navigation outside the list when a view change starts from the body', () => {
    act(render)
    expect(document.activeElement).toBe(document.body)
    act(() => useUIStore.getState().setSelectedView('configmaps'))
    expect(document.activeElement).toBe(document.body)
  })

  it('preserves external toolbar focus when selection is cleared without changing views', () => {
    act(render)
    const toolbar = document.createElement('button')
    document.body.appendChild(toolbar)
    try {
      toolbar.focus()
      act(() => useUIStore.getState().setSelectedResource(null))
      expect(document.activeElement).toBe(toolbar)
    } finally {
      toolbar.remove()
    }
  })

  it.each([false, true])('returns focus after an explicit close, including a deferred draft decision (%s)', (dirty) => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
    const dialogButton = document.createElement('button')
    document.body.appendChild(dialogButton)
    try {
      act(render)
      act(() => useUIStore.getState().setDetailDirty(dirty))
      act(() => container.querySelector<HTMLButtonElement>('[aria-label="Close resource details"]')!.click())
      dialogButton.focus()
      if (dirty) {
        expect(useUIStore.getState().selectedResource).toEqual(pod)
        act(() => useUIStore.getState().confirmDetailNavigation())
      }
      act(() => frames.forEach((callback) => callback(0)))
      expect(document.activeElement).toBe(container.querySelector('[data-resource-row]'))
    } finally {
      dialogButton.remove()
      vi.unstubAllGlobals()
    }
  })
})
