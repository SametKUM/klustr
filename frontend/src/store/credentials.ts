// Live credential-helper state fed by the backend: provider detection,
// per-context mapping statuses and creds:update events. This is backend-fed
// real-time state like portForwards — persistence lives in the Go layer's
// mappings JSON, never in localStorage.
import { create } from 'zustand'
import type { CredentialProviderInfo, CredentialStatus } from '@/lib/api'

type State = {
  providers: CredentialProviderInfo[]
  statuses: Record<string, CredentialStatus>
  setProviders: (providers: CredentialProviderInfo[]) => void
  setStatuses: (statuses: CredentialStatus[]) => void
  applyStatus: (status: CredentialStatus) => void
  removeStatus: (contextName: string) => void
}

export const useCredentialsStore = create<State>((set) => ({
  providers: [],
  statuses: {},
  setProviders: (providers) => set({ providers }),
  setStatuses: (statuses) =>
    set({
      statuses: Object.fromEntries(statuses.map((s) => [s.context, s])),
    }),
  applyStatus: (status) =>
    set((state) => ({ statuses: { ...state.statuses, [status.context]: status } })),
  removeStatus: (contextName) =>
    set((state) => {
      if (!(contextName in state.statuses)) return state
      const next = { ...state.statuses }
      delete next[contextName]
      return { statuses: next }
    }),
}))

export function useCredentialStatus(contextName: string): CredentialStatus | undefined {
  return useCredentialsStore((s) => s.statuses[contextName])
}

export function useAwsVaultDetected(): boolean {
  return useCredentialsStore((s) =>
    s.providers.some((p) => p.name === 'aws-vault' && p.detected),
  )
}
