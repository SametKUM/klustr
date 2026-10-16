import { expect, it } from 'vitest'
import type { ResourceManager } from '@/lib/api'
import { managerTitle, revertingManagers, revertWarning } from './managedBy'

function manager(over: Partial<ResourceManager>): ResourceManager {
  return {
    tool: 'argocd',
    kind: 'Application',
    group: 'argoproj.io',
    resource: 'applications',
    context: 'dev',
    namespace: 'argocd',
    name: 'shop-api',
    resolved: true,
    suspended: false,
    revertsDrift: true,
    revertReason: 'self-heal is on',
    ignoredFields: [],
    ...over,
  } as ResourceManager
}

it('names owners the way their tool does', () => {
  expect(managerTitle(manager({}))).toBe('Argo CD Application argocd/shop-api')
  expect(managerTitle(manager({ tool: 'helm', kind: 'HelmRelease', namespace: 'shop', name: 'api' }))).toBe(
    'Helm release shop/api',
  )
  expect(managerTitle(manager({ tool: 'flux', kind: 'HelmRelease', namespace: 'flux-system', name: 'api' }))).toBe(
    'Flux HelmRelease flux-system/api',
  )
})

it('keeps only owners that revert the change', () => {
  const helm = manager({ tool: 'helm', kind: 'HelmRelease', revertsDrift: false, revertReason: '' })
  const argo = manager({})
  expect(revertingManagers([helm, argo])).toEqual([argo])
})

it('skips owners that ignore the changed field or a parent of it', () => {
  const ignoresReplicas = manager({ ignoredFields: ['/spec/replicas'] })
  const ignoresSpec = manager({ name: 'other', ignoredFields: ['/spec'] })
  const ignoresSibling = manager({ name: 'sibling', ignoredFields: ['/spec/replicasLimit'] })
  expect(revertingManagers([ignoresReplicas, ignoresSpec, ignoresSibling], '/spec/replicas')).toEqual([ignoresSibling])
  // A whole-object YAML edit can touch fields the owner does manage.
  expect(revertingManagers([ignoresReplicas])).toEqual([ignoresReplicas])
})

it('words the warning with its reason', () => {
  expect(revertWarning(manager({}))).toBe('Argo CD Application argocd/shop-api will revert this change because self-heal is on.')
})
