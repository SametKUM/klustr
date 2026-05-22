import { beforeEach, describe, expect, it, vi } from 'vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }),
})

const {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  MAX_TAGS_PER_CONTEXT,
  useUIStore,
} = await import('./ui')

const baseSnapshot = useUIStore.getState()

function resetStore() {
  localStorage.clear()
  useUIStore.setState({
    ...baseSnapshot,
    selectedContext: null,
    aggregatedContexts: [],
    activeGroupId: null,
    selectedNamespaces: [],
    selectedView: 'overview',
    selectedCRDKey: null,
    selectedResource: null,
    lastSelectedResource: null,
    resourceNavStack: [],
    requestedTab: null,
    pendingAction: null,
    sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
    collapsedNavGroups: [],
    expandedCRDGroups: [],
    defaultContext: null,
    contextTags: {},
    customTags: {},
    contextGroups: [],
  })
}

describe('context selection', () => {
  beforeEach(resetStore)

  it('setSelectedContext sets a single context and clears aggregation', () => {
    useUIStore.getState().setSelectedContext('prod')
    const s = useUIStore.getState()
    expect(s.selectedContext).toBe('prod')
    expect(s.aggregatedContexts).toEqual([])
  })

  it('setAggregatedContexts with 2+ names flips into aggregated mode', () => {
    useUIStore.getState().setAggregatedContexts(['b', 'a', 'a'])
    const s = useUIStore.getState()
    expect(s.aggregatedContexts).toEqual(['a', 'b'])
    expect(s.selectedContext).toBeNull()
  })

  it('setAggregatedContexts with 1 name collapses to single context', () => {
    useUIStore.getState().setAggregatedContexts(['only'])
    const s = useUIStore.getState()
    expect(s.selectedContext).toBe('only')
    expect(s.aggregatedContexts).toEqual([])
  })

  it('toggleAggregatedContext adds and removes', () => {
    useUIStore.getState().setSelectedContext('a')
    useUIStore.getState().toggleAggregatedContext('b')
    expect(useUIStore.getState().aggregatedContexts).toEqual(['a', 'b'])
    useUIStore.getState().toggleAggregatedContext('a')
    expect(useUIStore.getState().selectedContext).toBe('b')
  })

  it('clearAggregatedContexts drops everything', () => {
    useUIStore.getState().setAggregatedContexts(['a', 'b'])
    useUIStore.getState().clearAggregatedContexts()
    const s = useUIStore.getState()
    expect(s.selectedContext).toBeNull()
    expect(s.aggregatedContexts).toEqual([])
  })

  it('aggregated state persists to localStorage', () => {
    useUIStore.getState().setAggregatedContexts(['p', 'q'])
    expect(localStorage.getItem('klustr-aggregated-contexts')).toBe('["p","q"]')
    useUIStore.getState().clearAggregatedContexts()
    expect(localStorage.getItem('klustr-aggregated-contexts')).toBeNull()
  })
})

describe('namespace selection', () => {
  beforeEach(resetStore)

  it('dedupes and sorts on set', () => {
    useUIStore.getState().setSelectedNamespaces(['c', 'a', 'a', 'b'])
    expect(useUIStore.getState().selectedNamespaces).toEqual(['a', 'b', 'c'])
  })

  it('toggle adds and removes', () => {
    useUIStore.getState().toggleSelectedNamespace('a')
    useUIStore.getState().toggleSelectedNamespace('b')
    expect(useUIStore.getState().selectedNamespaces).toEqual(['a', 'b'])
    useUIStore.getState().toggleSelectedNamespace('a')
    expect(useUIStore.getState().selectedNamespaces).toEqual(['b'])
  })
})

describe('sidebar width', () => {
  beforeEach(resetStore)

  it('clamps below the minimum', () => {
    useUIStore.getState().setSidebarWidth(50)
    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH_MIN)
  })

  it('clamps above the maximum', () => {
    useUIStore.getState().setSidebarWidth(9999)
    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH_MAX)
  })

  it('persists the clamped value', () => {
    useUIStore.getState().setSidebarWidth(280)
    expect(localStorage.getItem('klustr-sidebar-width')).toBe('280')
  })
})

describe('sidebar mode toggle', () => {
  beforeEach(resetStore)

  it('flips and persists', () => {
    const before = useUIStore.getState().sidebarMode
    useUIStore.getState().toggleSidebarMode()
    const after = useUIStore.getState().sidebarMode
    expect(after).not.toBe(before)
    expect(localStorage.getItem('klustr-sidebar-mode')).toBe(after)
  })
})

