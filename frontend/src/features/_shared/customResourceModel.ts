import type { CRDInfo } from '@/lib/api'
import type { SelectedResource } from '@/store/ui'

// The backend waits ~5 s per call for a CR cache to sync and then reports
// errCRSyncPending (crd.go) while the informer keeps listing. A large CR set
// (thousands of Tekton TaskRuns) needs several waits, so a pending sync is
// retried rather than shown as a failure.
export const CR_SYNC_PENDING_MESSAGE = 'cache sync still in progress'
const CR_SYNC_MAX_ATTEMPTS = 12

export async function ensureWatchUntilSynced(
  ensure: () => Promise<void>,
  isCancelled: () => boolean,
  maxAttempts = CR_SYNC_MAX_ATTEMPTS,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await ensure()
      return
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (!message.includes(CR_SYNC_PENDING_MESSAGE) || attempt >= maxAttempts || isCancelled()) {
        throw e
      }
    }
  }
}

export async function ensureCustomResourceWatches(
  crdsByContext: Record<string, CRDInfo>,
  ensure: (contextName: string, crd: CRDInfo) => Promise<void>,
): Promise<{ readyContexts: string[]; errors: Record<string, string> }> {
  const entries = Object.entries(crdsByContext)
  const results = await Promise.allSettled(
    entries.map(([contextName, crd]) => ensure(contextName, crd)),
  )
  const readyContexts: string[] = []
  const errors: Record<string, string> = {}
  results.forEach((result, index) => {
    const contextName = entries[index][0]
    if (result.status === 'fulfilled') readyContexts.push(contextName)
    else
      errors[contextName] =
        result.reason instanceof Error ? result.reason.message : String(result.reason)
  })
  return { readyContexts, errors }
}

export function buildCustomResourceSelection<T>(
  row: T,
  contextName: string,
  crdsByContext: Record<string, CRDInfo>,
  kind: string,
  identity: (value: T) => { namespace: string; name: string },
  extras?: (value: T) => Partial<SelectedResource>,
): SelectedResource {
  const crd = crdsByContext[contextName]
  const id = identity(row)
  return {
    kind,
    namespace: id.namespace,
    name: id.name,
    context: contextName,
    gvr: crd ? { group: crd.group, version: crd.version, resource: crd.resource } : undefined,
    ...extras?.(row),
  }
}
