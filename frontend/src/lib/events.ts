import { EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import type { CredentialStatus } from '@/lib/api'

type Handler = (contextName: string) => void

const handlers = new Map<string, Set<Handler>>()
let installed = false

// Tracks which (context, kind) pairs have produced at least one change event
// since their watch (re)started. The backend touches every accessible kind once
// after WaitForCacheSync — even empty ones — so an entry here means the informer
// cache for that kind has synced and an empty list is the truth, not a not-yet-
// synced cache. ResourceTable uses this to show skeletons only while genuinely
// loading instead of flashing "No X" before the first sync arrives.
const syncedKinds = new Set<string>()

function syncKey(contextName: string, kind: string): string {
  // Newline can't appear in a context name or kind, so it's a safe delimiter:
  // a space collides (context "a"+kind "b c" vs "a b"+"c", and a "prod" reset
  // would prefix-match "prod cluster").
  return `${contextName}\n${kind}`
}

function install() {
  if (installed) return
  installed = true
  EventsOn('kube:change', (contextName: string, kind: string) => {
    // '_access' is not a real kind: the backend emits it after a watch is
    // rebuilt (credential capture/refresh) with the fresh watcher swapped in.
    // Fan it out to every registered handler so self-fetching views (overview,
    // access review, …) re-read the repopulated informer cache instead of
    // lingering on the stale pre-capture one. Store-fed tables re-pull too,
    // which is harmless.
    if (kind === '_access') {
      for (const set of handlers.values()) set.forEach((h) => h(contextName))
      return
    }
    syncedKinds.add(syncKey(contextName, kind))
    handlers.get(kind)?.forEach((h) => h(contextName))
  })
}

export function isKindSynced(contextName: string, kind: string): boolean {
  return syncedKinds.has(syncKey(contextName, kind))
}

export function resetSyncState(contextNames: string[]): void {
  // Make sure the kube:change listener is live before watches (re)start, so the
  // post-sync touch events that populate syncedKinds are never missed.
  install()
  for (const ctx of contextNames) {
    const prefix = syncKey(ctx, '')
    for (const key of syncedKinds) {
      if (key.startsWith(prefix)) syncedKinds.delete(key)
    }
  }
}

export function onKubeChange(kind: string, handler: Handler): () => void {
  install()
  let set = handlers.get(kind)
  if (!set) {
    set = new Set()
    handlers.set(kind, set)
  }
  set.add(handler)
  return () => {
    set.delete(handler)
  }
}

const pfHandlers = new Set<() => void>()
let pfInstalled = false

function installPF() {
  if (pfInstalled) return
  pfInstalled = true
  EventsOn('pf:update', () => {
    pfHandlers.forEach((h) => h())
  })
}

export function onPFUpdate(handler: () => void): () => void {
  installPF()
  pfHandlers.add(handler)
  return () => {
    pfHandlers.delete(handler)
  }
}

const credsHandlers = new Set<(status: CredentialStatus) => void>()
let credsInstalled = false

function installCreds() {
  if (credsInstalled) return
  credsInstalled = true
  EventsOn('creds:update', (status: CredentialStatus) => {
    credsHandlers.forEach((h) => h(status))
  })
}

export function onCredsUpdate(handler: (status: CredentialStatus) => void): () => void {
  installCreds()
  credsHandlers.add(handler)
  return () => {
    credsHandlers.delete(handler)
  }
}
