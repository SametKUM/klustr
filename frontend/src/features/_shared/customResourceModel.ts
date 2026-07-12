import type { CRDInfo } from '@/lib/api'
import type { SelectedResource } from '@/store/ui'

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
