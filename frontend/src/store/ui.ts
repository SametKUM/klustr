import { create } from 'zustand'
import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  THEME_CSS_CLASSES,
  getTheme,
  isThemeId,
  type ThemeDefinition,
  type ThemeId,
} from '@/features/_shared/themes'

const THEME_STORAGE_KEY = 'klustr-theme'

function readSavedThemeId(): ThemeId | null {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (isThemeId(saved)) return saved
  if (saved === 'dark') return DEFAULT_DARK
  if (saved === 'light') return DEFAULT_LIGHT
  return null
}

function systemThemeId(): ThemeId {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DEFAULT_DARK : DEFAULT_LIGHT
}

function applyThemeClasses(theme: ThemeDefinition) {
  const root = document.documentElement
  root.classList.toggle('dark', theme.mode === 'dark')
  for (const cls of THEME_CSS_CLASSES) {
    root.classList.toggle(cls, theme.cssClass === cls)
  }
}

const COLLAPSED_NAV_GROUPS_KEY = 'klustr-collapsed-nav-groups'
const EXPANDED_CRD_GROUPS_KEY = 'klustr-expanded-crd-groups'

function readStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function readCollapsedNavGroups(): string[] {
  return readStringArray(COLLAPSED_NAV_GROUPS_KEY)
}

function readExpandedCRDGroups(): string[] {
  return readStringArray(EXPANDED_CRD_GROUPS_KEY)
}

const DEFAULT_CONTEXT_KEY = 'klustr-default-context'

function readDefaultContext(): string | null {
  const v = localStorage.getItem(DEFAULT_CONTEXT_KEY)
  return v && v.length > 0 ? v : null
}

export type ContextTag = string

export type TagColor =
  | 'rose'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'fuchsia'
  | 'pink'
  | 'slate'

export type CustomTagDef = {
  id: string
  label: string
  shortLabel: string
  color: TagColor
}

const CONTEXT_TAGS_KEY = 'klustr-context-tags'
const CUSTOM_TAGS_KEY = 'klustr-custom-tags'

export const MAX_TAGS_PER_CONTEXT = 3

function readContextTags(): Record<string, ContextTag[]> {
  try {
    const raw = localStorage.getItem(CONTEXT_TAGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, ContextTag[]> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) {
        result[k] = [v]
      } else if (Array.isArray(v)) {
        const ids = v
          .filter((x): x is string => typeof x === 'string' && x.length > 0)
          .slice(0, MAX_TAGS_PER_CONTEXT)
        if (ids.length > 0) result[k] = ids
      }
    }
    return result
  } catch {
    return {}
  }
}

const VALID_COLORS: ReadonlySet<TagColor> = new Set([
  'rose',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'fuchsia',
  'pink',
  'slate',
])

