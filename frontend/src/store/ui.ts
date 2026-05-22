import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_DARK, DEFAULT_LIGHT, getTheme, type ThemeId } from '@/features/_shared/themes'
import {
  MAX_TAGS_PER_CONTEXT,
  type ContextGroup,
  type ContextTag,
  type CustomTagDef,
  type DetailTab,
  type PendingAction,
  type ResourceView,
  type SelectedResource,
  type SidebarMode,
} from './ui.types'
import {
  applyThemeClasses,
  clampSidebarWidth,
  isValidGroupColor,
  persistAggregatedContexts,
  persistCollapsedNavGroups,
  persistContextGroups,
  persistContextTags,
  persistCustomTags,
  persistDefaultContext,
  persistExpandedCRDGroups,
  persistSidebarMode,
  persistSidebarWidth,
  persistThemeId,
  readAggregatedContexts,
  readCollapsedNavGroups,
  readContextGroups,
  readContextTags,
  readCustomTags,
  readDefaultContext,
  readExpandedCRDGroups,
  readSavedThemeId,
  readSidebarMode,
  readSidebarWidth,
  systemThemeId,
} from './ui.persistence'

export {
  MAX_TAGS_PER_CONTEXT,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from './ui.types'
export type {
  ContextGroup,
  ContextTag,
  CustomTagDef,
  DetailTab,
  PendingAction,
  ResourceKind,
  ResourceView,
  SelectedResource,
  SelectedResourceGVR,
  SidebarMode,
  TagColor,
} from './ui.types'

type UIState = {
  selectedContext: string | null
  aggregatedContexts: string[]
  activeGroupId: string | null
  selectedNamespaces: string[]
  selectedView: ResourceView
  selectedCRDKey: string | null
  selectedResource: SelectedResource | null
  lastSelectedResource: SelectedResource | null
  resourceNavStack: SelectedResource[]
  requestedTab: DetailTab | null
  pendingAction: PendingAction | null
  themeId: ThemeId
  sidebarMode: SidebarMode
  sidebarWidth: number
  collapsedNavGroups: string[]
  expandedCRDGroups: string[]
  defaultContext: string | null
  contextTags: Record<string, ContextTag[]>
  customTags: Record<string, CustomTagDef>
  contextGroups: ContextGroup[]
  setSelectedContext: (name: string | null) => void
  setAggregatedContexts: (names: string[], groupId?: string | null) => void
  toggleAggregatedContext: (name: string) => void
  clearAggregatedContexts: () => void
  setSelectedNamespaces: (names: string[]) => void
  toggleSelectedNamespace: (name: string) => void
  clearSelectedNamespaces: () => void
  setSelectedView: (view: ResourceView) => void
  setSelectedCRD: (key: string | null) => void
  setSelectedResource: (resource: SelectedResource | null) => void
  openResource: (resource: SelectedResource, tab?: DetailTab) => void
  goBackResource: () => void
  setPendingAction: (action: PendingAction | null) => void
  setTheme: (id: ThemeId) => void
  toggleSidebarMode: () => void
  setSidebarWidth: (px: number) => void
  toggleNavGroup: (label: string) => void
  toggleCRDGroup: (label: string) => void
  setDefaultContext: (name: string | null) => void
  toggleContextTag: (name: string, tagId: string) => void
  clearContextTags: (name: string) => void
  addCustomTag: (def: CustomTagDef) => void
  removeCustomTag: (id: string) => void
  upsertContextGroup: (group: ContextGroup) => void
  removeContextGroup: (id: string) => void
}

function sameResource(a: SelectedResource, b: SelectedResource): boolean {
  return a.kind === b.kind && a.namespace === b.namespace && a.name === b.name
}

function dedupeSorted(names: readonly string[]): string[] {
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
}

type ContextSlice = Pick<UIState, 'selectedContext' | 'aggregatedContexts'>

function effectiveContextList(s: ContextSlice): string[] {
  if (s.aggregatedContexts.length > 0) return s.aggregatedContexts
  return s.selectedContext ? [s.selectedContext] : []
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((n, i) => b[i] === n)
}

type NormalizedContexts = {
  selectedContext: string | null
  aggregatedContexts: string[]
  activeGroupId: string | null
  selectedNamespaces: string[]
  selectedCRDKey: string | null
  selectedResource: SelectedResource | null
  lastSelectedResource: SelectedResource | null
}

function normalizeContexts(next: readonly string[]): NormalizedContexts {
  const sortedNext = dedupeSorted(next)
  const aggregatedNext = sortedNext.length >= 2 ? sortedNext : []
  const selectedNext = sortedNext.length === 1 ? sortedNext[0] : null
  persistAggregatedContexts(aggregatedNext)
  return {
    selectedContext: selectedNext,
    aggregatedContexts: aggregatedNext,
    activeGroupId: null,
    selectedNamespaces: [],
    selectedCRDKey: null,
    selectedResource: null,
    lastSelectedResource: null,
  }
}

export const useUIStore = create<UIState>((set) => {
  const saved = readSavedThemeId()
  const initialThemeId = saved ?? systemThemeId()
  applyThemeClasses(getTheme(initialThemeId))

  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = (e: MediaQueryListEvent) => {
    const next = e.matches ? DEFAULT_DARK : DEFAULT_LIGHT
    applyThemeClasses(getTheme(next))
    set({ themeId: next })
  }
  let followingSystem = saved === null
  if (followingSystem) {
    mql.addEventListener('change', onSystemChange)
  }

  const initialDefaultContext = readDefaultContext()
  const initialAggregatedContexts = readAggregatedContexts()
  const aggregatedAtBoot = initialAggregatedContexts.length >= 2 ? initialAggregatedContexts : []
  const selectedAtBoot = aggregatedAtBoot.length > 0 ? null : initialDefaultContext

  return {
    selectedContext: selectedAtBoot,
    aggregatedContexts: aggregatedAtBoot,
    activeGroupId: null,
    selectedNamespaces: [],
    selectedView: 'overview',
    selectedCRDKey: null,
    selectedResource: null,
    lastSelectedResource: null,
    resourceNavStack: [],
    requestedTab: null,
    pendingAction: null,
    themeId: initialThemeId,
    sidebarMode: readSidebarMode(),
    sidebarWidth: readSidebarWidth(),
    collapsedNavGroups: readCollapsedNavGroups(),
    expandedCRDGroups: readExpandedCRDGroups(),
    defaultContext: initialDefaultContext,
    contextTags: readContextTags(),
    customTags: readCustomTags(),
    contextGroups: readContextGroups(),
    setSelectedContext: (name) =>
      set((s) => {
        const next = name ? [name] : []
        if (sameList(next, effectiveContextList(s))) return s
        return normalizeContexts(next)
      }),
    setAggregatedContexts: (names, groupId) =>
      set((s) => {
        const next = dedupeSorted(names)
        const nextGroup = groupId ?? null
        if (sameList(next, effectiveContextList(s)) && s.activeGroupId === nextGroup) return s
        return { ...normalizeContexts(next), activeGroupId: nextGroup }
      }),
    toggleAggregatedContext: (name) =>
      set((s) => {
        const current = effectiveContextList(s)
        const next = current.includes(name)
          ? current.filter((n) => n !== name)
          : dedupeSorted([...current, name])
        if (sameList(next, current)) return s
        return normalizeContexts(next)
      }),
    clearAggregatedContexts: () =>
      set((s) => {
        if (effectiveContextList(s).length === 0) return s
        return normalizeContexts([])
      }),
    setSelectedNamespaces: (names) =>
      set({ selectedNamespaces: dedupeSorted(names) }),
    toggleSelectedNamespace: (name) =>
      set((s) => {
        const has = s.selectedNamespaces.includes(name)
        const next = has
          ? s.selectedNamespaces.filter((n) => n !== name)
          : dedupeSorted([...s.selectedNamespaces, name])
        return { selectedNamespaces: next }
      }),
    clearSelectedNamespaces: () => set({ selectedNamespaces: [] }),
    setSelectedView: (view) =>
      set({
        selectedView: view,
        selectedCRDKey: null,
        selectedResource: null,
        lastSelectedResource: null,
        resourceNavStack: [],
        requestedTab: null,
      }),
    setSelectedCRD: (key) =>
      set({
        selectedCRDKey: key,
        selectedResource: null,
        lastSelectedResource: null,
        resourceNavStack: [],
        requestedTab: null,
      }),
    setSelectedResource: (resource) =>
      set((s) => ({
        selectedResource: resource,
        lastSelectedResource: resource ?? s.selectedResource ?? s.lastSelectedResource,
        resourceNavStack: [],
        requestedTab: null,
      })),
    openResource: (resource, tab) =>
      set((s) => ({
        resourceNavStack:
          s.selectedResource && !sameResource(s.selectedResource, resource)
            ? [...s.resourceNavStack, s.selectedResource]
            : s.resourceNavStack,
        selectedResource: resource,
        lastSelectedResource: resource,
        requestedTab: tab ?? null,
      })),
    goBackResource: () =>
      set((s) => {
        if (s.resourceNavStack.length === 0) return s
        const next = s.resourceNavStack[s.resourceNavStack.length - 1]
        return {
          selectedResource: next,
          lastSelectedResource: next,
          resourceNavStack: s.resourceNavStack.slice(0, -1),
          requestedTab: null,
        }
      }),
    setPendingAction: (action) => set({ pendingAction: action }),
    setTheme: (id) => {
      if (followingSystem) {
        mql.removeEventListener('change', onSystemChange)
        followingSystem = false
      }
      applyThemeClasses(getTheme(id))
      persistThemeId(id)
      set({ themeId: id })
    },
    toggleSidebarMode: () =>
      set((s) => {
        const next: SidebarMode = s.sidebarMode === 'expanded' ? 'icons' : 'expanded'
        persistSidebarMode(next)
        return { sidebarMode: next }
      }),
    setSidebarWidth: (px) =>
      set((s) => {
        const next = clampSidebarWidth(px)
        if (next === s.sidebarWidth) return s
        persistSidebarWidth(next)
        return { sidebarWidth: next }
      }),
    toggleNavGroup: (label) =>
      set((s) => {
        const next = s.collapsedNavGroups.includes(label)
          ? s.collapsedNavGroups.filter((g) => g !== label)
          : [...s.collapsedNavGroups, label]
        persistCollapsedNavGroups(next)
        return { collapsedNavGroups: next }
      }),
    toggleCRDGroup: (label) =>
      set((s) => {
        const next = s.expandedCRDGroups.includes(label)
          ? s.expandedCRDGroups.filter((g) => g !== label)
          : [...s.expandedCRDGroups, label]
        persistExpandedCRDGroups(next)
        return { expandedCRDGroups: next }
      }),
    setDefaultContext: (name) => {
      const value = name && name.length > 0 ? name : null
      persistDefaultContext(value)
      set({ defaultContext: value })
    },
    toggleContextTag: (name, tagId) =>
      set((s) => {
        const current = s.contextTags[name] ?? []
        let nextList: string[]
        if (current.includes(tagId)) {
          nextList = current.filter((t) => t !== tagId)
        } else {
          if (current.length >= MAX_TAGS_PER_CONTEXT) return s
          nextList = [...current, tagId]
        }
        const next = { ...s.contextTags }
        if (nextList.length === 0) delete next[name]
        else next[name] = nextList
        persistContextTags(next)
        return { contextTags: next }
      }),
    clearContextTags: (name) =>
      set((s) => {
        if (!s.contextTags[name]) return s
        const next = { ...s.contextTags }
        delete next[name]
        persistContextTags(next)
        return { contextTags: next }
      }),
    addCustomTag: (def) =>
      set((s) => {
        const next = { ...s.customTags, [def.id]: def }
        persistCustomTags(next)
        return { customTags: next }
      }),
    removeCustomTag: (id) =>
      set((s) => {
        const nextTags = { ...s.customTags }
        delete nextTags[id]
        const nextAssignments: Record<string, string[]> = {}
        for (const [ctx, list] of Object.entries(s.contextTags)) {
          const filtered = list.filter((t) => t !== id)
          if (filtered.length > 0) nextAssignments[ctx] = filtered
        }
        persistCustomTags(nextTags)
        persistContextTags(nextAssignments)
        return { customTags: nextTags, contextTags: nextAssignments }
      }),
    upsertContextGroup: (group) =>
      set((s) => {
        const color = isValidGroupColor(group.color) ? group.color : 'sky'
        const cleaned: ContextGroup = {
          id: group.id,
          name: group.name.trim(),
          contexts: Array.from(new Set(group.contexts.filter((c) => c.length > 0))),
          color,
        }
        if (cleaned.name.length === 0 || cleaned.contexts.length === 0) return s
        const idx = s.contextGroups.findIndex((g) => g.id === cleaned.id)
        const next = idx === -1
          ? [...s.contextGroups, cleaned]
          : s.contextGroups.map((g, i) => (i === idx ? cleaned : g))
        persistContextGroups(next)
        return { contextGroups: next }
      }),
    removeContextGroup: (id) =>
      set((s) => {
        const next = s.contextGroups.filter((g) => g.id !== id)
        if (next.length === s.contextGroups.length) return s
        persistContextGroups(next)
        return { contextGroups: next }
      }),
  }
})

export function useActiveContexts(): string[] {
  return useUIStore(
    useShallow((s) =>
      s.aggregatedContexts.length > 0
        ? s.aggregatedContexts
        : s.selectedContext
          ? [s.selectedContext]
          : [],
    ),
  )
}

export function useIsAggregated(): boolean {
  return useUIStore((s) => s.aggregatedContexts.length > 1)
}
