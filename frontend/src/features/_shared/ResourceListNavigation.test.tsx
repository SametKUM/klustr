import { act, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { ColumnDef } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ByContext } from '@/store/resources'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

const mocks = vi.hoisted(() => ({ scrollToIndex: vi.fn(), panelRenders: vi.fn() }))
vi.mock('@/lib/events', () => ({ isKindSynced: () => true, onKubeChange: () => () => {} }))
vi.mock('@/lib/nowTick', () => ({ useNowTick: () => {} }))
vi.mock('./ColumnControls', () => ({ ColumnControls: () => null }))
vi.mock('./RowContextMenu', () => ({
  RowContextMenu: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./BulkActionDialogs', () => ({
  BulkDeleteDialog: () => null,
  BulkRestartDialog: () => null,
  BulkCordonDialog: () => null,
  BulkDrainDialog: () => null,
}))
vi.mock('./useElementWidth', async () => {
  const { useRef } = await import('react')
  return {
    useElementWidth: () => {
      const ref = useRef(null)
      return { ref, attach: ref, width: 1100 }
    },
  }
})
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) =>
    useMemo(
      () => ({
        getVirtualItems: () =>
          Array.from({ length: count }, (_, index) => ({
            index,
            start: index * 33,
            end: (index + 1) * 33,
          })),
        getTotalSize: () => count * 33,
        measureElement: () => {},
        scrollToIndex: mocks.scrollToIndex,
      }),
      [count],
    ),
}))
vi.mock('./ResourceDetailPanel', () => ({
  ResourceDetailPanel: ({ resource }: { resource: SelectedResource | null }) => {
    mocks.panelRenders()
    return resource ? (
      <section data-resource-detail tabIndex={-1}>
        <h2>{resource.name}</h2>
        <ResourceListNavigator />
        <input aria-label="Editor" />
        <div className="xterm" tabIndex={0} aria-label="Terminal">
          Terminal
        </div>
      </section>
    ) : null
  },
}))

const { useUIStore } = await import('@/store/ui')
const { useTablePrefs } = await import('@/store/tablePrefs')
const { ResourceWorkspace } = await import('./ResourceWorkspace')
const { ResourceTable } = await import('./ResourceTable')
const { ResourceListNavigator } = await import('./ResourceListNavigator')
const { HELD_KEY_SETTLE_MS } = await import('./resourceNavigation')
import type { SelectedResource } from '@/store/ui'

const snapshot = useUIStore.getState()
type Item = { namespace: string; name: string }
const columns: ColumnDef<Item>[] = [{ accessorKey: 'name', header: 'Name' }]
const fetch = async (context: string): Promise<Item[]> => [
  { namespace: 'apps', name: 'api-a' },
  { namespace: 'apps', name: 'api-b' },
  { namespace: 'apps', name: 'worker-c' },
  ...(context === 'cluster-a' ? [{ namespace: 'apps', name: 'worker-d' }] : []),
]

function Harness(props: { custom?: boolean; prependRows?: boolean }) {
  return (
    <ResourceWorkspace>
      <ListHarness {...props} />
    </ResourceWorkspace>
  )
}

// Owns its rows below the workspace, as the views do with the resource store.
const ownedList: { prepend: () => void } = { prepend: () => {} }
function OwnedListHarness() {
  const [prependRows, setPrependRows] = useState(false)
  useEffect(() => {
    ownedList.prepend = () => setPrependRows(true)
  }, [])
  return <ListHarness prependRows={prependRows} />
}