function readCustomTags(): Record<string, CustomTagDef> {
  try {
    const raw = localStorage.getItem(CUSTOM_TAGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, CustomTagDef> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue
      const def = v as Partial<CustomTagDef>
      if (
        typeof def.id === 'string' &&
        typeof def.label === 'string' &&
        typeof def.shortLabel === 'string' &&
        typeof def.color === 'string' &&
        VALID_COLORS.has(def.color as TagColor)
      ) {
        result[k] = {
          id: def.id,
          label: def.label,
          shortLabel: def.shortLabel,
          color: def.color as TagColor,
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

export type ResourceView =
  | 'overview'
  | 'workloadsoverview'
  | 'pods'
  | 'deployments'
  | 'services'
  | 'configmaps'
  | 'secrets'
  | 'statefulsets'
  | 'daemonsets'
  | 'replicasets'
  | 'persistentvolumeclaims'
  | 'persistentvolumes'
  | 'storageclasses'
  | 'networkpolicies'
  | 'horizontalpodautoscalers'
  | 'poddisruptionbudgets'
  | 'endpointslices'
  | 'resourcequotas'
  | 'limitranges'
  | 'ingressclasses'
  | 'priorityclasses'
  | 'runtimeclasses'
  | 'leases'
  | 'mutatingwebhookconfigurations'
  | 'validatingwebhookconfigurations'
  | 'endpoints'
  | 'replicationcontrollers'
  | 'events'
  | 'jobs'
  | 'cronjobs'
  | 'ingresses'
  | 'nodes'
  | 'namespaces'

export type ResourceKind =
  | 'Pod'
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'ReplicaSet'
  | 'PersistentVolumeClaim'
  | 'PersistentVolume'
  | 'StorageClass'
  | 'NetworkPolicy'
  | 'HorizontalPodAutoscaler'
  | 'PodDisruptionBudget'
  | 'EndpointSlice'
  | 'ResourceQuota'
  | 'LimitRange'
  | 'IngressClass'
  | 'PriorityClass'
  | 'RuntimeClass'
  | 'Lease'
  | 'MutatingWebhookConfiguration'
  | 'ValidatingWebhookConfiguration'
  | 'Endpoints'
  | 'ReplicationController'
  | 'Job'
  | 'CronJob'
  | 'Service'
  | 'ConfigMap'
  | 'Secret'
  | 'Ingress'
  | 'Node'
  | 'Namespace'

export type SelectedResourceGVR = {
  group: string
  version: string
  resource: string
}

export type SelectedResource = {
  kind: ResourceKind | string
  namespace: string
  name: string
  gvr?: SelectedResourceGVR
}

export type DetailTab = 'overview' | 'logs' | 'exec' | 'events' | 'yaml'

export type PendingAction =
  | { kind: 'delete'; resource: SelectedResource }
  | { kind: 'portforward'; resource: SelectedResource }
  | { kind: 'restart'; resource: SelectedResource }

type UIState = {
  selectedContext: string | null
  selectedNamespaces: string[]
  selectedView: ResourceView
  selectedCRDKey: string | null
  selectedResource: SelectedResource | null
  lastSelectedResource: SelectedResource | null
  resourceNavStack: SelectedResource[]
  requestedTab: DetailTab | null
  pendingAction: PendingAction | null
  themeId: ThemeId
  collapsedNavGroups: string[]
  expandedCRDGroups: string[]
  defaultContext: string | null
  contextTags: Record<string, ContextTag[]>
  customTags: Record<string, CustomTagDef>
  setSelectedContext: (name: string | null) => void
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
  toggleNavGroup: (label: string) => void
  toggleCRDGroup: (label: string) => void
  setDefaultContext: (name: string | null) => void
  toggleContextTag: (name: string, tagId: string) => void
  clearContextTags: (name: string) => void
  addCustomTag: (def: CustomTagDef) => void
  removeCustomTag: (id: string) => void
}

function sameResource(a: SelectedResource, b: SelectedResource): boolean {
  return a.kind === b.kind && a.namespace === b.namespace && a.name === b.name
}

function dedupeSorted(names: readonly string[]): string[] {
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
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

  return {
    selectedContext: initialDefaultContext,
    selectedNamespaces: [],
    selectedView: 'overview',
    selectedCRDKey: null,
    selectedResource: null,
    lastSelectedResource: null,
    resourceNavStack: [],
    requestedTab: null,
    pendingAction: null,
    themeId: initialThemeId,
    collapsedNavGroups: readCollapsedNavGroups(),
    expandedCRDGroups: readExpandedCRDGroups(),
    defaultContext: initialDefaultContext,
    contextTags: readContextTags(),
    customTags: readCustomTags(),
    setSelectedContext: (name) =>
      set((s) =>
        s.selectedContext === name
          ? s
          : {
              selectedContext: name,
              selectedNamespaces: [],
              selectedCRDKey: null,
              selectedResource: null,
              lastSelectedResource: null,
            },
      ),
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
      localStorage.setItem(THEME_STORAGE_KEY, id)
      set({ themeId: id })
    },
    toggleNavGroup: (label) =>
      set((s) => {
        const next = s.collapsedNavGroups.includes(label)
          ? s.collapsedNavGroups.filter((g) => g !== label)
          : [...s.collapsedNavGroups, label]
        localStorage.setItem(COLLAPSED_NAV_GROUPS_KEY, JSON.stringify(next))
        return { collapsedNavGroups: next }
      }),
    toggleCRDGroup: (label) =>
      set((s) => {
        const next = s.expandedCRDGroups.includes(label)
          ? s.expandedCRDGroups.filter((g) => g !== label)
          : [...s.expandedCRDGroups, label]
        localStorage.setItem(EXPANDED_CRD_GROUPS_KEY, JSON.stringify(next))
        return { expandedCRDGroups: next }
      }),
    setDefaultContext: (name) => {
      if (name && name.length > 0) {
        localStorage.setItem(DEFAULT_CONTEXT_KEY, name)
      } else {
        localStorage.removeItem(DEFAULT_CONTEXT_KEY)
      }
      set({ defaultContext: name && name.length > 0 ? name : null })
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
        localStorage.setItem(CONTEXT_TAGS_KEY, JSON.stringify(next))
        return { contextTags: next }
      }),
    clearContextTags: (name) =>
      set((s) => {
        if (!s.contextTags[name]) return s
        const next = { ...s.contextTags }
        delete next[name]
        localStorage.setItem(CONTEXT_TAGS_KEY, JSON.stringify(next))
        return { contextTags: next }
      }),
    addCustomTag: (def) =>
      set((s) => {
        const next = { ...s.customTags, [def.id]: def }
        localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(next))
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
        localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(nextTags))
        localStorage.setItem(CONTEXT_TAGS_KEY, JSON.stringify(nextAssignments))
        return { customTags: nextTags, contextTags: nextAssignments }
      }),
  }
})
