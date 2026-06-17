import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SortRule = { id: string; desc: boolean }

// Rows shown per page. 0 is the sentinel for "All"; absent falls back to
// DEFAULT_PAGE_SIZE. The fixed option set offered in the UI.
export const DEFAULT_PAGE_SIZE = 100
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 0] as const

type ColumnPrefs = {
  order: string[]
  hidden: string[]
  sizing: Record<string, number>
  // Absent means "never sorted this kind" (fall back to the view's default sort);
  // an empty array means the user explicitly cleared sorting.
  sorting?: SortRule[]
  pageSize?: number
}

type State = {
  byKind: Record<string, ColumnPrefs>
  setOrder: (kind: string, order: string[]) => void
  setHidden: (kind: string, hidden: string[]) => void
  setSizing: (kind: string, sizing: Record<string, number>) => void
  setSorting: (kind: string, sorting: SortRule[]) => void
  setPageSize: (kind: string, pageSize: number) => void
  reset: (kind: string) => void
}

export const useTablePrefs = create<State>()(
  persist(
    (set) => ({
      byKind: {},
      setOrder: (kind, order) =>
        set((s) => ({ byKind: { ...s.byKind, [kind]: { ...prefsFor(s, kind), order } } })),
      setHidden: (kind, hidden) =>
        set((s) => ({ byKind: { ...s.byKind, [kind]: { ...prefsFor(s, kind), hidden } } })),
      setSizing: (kind, sizing) =>
        set((s) => ({ byKind: { ...s.byKind, [kind]: { ...prefsFor(s, kind), sizing } } })),
      setSorting: (kind, sorting) =>
        set((s) => ({ byKind: { ...s.byKind, [kind]: { ...prefsFor(s, kind), sorting } } })),
      setPageSize: (kind, pageSize) =>
        set((s) => ({ byKind: { ...s.byKind, [kind]: { ...prefsFor(s, kind), pageSize } } })),
      reset: (kind) =>
        set((s) => {
          const next = { ...s.byKind }
          delete next[kind]
          return { byKind: next }
        }),
    }),
    { name: 'klustr.tablePrefs' },
  ),
)

// Shared frozen default so an absent kind always yields the same reference —
// otherwise a fresh object each call would defeat zustand v5's getSnapshot
// identity check and infinite-loop if selectPrefs were ever used as a hook
// selector. Setters spread it, so the frozen value is never mutated.
const EMPTY_PREFS: ColumnPrefs = Object.freeze({
  order: [] as string[],
  hidden: [] as string[],
  sizing: {} as Record<string, number>,
})

function prefsFor(s: State, kind: string): ColumnPrefs {
  return s.byKind[kind] ?? EMPTY_PREFS
}

export function selectPrefs(kind: string) {
  return (s: State): ColumnPrefs => s.byKind[kind] ?? EMPTY_PREFS
}
