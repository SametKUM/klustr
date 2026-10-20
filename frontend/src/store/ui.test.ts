import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readSidebarMode } from './ui.persistence'

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

describe('resource inspector navigation', () => {
  beforeEach(resetStore)
  const pod = { kind: 'Pod', context: 'cluster-a', namespace: 'apps', name: 'api-a' }

  it('retains reading tabs across rows and keeps source context in the selection', () => {
    const s = useUIStore.getState()
    s.setSelectedResource(pod)
    s.setActiveDetailTab('logs')
    s.setSelectedResource({ ...pod, context: 'cluster-b', name: 'api-b' })
    expect(useUIStore.getState()).toMatchObject({
      requestedTab: 'logs', selectedResource: { context: 'cluster-b', name: 'api-b' },
    })
  })

  it.each(['exec', 'shell'])('does not carry %s connections to another resource', (tab) => {
    const s = useUIStore.getState()
    s.setSelectedResource(pod)
    s.setActiveDetailTab(tab)
    s.setSelectedResource({ ...pod, name: 'api-b' })
    expect(useUIStore.getState().requestedTab).toBeNull()
  })

  it.each(['values', 'manifest', 'notes', 'history'])('retains the Helm %s tab between releases', (tab) => {
    const s = useUIStore.getState()
    const release = { ...pod, kind: 'HelmRelease' }
    s.setSelectedResource(release)
    s.setActiveDetailTab(tab)
    s.setSelectedResource({ ...release, name: 'other-release' })
    expect(useUIStore.getState().requestedTab).toBe(tab)
  })

  it.each([
    ['violations', { group: 'kyverno.io', version: 'v1', resource: 'clusterpolicies' }],
    ['requests', { group: 'cert-manager.io', version: 'v1', resource: 'certificates' }],
    ['resources', { group: 'argoproj.io', version: 'v1alpha1', resource: 'applications' }],
  ])('retains the integration %s tab between resources of the same kind and through Back', (tab, gvr) => {
    const s = useUIStore.getState()
    const cr = { ...pod, kind: 'Custom', gvr }
    s.setSelectedResource(cr)
    s.setActiveDetailTab(tab)
    s.setSelectedResource({ ...cr, name: 'next' })
    expect(useUIStore.getState().requestedTab).toBe(tab)
    s.openResource(pod)
    s.goBackResource()
    expect(useUIStore.getState()).toMatchObject({ selectedResource: { name: 'next' }, requestedTab: tab })
  })

  it('keeps explicit terminal navigation available and ignores repeat row clicks', () => {
    const s = useUIStore.getState()
    s.openResource(pod, 'exec')
    s.setSelectedResource({ ...pod })
    expect(useUIStore.getState().requestedTab).toBe('exec')
  })

  it.each(['logs', 'events', 'yaml'] as const)('dispatches another %s request after manual navigation', (tab) => {
    const s = useUIStore.getState()
    s.openResource(pod, tab)
    const firstRequest = useUIStore.getState().detailRequestId
    s.setActiveDetailTab('overview')
    s.openResource(pod, tab)
    expect(useUIStore.getState().detailRequestId).toBeGreaterThan(firstRequest)
    expect(useUIStore.getState().requestedTab).toBe(tab)
  })

  it('dispatches repeated container links even while Logs is already active', () => {
    const s = useUIStore.getState()
    const target = { ...pod, logContainer: 'app' }
    s.openResource(target, 'logs')
    s.setActiveDetailTab('logs')
    const firstRequest = useUIStore.getState().detailRequestId
    s.openResource(target, 'logs')
    expect(useUIStore.getState().detailRequestId).toBeGreaterThan(firstRequest)
    s.setSelectedResource({ ...target })
    expect(useUIStore.getState().detailRequestId).toBe(firstRequest + 1)
  })

  it('keeps view and resource together when a palette jump is confirmed or cancelled', () => {
    const s = useUIStore.getState()
    const configMap = { ...pod, kind: 'ConfigMap', name: 'settings' }
    s.setSelectedView('configmaps')
    s.setSelectedResource(configMap)
    s.setDetailDirty(true)
    s.openResourceInView('pods', pod)
    expect(useUIStore.getState()).toMatchObject({ selectedView: 'configmaps', selectedResource: configMap })
    s.cancelDetailNavigation()
    expect(useUIStore.getState()).toMatchObject({ selectedView: 'configmaps', selectedResource: configMap, detailDirty: true })
    s.openResourceInView('pods', pod)
    s.confirmDetailNavigation()
    expect(useUIStore.getState()).toMatchObject({
      selectedView: 'pods', selectedResource: pod, selectedCRDKey: null,
      detailDirty: false, pendingDetailNavigation: null, resourceNavStack: [],
    })
  })

  it('keeps the selection object when the inspected resource is chosen again', () => {
    const s = useUIStore.getState()
    s.setSelectedResource(pod)
    const selected = useUIStore.getState().selectedResource
    s.setSelectedResource({ ...pod })
    s.openResource({ ...pod })
    expect(useUIStore.getState().selectedResource).toBe(selected)
    s.setSelectedResource({ ...pod, suspended: true })
    expect(useUIStore.getState().selectedResource).toMatchObject({ suspended: true })
  })

  it('does not notify subscribers for an unchanged outside-results report', () => {
    const listener = vi.fn()
    const unsubscribe = useUIStore.subscribe(listener)
    try {
      useUIStore.getState().setDetailOutsideResults(false)
      expect(listener).not.toHaveBeenCalled()
      useUIStore.getState().setDetailOutsideResults(true)
      expect(listener).toHaveBeenCalledOnce()
    } finally {
      unsubscribe()
    }
  })

  it('keeps the destination under decision when a late request arrives', () => {
    const s = useUIStore.getState()
    s.setSelectedResource(pod)
    s.setDetailDirty(true)
    s.setSelectedResource(null)
    s.openResource({ ...pod, name: 'manager' })
    s.confirmDetailNavigation()
    expect(useUIStore.getState().selectedResource).toBeNull()
  })

  it.each(['row', 'close', 'view', 'context', 'crd', 'back', 'tab'])(
    'defers %s navigation until the draft is discarded', (target) => {
      const s = useUIStore.getState()
      s.setSelectedContext('cluster-a')
      s.setSelectedResource(pod)
      s.openResource({ ...pod, name: 'api-b' })
      s.setDetailDirty(true)
      const changeTab = vi.fn()
      const actions = {
        row: () => s.setSelectedResource({ ...pod, name: 'api-c' }),
        close: () => s.setSelectedResource(null),
        view: () => s.setSelectedView('nodes'),
        context: () => s.setSelectedContext('cluster-b'),
        crd: () => s.setSelectedCRD('example.io/widgets'),
        back: () => s.goBackResource(),
        tab: () => s.requestDetailNavigation(changeTab),
      }
      actions[target as keyof typeof actions]()
      expect(useUIStore.getState().selectedResource?.name).toBe('api-b')
      expect(useUIStore.getState().pendingDetailNavigation).toBeTypeOf('function')
      expect(changeTab).not.toHaveBeenCalled()
      const discards = useUIStore.getState().detailDiscardRequest
      s.confirmDetailNavigation()
      expect(useUIStore.getState().pendingDetailNavigation).toBeNull()
      expect(useUIStore.getState().detailDirty).toBe(false)
      expect(useUIStore.getState().detailDiscardRequest).toBe(discards + 1)
      if (target === 'tab') expect(changeTab).toHaveBeenCalledOnce()
      else expect(useUIStore.getState().selectedResource?.name).not.toBe('api-b')
    },
  )

  it('keeps the draft and resource when navigation is cancelled', () => {
    const s = useUIStore.getState()
    s.setSelectedResource(pod)
    s.setDetailDirty(true)
    s.setSelectedResource(null)
    s.cancelDetailNavigation()
    expect(useUIStore.getState()).toMatchObject({ selectedResource: pod, detailDirty: true, pendingDetailNavigation: null })
  })

  it('closes a removed resource without asking about its draft', () => {
    const s = useUIStore.getState()
    s.setSelectedResource(pod)
    s.setDetailDirty(true)
    s.setSelectedResource({ ...pod, name: 'api-b' })
    s.closeRemovedResource(pod)
    expect(useUIStore.getState()).toMatchObject({
      selectedResource: null, lastSelectedResource: pod, detailDirty: false, pendingDetailNavigation: null,
    })
  })

  it('leaves the inspector alone when another resource is removed', () => {
    const s = useUIStore.getState()
    s.setSelectedResource(pod)
    s.setDetailDirty(true)
    s.closeRemovedResource({ ...pod, context: 'cluster-b' })
    expect(useUIStore.getState()).toMatchObject({ selectedResource: pod, detailDirty: true })
  })

  it.each(['context', 'view', 'row', 'tab', 'empty history'])(
    'keeps the editor without prompting for unchanged %s navigation', (target) => {
      const s = useUIStore.getState()
      s.setSelectedContext('cluster-a')
      s.setSelectedView('pods')
      s.setSelectedResource(pod)
      s.setActiveDetailTab('yaml')
      s.setDetailDirty(true)
      const actions = {
        context: () => s.setSelectedContext('cluster-a'),
        view: () => s.setSelectedView('pods'),
        row: () => s.setSelectedResource({ ...pod }),
        tab: () => s.openResource({ ...pod }, 'yaml'),
        'empty history': () => s.goBackResource(),
      }
      actions[target as keyof typeof actions]()
      expect(useUIStore.getState()).toMatchObject({
        selectedResource: pod, detailDirty: true, pendingDetailNavigation: null,
      })
    },
  )

  it('ignores repeated aggregate and custom-resource selections while editing', () => {
    const s = useUIStore.getState()
    s.setAggregatedContexts(['cluster-b', 'cluster-a'], 'local-group')
    s.setSelectedCRD('example.io/widgets')
    s.setSelectedResource(pod)
    s.setDetailDirty(true)
    s.setAggregatedContexts(['cluster-a', 'cluster-b', 'cluster-a'], 'local-group')
    s.setSelectedCRD('example.io/widgets')
    expect(useUIStore.getState()).toMatchObject({
      selectedResource: pod, detailDirty: true, pendingDetailNavigation: null,
    })
  })

  it('resizing and expansion do not change resource identity or navigation', () => {
    const s = useUIStore.getState()
    s.openResource(pod, 'exec')
    s.setDetailWidth(620)
    s.setDetailExpanded(true)
    expect(useUIStore.getState()).toMatchObject({ selectedResource: pod, requestedTab: 'exec', detailWidth: 620 })
    expect(localStorage.getItem('klustr-detail-width')).toBe('620')
  })
})

