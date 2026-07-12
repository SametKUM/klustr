import { create } from 'zustand'
import type { HelmRepoInfo } from '@/lib/api'

type HelmState = {
  repos: HelmRepoInfo[]
  setRepos: (list: HelmRepoInfo[]) => void
  reset: () => void
}

export const useHelmStore = create<HelmState>((set) => ({
  repos: [],
  setRepos: (list) => set({ repos: list }),
  reset: () => set({ repos: [] }),
}))
