import { create } from 'zustand'
import type { CRDInfo } from '@/lib/api'

export function crdKey(c: { group: string; resource: string }): string {
  return `${c.group}/${c.resource}`
}

type CRDState = {
  crds: CRDInfo[]
  byKey: Record<string, CRDInfo>
  byContext: Record<string, CRDInfo[]>
  setCRDs: (contextName: string, list: CRDInfo[]) => void
  clearContext: (contextName: string) => void
  reset: () => void
}

function indexByKey(list: CRDInfo[]): Record<string, CRDInfo> {
  const out: Record<string, CRDInfo> = {}
  for (const c of list) out[crdKey(c)] = c
  return out
}

function mergeByContext(byContext: Record<string, CRDInfo[]>): CRDInfo[] {
  const merged = new Map<string, CRDInfo>()
  for (const list of Object.values(byContext)) {
    for (const crd of list) {
      if (!merged.has(crdKey(crd))) merged.set(crdKey(crd), crd)
    }
  }
  return Array.from(merged.values())
}

function catalogState(byContext: Record<string, CRDInfo[]>) {
  const crds = mergeByContext(byContext)
  return { byContext, crds, byKey: indexByKey(crds) }
}

export function findCRD(
  byContext: Record<string, CRDInfo[]>,
  contextName: string,
  group: string,
  resource: string,
): CRDInfo | null {
  return (
    byContext[contextName]?.find((crd) => crd.group === group && crd.resource === resource) ?? null
  )
}

export function resolveCRDsByContext(
  catalog: Record<string, CRDInfo[]>,
  activeContexts: string[],
  group: string,
  resource: string,
): Record<string, CRDInfo> {
  const result: Record<string, CRDInfo> = {}
  for (const contextName of activeContexts) {
    const crd = findCRD(catalog, contextName, group, resource)
    if (crd) result[contextName] = crd
  }
  return result
}

export const useCRDStore = create<CRDState>((set) => ({
  crds: [],
  byKey: {},
  byContext: {},
  setCRDs: (contextName, list) =>
    set((state) => catalogState({ ...state.byContext, [contextName]: list })),
  clearContext: (contextName) =>
    set((state) => {
      const byContext = { ...state.byContext }
      delete byContext[contextName]
      return catalogState(byContext)
    }),
  reset: () => set({ crds: [], byKey: {}, byContext: {} }),
}))
