import { describe, expect, it } from 'vitest'
import type { CRDInfo } from '@/lib/api'
import { kube } from '@/lib/wails/wailsjs/go/models'
import { ALL_RESOURCE_VIEWS } from '@/features/_shared/resourceGroups'
import { buildVisibleResourceGroups } from '@/features/_shared/visibleResourceGroups'
import { buildCustomResourceSelection } from '@/features/_shared/customResourceModel'
import { integrationFor, isIntegrationView } from '@/lib/integrations'
import { CILIUM_GROUP, CILIUM_RESOURCES, isCiliumView, type CiliumView } from './ciliumKinds'

describe('Cilium navigation', () => {
  it.each(Object.keys(CILIUM_RESOURCES) as CiliumView[])('gates %s on the exact CRD in an active context', (resource) => {
    const definition = CILIUM_RESOURCES[resource]
    const crd = kube.CRDInfo.createFrom({ group: CILIUM_GROUP, resource, kind: definition.kind, version: 'v2alpha1', scope: definition.scope === 'namespaced' ? 'Namespaced' : 'Cluster' })
    const input = { activeContexts: ['dev'], accessByContext: {}, hiddenItems: [] }
    const group = (catalog: Record<string, CRDInfo[]>) => buildVisibleResourceGroups({ ...input, crdsByContext: catalog }).find((g) => g.label === 'Cilium')

    expect(group({ inactive: [crd] })).toBeUndefined()
    expect(group({ dev: [kube.CRDInfo.createFrom({ ...crd, group: 'example.com' })] })).toBeUndefined()
    expect(group({ dev: [crd] })?.items.map((i) => i.view)).toEqual([resource])
    expect(ALL_RESOURCE_VIEWS.has(resource)).toBe(true)
    expect(buildVisibleResourceGroups({ ...input, crdsByContext: { dev: [crd] }, hiddenItems: [resource] }).some((g) => g.label === 'Cilium')).toBe(false)

    const row = { namespace: crd.scope === 'Namespaced' ? 'app' : '', name: 'shared' }
    const selection = buildCustomResourceSelection(row, 'dev', { dev: crd }, definition.kind, (value) => value)
    expect(selection.context).toBe('dev')
    expect(selection.gvr?.version).toBe('v2alpha1')
    expect(integrationFor(selection.gvr)?.view).toBe(resource)
    expect(integrationFor({ ...selection.gvr!, group: 'example.com' })).toBeUndefined()
  })

  it('rejects unknown and prototype properties', () => {
    expect(isCiliumView('toString')).toBe(false)
    expect(isCiliumView('ciliumunknown')).toBe(false)
    expect(isIntegrationView('toString')).toBe(false)
    expect(integrationFor(undefined)).toBeUndefined()
  })
})