function ListHarness({
  custom = false,
  prependRows = false,
}: {
  custom?: boolean
  prependRows?: boolean
}) {
  const [data, setDataState] = useState<ByContext<Item>>({})
  const setData = useCallback((context: string, items: Item[]) => {
    setDataState((previous) => ({ ...previous, [context]: items }))
  }, [])
  const rowResource = useCallback(
    (row: Item, context: string): SelectedResource => ({
      ...row,
      context,
      kind: custom ? 'Widget' : 'Pod',
      ...(custom
        ? {
            gvr: {
              group: 'example.io',
              version: context === 'cluster-a' ? 'v1' : 'v2',
              resource: 'widgets',
            },
          }
        : {}),
    }),
    [custom],
  )
  const onRowClick = useCallback(
    (row: Item, context: string) => {
      useUIStore.getState().setSelectedResource(rowResource(row, context))
    },
    [rowResource],
  )
  const visibleData = useMemo(
    () =>
      prependRows && data['cluster-a']
        ? {
            ...data,
            'cluster-a': [
              { namespace: 'apps', name: '0-a' },
              { namespace: 'apps', name: '0-b' },
              ...data['cluster-a'],
            ],
          }
        : data,
    [data, prependRows],
  )
  return (
    <ResourceTable
        kind={custom ? 'cr:example.io/widgets' : 'Pod'}
        noun={{ singular: 'resource', plural: 'resources' }}
        scope="namespaced"
        data={visibleData}
        setData={setData}
        fetch={fetch}
        columns={columns}
        onRowClick={onRowClick}
        rowResource={rowResource}
      />
  )
}

