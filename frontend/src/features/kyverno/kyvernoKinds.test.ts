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

  it('rejects built-ins and other kinds', () => {
    expect(kyvernoKindOf({ kind: 'Deployment', namespace: 'a', name: 'd' })).toBeNull()
    expect(kyvernoKindOf(null)).toBeNull()
  })
})
