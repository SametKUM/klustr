import { describe, expect, it } from 'vitest'
import { kyvernoKindOf } from './kyvernoKinds'

describe('kyvernoKindOf', () => {
  it('accepts a Kyverno kind only with its own group', () => {
    const gvr = (group: string, resource: string) => ({ group, version: 'v1', resource })
    expect(kyvernoKindOf({ kind: 'Policy', namespace: 'a', name: 'p', gvr: gvr('kyverno.io', 'policies') })).toBe(
      'Policy',
    )
    expect(
      kyvernoKindOf({ kind: 'Policy', namespace: 'a', name: 'p', gvr: gvr('example.com', 'policies') }),
    ).toBeNull()
    expect(
      kyvernoKindOf({
        kind: 'PolicyException',
        namespace: 'a',
        name: 'e',
        gvr: gvr('policies.kyverno.io', 'policyexceptions'),
      }),
    ).toBeNull()
    expect(
      kyvernoKindOf({
        kind: 'ClusterPolicyReport',
        namespace: '',
        name: 'r',
        gvr: gvr('wgpolicyk8s.io', 'clusterpolicyreports'),
      }),
    ).toBe('ClusterPolicyReport')
  })

  it('knows the rest of the CEL policy family and its namespaced variants', () => {
    const gvr = (resource: string) => ({ group: 'policies.kyverno.io', version: 'v1', resource })
    expect(kyvernoKindOf({ kind: 'MutatingPolicy', namespace: '', name: 'm', gvr: gvr('mutatingpolicies') })).toBe(
      'MutatingPolicy',
    )
    expect(
      kyvernoKindOf({
        kind: 'NamespacedDeletingPolicy',
        namespace: 'shop',
        name: 'd',
        gvr: gvr('namespaceddeletingpolicies'),
      }),
    ).toBe('NamespacedDeletingPolicy')
    // Another group's MutatingPolicy is not Kyverno's.
    expect(
      kyvernoKindOf({
        kind: 'MutatingPolicy',
        namespace: '',
        name: 'm',
        gvr: { group: 'example.com', version: 'v1', resource: 'mutatingpolicies' },
      }),
    ).toBeNull()
  })

  it('rejects built-ins and other kinds', () => {
    expect(kyvernoKindOf({ kind: 'Deployment', namespace: 'a', name: 'd' })).toBeNull()
    expect(kyvernoKindOf(null)).toBeNull()
  })
})