function resetStore() {
  localStorage.clear()
  useUIStore.setState({
    ...baseSnapshot,
    selectedContext: null,
    aggregatedContexts: [],
    activeGroupId: null,
    selectedNamespaces: [],
    namespacesByContext: {},
    globalReadOnly: false,
    logWrap: true,
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

  it('remembers the selection per context and restores it on switch', () => {
    const { setSelectedContext, setSelectedNamespaces } = useUIStore.getState()

    setSelectedContext('cluster1')
    setSelectedNamespaces(['prod'])
    expect(useUIStore.getState().selectedNamespaces).toEqual(['prod'])

    setSelectedContext('cluster2')
    expect(useUIStore.getState().selectedNamespaces).toEqual([])
    setSelectedNamespaces(['test'])
    expect(useUIStore.getState().selectedNamespaces).toEqual(['test'])

    setSelectedContext('cluster1')
    expect(useUIStore.getState().selectedNamespaces).toEqual(['prod'])
    setSelectedContext('cluster2')
    expect(useUIStore.getState().selectedNamespaces).toEqual(['test'])
  })

  it('persists per-context namespaces and drops a context when cleared', () => {
    useUIStore.getState().setSelectedContext('c1')
    useUIStore.getState().setSelectedNamespaces(['a', 'b'])
    expect(JSON.parse(localStorage.getItem('klustr-namespaces-by-context') ?? '{}')).toEqual({
      c1: ['a', 'b'],
    })
    useUIStore.getState().clearSelectedNamespaces()
    expect(localStorage.getItem('klustr-namespaces-by-context')).toBeNull()
  })

  it('keys aggregated mode by the whole context set, separate from single', () => {
    useUIStore.getState().setSelectedContext('a')
    useUIStore.getState().setSelectedNamespaces(['ns-a'])
    useUIStore.getState().setAggregatedContexts(['a', 'b'])
    // The aggregated set has its own (empty) selection, not 'a' single's.
    expect(useUIStore.getState().selectedNamespaces).toEqual([])
    useUIStore.getState().setSelectedContext('a')
    expect(useUIStore.getState().selectedNamespaces).toEqual(['ns-a'])
  })
})

describe('read-only mode', () => {
  beforeEach(resetStore)

  it('persists global read-only and clears it', () => {
    useUIStore.getState().setGlobalReadOnly(true)
    expect(useUIStore.getState().globalReadOnly).toBe(true)
    expect(localStorage.getItem('klustr-read-only')).toBe('true')

    useUIStore.getState().setGlobalReadOnly(false)
    expect(useUIStore.getState().globalReadOnly).toBe(false)
    expect(localStorage.getItem('klustr-read-only')).toBeNull()
  })
})

describe('log line wrap', () => {
  beforeEach(resetStore)

  it('wraps by default and persists only the opt-out', () => {
    expect(useUIStore.getState().logWrap).toBe(true)

    useUIStore.getState().setLogWrap(false)
    expect(useUIStore.getState().logWrap).toBe(false)
    expect(localStorage.getItem('klustr-log-wrap')).toBe('false')

    useUIStore.getState().setLogWrap(true)
    expect(useUIStore.getState().logWrap).toBe(true)
    expect(localStorage.getItem('klustr-log-wrap')).toBeNull()
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

  it('starts icon-only until the user expands it', () => {
    expect(readSidebarMode()).toBe('icons')
    localStorage.setItem('klustr-sidebar-mode', 'expanded')
    expect(readSidebarMode()).toBe('expanded')
    localStorage.setItem('klustr-sidebar-mode', 'bogus')
    expect(readSidebarMode()).toBe('icons')
  })

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
    expect(s.resourceNavStack).toEqual([{ resource: pod, tab: 'overview' }])
  })

  it('opening the same resource twice does not push a duplicate', () => {
    useUIStore.getState().openResource(pod)
    useUIStore.getState().openResource(pod)
    expect(useUIStore.getState().resourceNavStack).toEqual([])
  })

  it('opening another row from the list starts a new history, like a row click', () => {
    const s = useUIStore.getState()
    s.setSelectedResource(pod)
    s.openResource(node)
    s.openResourceFromList({ ...pod, name: 'sibling' }, 'logs')
    expect(useUIStore.getState()).toMatchObject({
      selectedResource: { name: 'sibling' }, requestedTab: 'logs', resourceNavStack: [],
    })
  })

  it('keeps the history when a list action targets the inspected resource', () => {
    const s = useUIStore.getState()
    s.setSelectedResource(pod)
    s.openResource(node)
    s.openResourceFromList(node, 'events')
    expect(useUIStore.getState()).toMatchObject({
      selectedResource: node, requestedTab: 'events', resourceNavStack: [{ resource: pod }],
    })
  })

  it('goBackResource pops the stack', () => {
    useUIStore.getState().openResource(pod)
    useUIStore.getState().openResource(node)
    useUIStore.getState().goBackResource()
    const s = useUIStore.getState()
    expect(s.selectedResource).toEqual(pod)
    expect(s.resourceNavStack).toEqual([])
  })

  it('returns to the reading tab after following a related resource', () => {
    const s = useUIStore.getState()
    s.openResource(pod)
    s.setActiveDetailTab('events')
    s.openResource(node)
    s.setActiveDetailTab('overview')
    s.goBackResource()
    expect(useUIStore.getState()).toMatchObject({ selectedResource: pod, requestedTab: 'events' })
  })

  it.each(['exec', 'shell'])('does not reconnect a %s tab when returning through history', (tab) => {
    const s = useUIStore.getState()
    s.openResource(pod)
    s.setActiveDetailTab(tab)
    s.openResource(node)
    s.goBackResource()
    expect(useUIStore.getState()).toMatchObject({ selectedResource: pod, requestedTab: null })
  })

  it('clears resource history when switching contexts', () => {
    const s = useUIStore.getState()
    s.setSelectedContext('cluster-a')
    s.openResource(pod)
    s.setActiveDetailTab('logs')
    s.openResource(node)
    s.setSelectedContext('cluster-b')
    s.goBackResource()
    expect(useUIStore.getState()).toMatchObject({ selectedResource: null, resourceNavStack: [], requestedTab: null })
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

  it('removeContextGroup clears activeGroupId when the active group is removed', () => {
    useUIStore.getState().upsertContextGroup({
      id: 'g1',
      name: 'one',
      contexts: ['a', 'b'],
      color: 'sky',
    })
    useUIStore.getState().setAggregatedContexts(['a', 'b'], 'g1')
    expect(useUIStore.getState().activeGroupId).toBe('g1')
    useUIStore.getState().removeContextGroup('g1')
    expect(useUIStore.getState().activeGroupId).toBeNull()
  })
})
