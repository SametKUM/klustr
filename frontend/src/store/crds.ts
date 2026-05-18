import { create } from 'zustand'
import type { CRDInfo, CustomResourceInfo } from '@/lib/api'

export function crdKey(c: { group: string; resource: string }): string {
  return `${c.group}/${c.resource}`
}

type CRDState = {
  crds: CRDInfo[]
  byKey: Record<string, CRDInfo>
  customResources: Record<string, CustomResourceInfo[]>
  setCRDs: (list: CRDInfo[]) => void
  setCustomResources: (key: string, list: CustomResourceInfo[]) => void
  reset: () => void
}

function indexByKey(list: CRDInfo[]): Record<string, CRDInfo> {
  const out: Record<string, CRDInfo> = {}
  for (const c of list) out[crdKey(c)] = c
  return out
}

export const useCRDStore = create<CRDState>((set) => ({
  crds: [],
  byKey: {},
  customResources: {},
  setCRDs: (list) => set({ crds: list, byKey: indexByKey(list) }),
  setCustomResources: (key, list) =>
    set((s) => ({ customResources: { ...s.customResources, [key]: list } })),
  reset: () => set({ crds: [], byKey: {}, customResources: {} }),
}))
