import { beforeEach, describe, expect, it } from 'vitest'
import type { CRDInfo } from '@/lib/api'
import { crdKey, findCRD, resolveCRDsByContext, useCRDStore } from './crds'

function reset() {
  useCRDStore.setState({ crds: [], byKey: {}, byContext: {} })
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
    useCRDStore.getState().setCRDs('prod', [argo, cert])
    const s = useCRDStore.getState()
    expect(s.crds).toHaveLength(2)
    expect(s.byKey['argoproj.io/applications']).toEqual(argo)
    expect(s.byKey['cert-manager.io/certificates']).toEqual(cert)
  })

  it('keeps context catalogs isolated while exposing their union', () => {
    const argo = makeCRD('argoproj.io', 'applications', {
      version: 'v1alpha1',
    })
    const cert = makeCRD('cert-manager.io', 'certificates')
    useCRDStore.getState().setCRDs('prod', [argo])
    useCRDStore.getState().setCRDs('staging', [cert])
    const s = useCRDStore.getState()
    expect(s.byKey['argoproj.io/applications']).toBeDefined()
    expect(s.byKey['cert-manager.io/certificates']).toBeDefined()
    expect(findCRD(s.byContext, 'prod', 'argoproj.io', 'applications')?.version).toBe('v1alpha1')
    expect(findCRD(s.byContext, 'staging', 'argoproj.io', 'applications')).toBeNull()
  })

  it('clears one context without dropping retained catalogs', () => {
    useCRDStore.getState().setCRDs('prod', [makeCRD('argoproj.io', 'applications')])
    useCRDStore.getState().setCRDs('staging', [makeCRD('cert-manager.io', 'certificates')])
    useCRDStore.getState().clearContext('prod')
    const s = useCRDStore.getState()
    expect(s.byContext.prod).toBeUndefined()
    expect(s.byKey['argoproj.io/applications']).toBeUndefined()
    expect(s.byKey['cert-manager.io/certificates']).toBeDefined()
  })

  it('resolves the served version independently for each active context', () => {
    const catalog = {
      prod: [makeCRD('networking.istio.io', 'virtualservices', { version: 'v1' })],
      legacy: [
        makeCRD('networking.istio.io', 'virtualservices', {
          version: 'v1beta1',
        }),
      ],
      empty: [],
    }
    const resolved = resolveCRDsByContext(
      catalog,
      ['prod', 'legacy', 'empty'],
      'networking.istio.io',
      'virtualservices',
    )

    expect(resolved.prod.version).toBe('v1')
    expect(resolved.legacy.version).toBe('v1beta1')
    expect(resolved.empty).toBeUndefined()
  })

  it('reset wipes everything', () => {
    useCRDStore.getState().setCRDs('prod', [makeCRD('argoproj.io', 'applications')])
    useCRDStore.getState().reset()
    const s = useCRDStore.getState()
    expect(s.crds).toEqual([])
    expect(s.byKey).toEqual({})
    expect(s.byContext).toEqual({})
  })
})
