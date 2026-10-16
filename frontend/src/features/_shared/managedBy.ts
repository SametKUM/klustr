import type { ResourceManager } from '@/lib/api'
import type { SelectedResource } from '@/store/ui'

export const TOOL_LABEL: Record<string, string> = {
  argocd: 'Argo CD',
  flux: 'Flux',
  helm: 'Helm',
}

// managerTitle names the owner the way its tool does: "Argo CD Application
// argocd/shop-api", "Helm release shop/api".
export function managerTitle(m: ResourceManager): string {
  const tool = TOOL_LABEL[m.tool] ?? m.tool
  const kind = m.tool === 'helm' ? 'release' : m.kind
  const ref = m.namespace ? `${m.namespace}/${m.name}` : m.name
  return `${tool} ${kind} ${ref}`
}

// managerKindId is the Klustr kind identifier the detail panel dispatches on:
// Flux CRs carry a "Flux" prefix so they do not collide with Helm releases.
export function managerKindId(m: ResourceManager): string {
  if (m.tool === 'flux') return `Flux${m.kind}`
  return m.kind
}

// managerResource is the SelectedResource that opens the owner, given the
// version its context serves for an owner CR.
export function managerResource(m: ResourceManager, version?: string): SelectedResource {
  return {
    kind: managerKindId(m),
    namespace: m.namespace,
    name: m.name,
    context: m.context,
    ...(m.group && version ? { gvr: { group: m.group, version, resource: m.resource } } : {}),
    ...(m.tool === 'flux' ? { suspended: m.suspended } : {}),
  }
}

// ignores reports whether the owner leaves field (a JSON pointer) alone,
// either by naming it or one of its parents.
function ignores(m: ResourceManager, field: string): boolean {
  return m.ignoredFields.some((p) => field === p || field.startsWith(`${p}/`))
}

// revertingManagers are the owners that will undo a live change, to field
// when one is given (a scale touches only /spec/replicas).
export function revertingManagers(managers: ResourceManager[], field?: string): ResourceManager[] {
  return managers.filter((m) => m.revertsDrift && !(field && ignores(m, field)))
}

export function revertWarning(m: ResourceManager): string {
  const reason = m.revertReason ? ` because ${m.revertReason}` : ''
  return `${managerTitle(m)} will revert this change${reason}.`
}
