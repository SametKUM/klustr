// localStorage I/O and theme DOM side effects for the UI store. Every
// persisted concern exposes a `read*` helper (called once at store boot)
// and, where the store mutates beyond initial load, a `persist*` helper
// the store action calls explicitly. Keeping these in one place means the
// store body deals only in pure state transitions.

import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  THEME_CSS_CLASSES,
  isThemeId,
  type ThemeDefinition,
  type ThemeId,
} from '@/features/_shared/themes'
import {
  MAX_TAGS_PER_CONTEXT,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  type ContextGroup,
  type ContextTag,
  type CustomTagDef,
  type LastSession,
  type SidebarMode,
  type TagColor,
} from './ui.types'

export const THEME_STORAGE_KEY = 'klustr-theme'
export const COLLAPSED_NAV_GROUPS_KEY = 'klustr-collapsed-nav-groups'
export const EXPANDED_CRD_GROUPS_KEY = 'klustr-expanded-crd-groups'
export const HIDDEN_SIDEBAR_ITEMS_KEY = 'klustr-hidden-sidebar-items'
export const SIDEBAR_MODE_KEY = 'klustr-sidebar-mode'
export const SIDEBAR_WIDTH_KEY = 'klustr-sidebar-width'
export const DEFAULT_CONTEXT_KEY = 'klustr-default-context'
export const AGGREGATED_CONTEXTS_KEY = 'klustr-aggregated-contexts'
export const NAMESPACES_BY_CONTEXT_KEY = 'klustr-namespaces-by-context'
export const GLOBAL_READ_ONLY_KEY = 'klustr-read-only'
export const CONTEXT_TAGS_KEY = 'klustr-context-tags'
export const CUSTOM_TAGS_KEY = 'klustr-custom-tags'
export const CONTEXT_GROUPS_KEY = 'klustr-context-groups'
export const LAST_SESSION_KEY = 'klustr-last-session'
export const LOG_WRAP_KEY = 'klustr-log-wrap'

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

const VALID_GROUP_COLORS: ReadonlySet<TagColor> = VALID_COLORS

export function isValidGroupColor(c: string): c is TagColor {
  return VALID_GROUP_COLORS.has(c as TagColor)
}

// ---- theme ----------------------------------------------------------------

export function readSavedThemeId(): ThemeId | null {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (isThemeId(saved)) return saved
  if (saved === 'dark') return DEFAULT_DARK
  if (saved === 'light') return DEFAULT_LIGHT
  return null
}

export function systemThemeId(): ThemeId {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DEFAULT_DARK : DEFAULT_LIGHT
}

export function applyThemeClasses(theme: ThemeDefinition) {
  const root = document.documentElement
  root.classList.toggle('dark', theme.mode === 'dark')
  for (const cls of THEME_CSS_CLASSES) {
    root.classList.toggle(cls, theme.cssClass === cls)
  }
}

export function persistThemeId(id: ThemeId) {
  localStorage.setItem(THEME_STORAGE_KEY, id)
}

// ---- sidebar --------------------------------------------------------------

export function readSidebarMode(): SidebarMode {
  const raw = localStorage.getItem(SIDEBAR_MODE_KEY)
  return raw === 'icons' ? 'icons' : 'expanded'
}

export function persistSidebarMode(mode: SidebarMode) {
  localStorage.setItem(SIDEBAR_MODE_KEY, mode)
}

export function clampSidebarWidth(value: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, value))
}

export function readSidebarWidth(): number {
  const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY)
  if (!raw) return SIDEBAR_WIDTH_DEFAULT
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return SIDEBAR_WIDTH_DEFAULT
  return clampSidebarWidth(parsed)
}

export function persistSidebarWidth(px: number) {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(px))
}

// ---- nav-group collapse state --------------------------------------------

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

export function readCollapsedNavGroups(): string[] {
  return readStringArray(COLLAPSED_NAV_GROUPS_KEY)
}

export function persistCollapsedNavGroups(list: string[]) {
  localStorage.setItem(COLLAPSED_NAV_GROUPS_KEY, JSON.stringify(list))
}

export function readExpandedCRDGroups(): string[] {
  return readStringArray(EXPANDED_CRD_GROUPS_KEY)
}

export function persistExpandedCRDGroups(list: string[]) {
  localStorage.setItem(EXPANDED_CRD_GROUPS_KEY, JSON.stringify(list))
}