describe('inspector result navigation', () => {
  let container: HTMLDivElement
  let root: Root
  const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
  const row = (name: string, context = 'cluster-a') =>
    container.querySelector<HTMLElement>(`[data-resource-row="${context}/apps/${name}"]`)!
  const filter = async (value: string) => {
    await act(async () => {
      const input = container.querySelector<HTMLInputElement>(
        'input[placeholder^="Filter resources"]',
      )!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 180))
    })
  }

  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    mocks.scrollToIndex.mockClear()
    useUIStore.setState({ ...snapshot, selectedContext: 'cluster-a', selectedView: 'pods' })
    useTablePrefs.setState({ byKind: {} })
    useTablePrefs.getState().setPageSize('Pod', 2)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('crosses pagination boundaries and keeps focus in the inspector', async () => {
    await act(async () => root.render(<Harness />))
    await act(async () => row('api-b').click())
    expect(container.textContent).toContain('2 of 4')
    await act(async () => button('Next resource').click())
    expect(useUIStore.getState().selectedResource?.name).toBe('worker-c')
    expect(container.textContent).toContain('Page 2 of 2')
    expect(container.textContent).toContain('3 of 4')
    expect(mocks.scrollToIndex).toHaveBeenLastCalledWith(0, { align: 'auto' })
    expect(document.activeElement?.matches('[data-resource-detail]')).toBe(true)
    await act(async () => button('Next resource').click())
    expect(button('Next resource').disabled).toBe(true)
    await act(async () => button('Previous resource').click())
    expect(useUIStore.getState().selectedResource?.name).toBe('worker-c')
  })

  it('keeps focus on a result navigation button across moves', async () => {
    await act(async () => root.render(<Harness />))
    await act(async () => row('api-a').click())
    button('Next resource').focus()
    await act(async () => button('Next resource').click())
    expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
    expect(document.activeElement).toBe(button('Next resource'))
    await act(async () => button('Next resource').click())
    expect(useUIStore.getState().selectedResource?.name).toBe('worker-c')
  })

  it('opens only the row a held arrow stops on', async () => {
    useTablePrefs.getState().setPageSize('Pod', 50)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await act(async () => root.render(<Harness />))
      await act(async () => row('api-a').click())
      const press = (name: string, repeat: boolean) => act(async () => {
        row(name).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', repeat, bubbles: true }))
      })
      await press('api-a', false)
      expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
      await press('api-b', true)
      await press('worker-c', true)
      expect(document.activeElement).toBe(row('worker-d'))
      expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
      await act(async () => vi.advanceTimersByTime(HELD_KEY_SETTLE_MS))
      expect(useUIStore.getState().selectedResource?.name).toBe('worker-d')
      await press('worker-d', false)
      await press('worker-c', true)
      await act(async () => useUIStore.getState().setSelectedResource(null))
      await act(async () => vi.advanceTimersByTime(HELD_KEY_SETTLE_MS))
      expect(useUIStore.getState().selectedResource).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('moves a held Alt+Arrow at most once per interval', async () => {
    await act(async () => root.render(<Harness />))
    await act(async () => row('api-a').click())
    const detail = container.querySelector<HTMLElement>('[data-resource-detail]')!
    for (const repeat of [false, true]) {
      await act(async () =>
        detail.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, repeat, bubbles: true })),
      )
    }
    expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
  })

  it('uses the current filter and sort, and hides navigation outside the results', async () => {
    await act(async () => root.render(<Harness />))
    await filter('api')
    await act(async () =>
      [...container.querySelectorAll<HTMLButtonElement>('thead button')]
        .find((b) => b.textContent === 'Name')!
        .click(),
    )
    await act(async () => row('api-b').click())
    expect(container.textContent).toContain('1 of 2')
    expect(button('Previous resource').disabled).toBe(true)
    await act(async () => button('Next resource').click())
    expect(useUIStore.getState().selectedResource?.name).toBe('api-a')
    expect(button('Next resource').disabled).toBe(true)
    await filter('worker')
    expect(container.querySelector('[aria-label="Browse filtered resources"]')).toBeNull()
    expect(useUIStore.getState().detailOutsideResults).toBe(true)
    expect(useUIStore.getState().selectedResource?.name).toBe('api-a')
  })

  it('updates the navigator on list changes without re-rendering the inspector', async () => {
    await act(async () => root.render(<ResourceWorkspace><OwnedListHarness /></ResourceWorkspace>))
    await act(async () => row('api-b').click())
    expect(container.textContent).toContain('2 of 4')
    const renders = mocks.panelRenders.mock.calls.length
    await act(async () => ownedList.prepend())
    expect(container.textContent).toContain('4 of 6')
    expect(mocks.panelRenders).toHaveBeenCalledTimes(renders)
  })

  it('does not flag a custom resource that shares its kind name with the list', async () => {
    await act(async () => root.render(<Harness />))
    const missing = { kind: 'Pod', context: 'cluster-a', namespace: 'apps', name: 'gone' }
    await act(async () => useUIStore.getState().setSelectedResource(missing))
    expect(useUIStore.getState().detailOutsideResults).toBe(true)
    await act(async () => useUIStore.getState().setSelectedResource({
      ...missing, name: 'lookalike', gvr: { group: 'example.io', version: 'v1', resource: 'pods' },
    }))
    expect(useUIStore.getState().detailOutsideResults).toBe(false)
  })

  it('keeps the search when an empty namespace is selected and restores matching results on return', async () => {
    await act(async () => root.render(<Harness />))
    await filter('api')
    await act(async () => row('api-a').click())
    await act(async () => useUIStore.getState().setSelectedNamespaces(['empty']))
    expect(
      container.querySelector<HTMLInputElement>('input[placeholder^="Filter resources"]')?.value,
    ).toBe('api')
    expect(container.textContent).toContain('No resources in empty.')
    await act(async () => useUIStore.getState().setSelectedNamespaces(['apps']))
    expect(
      container.querySelector<HTMLInputElement>('input[placeholder^="Filter resources"]')?.value,
    ).toBe('api')
    expect(container.textContent).toContain('1 of 2')
  })

  it('clears the search when the list moves to another cluster', async () => {
    await act(async () => root.render(<Harness />))
    await filter('api')
    await act(async () => useUIStore.getState().setSelectedContext('cluster-b'))
    expect(
      container.querySelector<HTMLInputElement>('input[placeholder^="Filter resources"]')?.value,
    ).toBe('')
  })

  it('offers a filter reset when results are hidden without changing the namespace or inspector', async () => {
    useUIStore.getState().setSelectedNamespaces(['apps'])
    await act(async () => root.render(<Harness />))
    await act(async () => row('api-a').click())
    await filter('missing')
    const clear = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent === 'Clear filters',
    )
    expect(clear).toBeDefined()
    await act(async () => {
      clear!.click()
      await new Promise((resolve) => setTimeout(resolve, 180))
    })
    expect(useUIStore.getState().selectedNamespaces).toEqual(['apps'])
    expect(useUIStore.getState().selectedResource?.name).toBe('api-a')
    expect(container.textContent).toContain('1 of 4')
  })

  it('defers both the selection and page change until a dirty draft is discarded', async () => {
    await act(async () => root.render(<Harness />))
    await act(async () => row('api-b').click())
    await act(async () => useUIStore.getState().setDetailDirty(true))
    await act(async () => button('Next resource').click())
    expect(useUIStore.getState().pendingDetailNavigation).toBeTypeOf('function')
    expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
    expect(container.textContent).toContain('Page 1 of 2')
    await act(async () => useUIStore.getState().cancelDetailNavigation())
    expect(useUIStore.getState().detailDirty).toBe(true)
    await act(async () => button('Next resource').click())
    await act(async () => useUIStore.getState().confirmDetailNavigation())
    expect(useUIStore.getState().selectedResource?.name).toBe('worker-c')
    expect(container.textContent).toContain('Page 2 of 2')
  })

  it('preserves the row context and discovered custom-resource version', async () => {
    useUIStore.setState({ selectedContext: null, aggregatedContexts: ['cluster-a', 'cluster-b'] })
    await act(async () => root.render(<Harness custom />))
    await act(async () => row('api-a').click())
    await act(async () => button('Next resource').click())
    expect(useUIStore.getState().selectedResource).toMatchObject({
      name: 'api-a',
      context: 'cluster-b',
      gvr: { group: 'example.io', version: 'v2', resource: 'widgets' },
    })
  })

  it('keeps the intended neighbor and reveals its latest page when live rows change during confirmation', async () => {
    await act(async () => root.render(<Harness />))
    await act(async () => row('api-b').click())
    await act(async () => useUIStore.getState().setDetailDirty(true))
    await act(async () => button('Next resource').click())
    await act(async () => root.render(<Harness prependRows />))
    await act(async () => useUIStore.getState().confirmDetailNavigation())
    expect(useUIStore.getState().selectedResource?.name).toBe('worker-c')
    expect(container.textContent).toContain('Page 3 of 3')
    expect(container.textContent).toContain('5 of 6')
  })

  it('supports next/previous shortcuts in expanded details without intercepting editor keys', async () => {
    await act(async () => root.render(<Harness />))
    await act(async () => row('api-a').click())
    await act(async () => useUIStore.getState().setDetailExpanded(true))
    const detail = container.querySelector<HTMLElement>('[data-resource-detail]')!
    await act(async () =>
      detail.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
      ),
    )
    expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
    await act(async () =>
      container
        .querySelector('[aria-label="Editor"]')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
        ),
    )
    expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
    await act(async () =>
      container
        .querySelector('[aria-label="Terminal"]')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
        ),
    )
    expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
    for (const role of ['menu', 'alertdialog']) {
      const overlay = document.createElement('div')
      overlay.setAttribute('role', role)
      overlay.dataset.state = 'open'
      document.body.appendChild(overlay)
      try {
        await act(async () =>
          detail.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
          ),
        )
        expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
      } finally {
        overlay.remove()
      }
    }
  })

  it('leaves keys from portaled content to that content', async () => {
    const portal = document.createElement('div')
    document.body.appendChild(portal)
    try {
      await act(async () => root.render(
        <ResourceWorkspace>
          <ListHarness />
          {createPortal(<button>Cancel</button>, portal)}
        </ResourceWorkspace>,
      ))
      await act(async () => row('api-a').click())
      for (const init of [{ key: 'ArrowDown', altKey: true }, { key: 'Escape' }]) {
        await act(async () =>
          portal.querySelector('button')!.dispatchEvent(
            new KeyboardEvent('keydown', { ...init, bubbles: true }),
          ),
        )
      }
      expect(useUIStore.getState().selectedResource?.name).toBe('api-a')
    } finally {
      portal.remove()
    }
  })
})
