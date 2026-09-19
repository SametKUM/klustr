import { describe, expect, it } from 'vitest'
import type { CRDInfo } from '@/lib/api'
import { GATEWAY_API_GROUP, gatewayReferenceLabel, gatewayReferenceResource, gatewayResourceContexts } from './gatewayReferences'

const reference = { group: GATEWAY_API_GROUP, kind: 'Gateway', namespace: '', name: 'edge' }

describe('gatewayReferenceResource', () => {
  it('keeps the source context and defaults the namespace to the referring object', () => {
    expect(gatewayReferenceResource(reference, 'apps', 'staging')).toEqual({
      kind: 'Gateway', name: 'edge', namespace: 'apps', context: 'staging',
    })
  })

  it('preserves an explicit cross-namespace backend target', () => {
    expect(gatewayReferenceResource({ ...reference, group: '', kind: 'Service', namespace: 'payments' }, 'apps', 'prod'))
      .toEqual({ kind: 'Service', name: 'edge', namespace: 'payments', context: 'prod' })
  })

  it.each(['Service', 'Secret', 'ConfigMap'])('supports a core %s reference', (kind) => {
    expect(gatewayReferenceResource({ ...reference, group: '', kind }, 'apps', 'staging')?.kind).toBe(kind)
  })

  it.each(['TLSRoute', 'TCPRoute', 'UDPRoute', 'ListenerSet', 'BackendTLSPolicy'])('supports a Gateway %s reference', (kind) => {
    expect(gatewayReferenceResource({ ...reference, kind }, 'apps', 'staging')?.kind).toBe(kind)
  })

  it('does not turn a same-named kind in a different API group into a core resource link', () => {
    expect(gatewayReferenceResource({ ...reference, group: 'example.com', kind: 'Service' }, 'apps', 'staging')).toBeNull()
    expect(gatewayReferenceResource({ ...reference, group: '', kind: 'Gateway' }, 'apps', 'staging')).toBeNull()
  })

  it('leaves unknown kinds and missing identities unlinked', () => {
    expect(gatewayReferenceResource({ ...reference, kind: 'Extension' }, 'apps', 'staging')).toBeNull()
    expect(gatewayReferenceResource(reference, 'apps', null)).toBeNull()
    expect(gatewayReferenceResource({ ...reference, name: '' }, 'apps', 'staging')).toBeNull()
  })
})

describe('gatewayReferenceLabel', () => {
  it('shows the namespace only for cross-namespace references', () => {
    expect(gatewayReferenceLabel(reference, 'apps')).toBe('edge')
    expect(gatewayReferenceLabel({ ...reference, namespace: 'apps' }, 'apps')).toBe('edge')
    expect(gatewayReferenceLabel({ ...reference, namespace: 'infra' }, 'apps')).toBe('infra/edge')
  })
})

describe('gatewayResourceContexts', () => {
  const crd = { group: GATEWAY_API_GROUP, resource: 'tlsroutes' } as CRDInfo
  const catalog = { first: [crd], second: [crd], third: [], inactive: [crd] }

  it('only targets active contexts with the exact CRD and an allowed or pending access report', () => {
    expect(gatewayResourceContexts(['first', 'second', 'third'], catalog, {
      first: new Set(), second: new Set(['TLSRoute']), third: new Set(['TLSRoute']),
    }, 'tlsroutes', 'TLSRoute')).toEqual(['second'])
    expect(gatewayResourceContexts(['first', 'second'], catalog, {}, 'tlsroutes', 'TLSRoute'))
      .toEqual(['first', 'second'])
  })

  it('does not treat similarly named resources from another API group as Gateway APIs', () => {
    expect(gatewayResourceContexts(['custom'], {
      custom: [{ ...crd, group: 'example.com' } as CRDInfo],
    }, {}, 'tlsroutes', 'TLSRoute')).toEqual([])
  })
})
