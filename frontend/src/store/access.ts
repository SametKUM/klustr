import { create } from 'zustand'

// AccessStore caches the per-context "accessible kinds" report from the Go
// backend (powered by SelfSubjectAccessReview at watch time). The sidebar
// filter reads this to hide entries the user has no list/watch reach for,
// so restricted contexts feel curated instead of dotted with empty tables.
type State = {
  byContext: Record<string, Set<string>>
}

type Actions = {
  set: (ctx: string, kinds: string[]) => void
  clear: (ctx: string) => void
  reset: () => void
}

export const useAccessStore = create<State & Actions>((set) => ({
  byContext: {},
  set: (ctx, kinds) =>
    set((s) => ({ byContext: { ...s.byContext, [ctx]: new Set(kinds) } })),
  clear: (ctx) =>
    set((s) => {
      const next = { ...s.byContext }
      delete next[ctx]
      return { byContext: next }
    }),
  reset: () => set({ byContext: {} }),
}))

// kindAccessibleInAny returns true when at least one of the active contexts
// has the kind in its accessible set. Used by the sidebar in aggregated
// mode — showing the item if ANY active context can see it is the most
// permissive choice and matches Klustr's existing aggregated-list policy.
//
// When no access report has loaded yet (initial connect), default to true
// so the sidebar shows everything for the first frame and only contracts
// once the access map arrives.
export function kindAccessibleInAny(
  byContext: Record<string, Set<string>>,
  activeContexts: string[],
  kind: string,
): boolean {
  if (activeContexts.length === 0) return true
  let anyReport = false
  for (const ctx of activeContexts) {
    const set = byContext[ctx]
    if (!set) continue
    anyReport = true
    if (set.has(kind)) return true
  }
  return !anyReport
}
