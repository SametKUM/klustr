import { beforeEach, describe, expect, it } from 'vitest'
import type { CRDInfo, CustomResourceInfo } from '@/lib/api'
import { crdKey, useCRDStore } from './crds'

function reset() {
  useCRDStore.setState({ crds: [], byKey: {}, customResources: {} })
}

function makeCRD(group: string, resource: string, extras: Partial<CRDInfo> = {}): CRDInfo {
  return {
    kind: resource[0]?.toUpperCase() + resource.slice(1, -1),
    group,
    version: 'v1',
    resource,
    singular: resource.slice(0, -1),
    shortNames: [],
    scope: 'Namespaced',
    createdAt: '2026-01-01T00:00:00Z',
    printerColumns: [],
    ...extras,
  } as CRDInfo
}

describe('crdKey', () => {
  it('joins group and resource with a slash', () => {
    expect(crdKey({ group: 'argoproj.io', resource: 'applications' })).toBe(
      'argoproj.io/applications',
    )
  })

  it('preserves an empty core group', () => {
    expect(crdKey({ group: '', resource: 'pods' })).toBe('/pods')
  })
})

describe('useCRDStore', () => {
  beforeEach(reset)

  it('setCRDs stores the list and indexes it by key', () => {
    const argo = makeCRD('argoproj.io', 'applications')
    const cert = makeCRD('cert-manager.io', 'certificates')
    useCRDStore.getState().setCRDs([argo, cert])
    const s = useCRDStore.getState()
    expect(s.crds).toHaveLength(2)
    expect(s.byKey['argoproj.io/applications']).toEqual(argo)
    expect(s.byKey['cert-manager.io/certificates']).toEqual(cert)
  })

  it('setCRDs replaces the prior index — stale keys are dropped', () => {
    useCRDStore.getState().setCRDs([makeCRD('argoproj.io', 'applications')])
    useCRDStore.getState().setCRDs([makeCRD('cert-manager.io', 'certificates')])
    const s = useCRDStore.getState()
    expect(s.byKey['argoproj.io/applications']).toBeUndefined()
    expect(s.byKey['cert-manager.io/certificates']).toBeDefined()
  })

  it('setCustomResources is keyed and isolated per key', () => {
    const a: CustomResourceInfo = {
      name: 'app1',
      namespace: 'argocd',
      createdAt: '',
      cells: { Sync: 'Synced' },
    }
    const b: CustomResourceInfo = {
      name: 'cert1',
      namespace: 'default',
      createdAt: '',
      cells: {},
    }
    useCRDStore.getState().setCustomResources('argoproj.io/applications', [a])
    useCRDStore.getState().setCustomResources('cert-manager.io/certificates', [b])
    const s = useCRDStore.getState()
    expect(s.customResources['argoproj.io/applications']).toEqual([a])
    expect(s.customResources['cert-manager.io/certificates']).toEqual([b])
  })

  it('reset wipes everything', () => {
    useCRDStore.getState().setCRDs([makeCRD('argoproj.io', 'applications')])
    useCRDStore.getState().setCustomResources('argoproj.io/applications', [])
    useCRDStore.getState().reset()
    const s = useCRDStore.getState()
    expect(s.crds).toEqual([])
    expect(s.byKey).toEqual({})
    expect(s.customResources).toEqual({})
  })
})
