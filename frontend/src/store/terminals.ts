import { create } from 'zustand'

export type TerminalTab = {
  // Local-only id used by the drawer to identify a tab before its backend
  // session id is known. Stays stable for the lifetime of the tab so the
  // xterm.js instance is not remounted on session restart.
  tabId: string
  contextName: string
}

type State = {
  tabs: TerminalTab[]
  activeTabId: string | null
  drawerOpen: boolean
  drawerHeight: number
  preferredAppId: string
  setDrawerOpen: (open: boolean) => void
  toggleDrawer: () => void
  setDrawerHeight: (height: number) => void
  // Live (in-memory) height update for use during a resize drag; pair with
  // persistDrawerHeight on mouseup so localStorage is written once, not per
  // mousemove.
  setDrawerHeightLive: (height: number) => void
  persistDrawerHeight: () => void
  openTab: (contextName: string) => string
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setPreferredAppId: (id: string) => void
}

const MIN_HEIGHT = 160
const MAX_HEIGHT = 800
const DEFAULT_HEIGHT = 320
const HEIGHT_KEY = 'klustr.terminal.height'
const PREF_APP_KEY = 'klustr.terminal.preferredApp'

function readHeight(): number {
  try {
    const raw = localStorage.getItem(HEIGHT_KEY)
    if (!raw) return DEFAULT_HEIGHT
    const n = Number(raw)
    if (!Number.isFinite(n)) return DEFAULT_HEIGHT
    return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(n)))
  } catch {
    return DEFAULT_HEIGHT
  }
}

function writeHeight(h: number) {
  try {
    localStorage.setItem(HEIGHT_KEY, String(h))
  } catch {
    // ignore quota / privacy errors
  }
}

function readPreferredAppId(): string {
  try {
    return localStorage.getItem(PREF_APP_KEY) ?? ''
  } catch {
    return ''
  }
}

function writePreferredAppId(id: string) {
  try {
    if (id) localStorage.setItem(PREF_APP_KEY, id)
    else localStorage.removeItem(PREF_APP_KEY)
  } catch {
    // ignore
  }
}

let counter = 0
const nextTabId = () => `tab-${++counter}-${Date.now()}`

export const useTerminalStore = create<State>((set, get) => ({
  tabs: [],
  activeTabId: null,
  drawerOpen: false,
  drawerHeight: readHeight(),
  preferredAppId: readPreferredAppId(),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set({ drawerOpen: !get().drawerOpen }),
  setDrawerHeight: (height) => {
    const clamped = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)))
    writeHeight(clamped)
    set({ drawerHeight: clamped })
  },
  setDrawerHeightLive: (height) => {
    set({ drawerHeight: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height))) })
  },
  persistDrawerHeight: () => {
    writeHeight(get().drawerHeight)
  },
  openTab: (contextName) => {
    const tabId = nextTabId()
    set((s) => ({
      tabs: [...s.tabs, { tabId, contextName }],
      activeTabId: tabId,
      drawerOpen: true,
    }))
    return tabId
  },
  closeTab: (tabId) => {
    set((s) => {
      const remaining = s.tabs.filter((t) => t.tabId !== tabId)
      const nextActive =
        s.activeTabId === tabId
          ? (remaining[remaining.length - 1]?.tabId ?? null)
          : s.activeTabId
      return {
        tabs: remaining,
        activeTabId: nextActive,
        drawerOpen: remaining.length > 0 ? s.drawerOpen : false,
      }
    })
  },
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  setPreferredAppId: (id) => {
    writePreferredAppId(id)
    set({ preferredAppId: id })
  },
}))

export const TERMINAL_HEIGHT_MIN = MIN_HEIGHT
export const TERMINAL_HEIGHT_MAX = MAX_HEIGHT