describe('resource navigation stack', () => {
  beforeEach(resetStore)

  const pod = { kind: 'Pod', namespace: 'default', name: 'demo' }
  const node = { kind: 'Node', namespace: '', name: 'node-1' }

  it('openResource pushes the previous resource onto the back stack', () => {
    useUIStore.getState().openResource(pod)
    useUIStore.getState().openResource(node)
    const s = useUIStore.getState()
    expect(s.selectedResource).toEqual(node)
    expect(s.resourceNavStack).toEqual([pod])
  })

  it('opening the same resource twice does not push a duplicate', () => {
    useUIStore.getState().openResource(pod)
    useUIStore.getState().openResource(pod)
    expect(useUIStore.getState().resourceNavStack).toEqual([])
  })

  it('goBackResource pops the stack', () => {
    useUIStore.getState().openResource(pod)
    useUIStore.getState().openResource(node)
    useUIStore.getState().goBackResource()
    const s = useUIStore.getState()
    expect(s.selectedResource).toEqual(pod)
    expect(s.resourceNavStack).toEqual([])
  })

  it('goBackResource is a no-op on an empty stack', () => {
    useUIStore.getState().openResource(pod)
    useUIStore.getState().goBackResource()
    expect(useUIStore.getState().selectedResource).toEqual(pod)
  })

  it('setSelectedView clears selection state', () => {
    useUIStore.getState().openResource(pod)
    useUIStore.getState().setSelectedView('pods')
    const s = useUIStore.getState()
    expect(s.selectedResource).toBeNull()
    expect(s.resourceNavStack).toEqual([])
    expect(s.selectedView).toBe('pods')
  })
})

describe('default context persistence', () => {
  beforeEach(resetStore)

  it('setDefaultContext writes to localStorage', () => {
    useUIStore.getState().setDefaultContext('prod')
    expect(useUIStore.getState().defaultContext).toBe('prod')
    expect(localStorage.getItem('klustr-default-context')).toBe('prod')
  })

  it('setDefaultContext(null) clears persistence', () => {
    useUIStore.getState().setDefaultContext('prod')
    useUIStore.getState().setDefaultContext(null)
    expect(useUIStore.getState().defaultContext).toBeNull()
    expect(localStorage.getItem('klustr-default-context')).toBeNull()
  })
})

describe('context tags', () => {
  beforeEach(resetStore)

  it('toggleContextTag adds and removes', () => {
    useUIStore.getState().toggleContextTag('prod', 'critical')
    expect(useUIStore.getState().contextTags.prod).toEqual(['critical'])
    useUIStore.getState().toggleContextTag('prod', 'critical')
    expect(useUIStore.getState().contextTags.prod).toBeUndefined()
  })

  it('does not exceed the per-context limit', () => {
    for (let i = 0; i < MAX_TAGS_PER_CONTEXT; i++) {
      useUIStore.getState().toggleContextTag('prod', `tag-${i}`)
    }
    useUIStore.getState().toggleContextTag('prod', 'overflow')
    expect(useUIStore.getState().contextTags.prod).toHaveLength(MAX_TAGS_PER_CONTEXT)
    expect(useUIStore.getState().contextTags.prod).not.toContain('overflow')
  })

  it('removeCustomTag removes the tag and clears assignments referencing it', () => {
    useUIStore.getState().addCustomTag({ id: 'red', label: 'Red', shortLabel: 'R', color: 'red' })
    useUIStore.getState().addCustomTag({ id: 'green', label: 'Green', shortLabel: 'G', color: 'emerald' })
    useUIStore.getState().toggleContextTag('prod', 'red')
    useUIStore.getState().toggleContextTag('prod', 'green')
    useUIStore.getState().removeCustomTag('red')
    const s = useUIStore.getState()
    expect(s.customTags.red).toBeUndefined()
    expect(s.contextTags.prod).toEqual(['green'])
  })
})

describe('context groups', () => {
  beforeEach(resetStore)

  it('upsert adds a new group and replaces an existing one', () => {
    useUIStore.getState().upsertContextGroup({
      id: 'g1',
      name: 'prod-cluster',
      contexts: ['a', 'b'],
      color: 'sky',
    })
    expect(useUIStore.getState().contextGroups).toHaveLength(1)
    useUIStore.getState().upsertContextGroup({
      id: 'g1',
      name: 'prod-renamed',
      contexts: ['a'],
      color: 'rose',
    })
    const groups = useUIStore.getState().contextGroups
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ name: 'prod-renamed', contexts: ['a'], color: 'rose' })
  })

  it('upsert rejects empty name or empty contexts', () => {
    useUIStore.getState().upsertContextGroup({ id: 'g1', name: '', contexts: ['a'], color: 'sky' })
    useUIStore.getState().upsertContextGroup({ id: 'g2', name: 'ok', contexts: [], color: 'sky' })
    expect(useUIStore.getState().contextGroups).toEqual([])
  })

  it('removeContextGroup drops the matching group', () => {
    useUIStore.getState().upsertContextGroup({
      id: 'g1',
      name: 'one',
      contexts: ['a'],
      color: 'sky',
    })
    useUIStore.getState().removeContextGroup('g1')
    expect(useUIStore.getState().contextGroups).toEqual([])
  })
})
