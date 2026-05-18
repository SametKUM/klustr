import { create } from 'zustand'
import type { HelmReleaseInfo, HelmRepoInfo } from '@/lib/api'

type HelmState = {
  releases: HelmReleaseInfo[]
  repos: HelmRepoInfo[]
  setReleases: (list: HelmReleaseInfo[]) => void
  setRepos: (list: HelmRepoInfo[]) => void
  reset: () => void
}

export const useHelmStore = create<HelmState>((set) => ({
  releases: [],
  repos: [],
  setReleases: (list) => set({ releases: list }),
  setRepos: (list) => set({ repos: list }),
  reset: () => set({ releases: [], repos: [] }),
}))