export function readHiddenSidebarItemsByContext(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(HIDDEN_SIDEBAR_ITEMS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, string[]> = {}
    for (const [ctx, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue
      const list = value.filter((v): v is string => typeof v === 'string')
      if (list.length > 0) result[ctx] = list
    }
    return result
  } catch {
    return {}
  }
}

export function persistHiddenSidebarItemsByContext(map: Record<string, string[]>) {
  const entries = Object.entries(map).filter(([, list]) => list.length > 0)
  if (entries.length === 0) {
    localStorage.removeItem(HIDDEN_SIDEBAR_ITEMS_KEY)
  } else {
    localStorage.setItem(HIDDEN_SIDEBAR_ITEMS_KEY, JSON.stringify(Object.fromEntries(entries)))
  }
}

// ---- context selection ---------------------------------------------------

export function readDefaultContext(): string | null {
  const v = localStorage.getItem(DEFAULT_CONTEXT_KEY)
  return v && v.length > 0 ? v : null
}

export function persistDefaultContext(name: string | null) {
  if (name && name.length > 0) {
    localStorage.setItem(DEFAULT_CONTEXT_KEY, name)
  } else {
    localStorage.removeItem(DEFAULT_CONTEXT_KEY)
  }
}

export function readAggregatedContexts(): string[] {
  return readStringArray(AGGREGATED_CONTEXTS_KEY)
}

export function persistAggregatedContexts(list: string[]) {
  if (list.length === 0) {
    localStorage.removeItem(AGGREGATED_CONTEXTS_KEY)
  } else {
    localStorage.setItem(AGGREGATED_CONTEXTS_KEY, JSON.stringify(list))
  }
}

// Namespace selection is remembered per active-context-set: the key is the
// sorted active contexts joined (a single context's name in single-context
// mode), so each cluster — and each saved multi-cluster set — keeps its own
// namespace filter. An absent/empty entry means "all namespaces".
export function readNamespacesByContext(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(NAMESPACES_BY_CONTEXT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue
      const list = value.filter((v): v is string => typeof v === 'string')
      if (list.length > 0) result[key] = list
    }
    return result
  } catch {
    return {}
  }
}

export function readGlobalReadOnly(): boolean {
  return localStorage.getItem(GLOBAL_READ_ONLY_KEY) === 'true'
}

export function persistGlobalReadOnly(value: boolean) {
  if (value) localStorage.setItem(GLOBAL_READ_ONLY_KEY, 'true')
  else localStorage.removeItem(GLOBAL_READ_ONLY_KEY)
}

export function readLogWrap(): boolean {
  return localStorage.getItem(LOG_WRAP_KEY) !== 'false'
}

export function persistLogWrap(value: boolean) {
  if (value) localStorage.removeItem(LOG_WRAP_KEY)
  else localStorage.setItem(LOG_WRAP_KEY, 'false')
}

export function persistNamespacesByContext(map: Record<string, string[]>) {
  const entries = Object.entries(map).filter(([, list]) => list.length > 0)
  if (entries.length === 0) {
    localStorage.removeItem(NAMESPACES_BY_CONTEXT_KEY)
  } else {
    localStorage.setItem(NAMESPACES_BY_CONTEXT_KEY, JSON.stringify(Object.fromEntries(entries)))
  }
}

// ---- last session --------------------------------------------------------

export function readLastSession(): LastSession | null {
  try {
    const raw = localStorage.getItem(LAST_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Partial<LastSession>
    if (!Array.isArray(o.contexts)) return null
    const contexts = o.contexts.filter((c): c is string => typeof c === 'string' && c.length > 0)
    if (contexts.length === 0) return null
    const groupId = typeof o.groupId === 'string' && o.groupId.length > 0 ? o.groupId : null
    const at = typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : Date.now()
    return { contexts, groupId, at }
  } catch {
    return null
  }
}

export function persistLastSession(session: LastSession | null) {
  if (!session || session.contexts.length === 0) {
    localStorage.removeItem(LAST_SESSION_KEY)
  } else {
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session))
  }
}

// ---- context groups ------------------------------------------------------

export function readContextGroups(): ContextGroup[] {
  try {
    const raw = localStorage.getItem(CONTEXT_GROUPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: ContextGroup[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const g = item as Partial<ContextGroup>
      if (typeof g.id !== 'string' || typeof g.name !== 'string') continue
      if (!Array.isArray(g.contexts)) continue
      const contexts = g.contexts.filter((c): c is string => typeof c === 'string' && c.length > 0)
      if (g.id.length === 0 || g.name.length === 0) continue
      const color = typeof g.color === 'string' && isValidGroupColor(g.color) ? g.color : 'sky'
      out.push({ id: g.id, name: g.name, contexts, color })
    }
    return out
  } catch {
    return []
  }
}

export function persistContextGroups(list: ContextGroup[]) {
  if (list.length === 0) {
    localStorage.removeItem(CONTEXT_GROUPS_KEY)
  } else {
    localStorage.setItem(CONTEXT_GROUPS_KEY, JSON.stringify(list))
  }
}

// ---- context tags --------------------------------------------------------

export function readContextTags(): Record<string, ContextTag[]> {
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

export function persistContextTags(map: Record<string, ContextTag[]>) {
  localStorage.setItem(CONTEXT_TAGS_KEY, JSON.stringify(map))
}

export function readCustomTags(): Record<string, CustomTagDef> {
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

export function persistCustomTags(map: Record<string, CustomTagDef>) {
  localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(map))
}
