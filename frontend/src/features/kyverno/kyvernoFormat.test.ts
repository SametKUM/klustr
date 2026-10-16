import { describe, expect, it } from 'vitest'
import { generatedOnPolicyDelete, policyRefFromResult, ruleSummary } from './kyvernoFormat'

describe('generatedOnPolicyDelete', () => {
  it('keeps the objects of a policy that does not synchronize, whatever the orphan setting', () => {
    expect(generatedOnPolicyDelete(false, false)).toBe('keep generated objects (not synchronized)')
    expect(generatedOnPolicyDelete(false, true)).toBe('keep generated objects (not synchronized)')
  })

  it('follows the orphan setting once the policy synchronizes', () => {
    expect(generatedOnPolicyDelete(true, true)).toBe('keep generated objects')
    expect(generatedOnPolicyDelete(true, false)).toBe('delete generated objects (clones are kept)')
  })
})

describe('policyRefFromResult', () => {
  it('maps classic Kyverno results to a ClusterPolicy or a namespaced Policy', () => {
    expect(policyRefFromResult('disallow-latest-tag', 'kyverno')).toEqual({
      kind: 'ClusterPolicy',
      namespace: '',
      name: 'disallow-latest-tag',
    })
    expect(policyRefFromResult('demo-storefront/require-team-label', 'kyverno')).toEqual({
      kind: 'Policy',
      namespace: 'demo-storefront',
      name: 'require-team-label',
    })
  })

  it('maps CEL policy results to the validating kinds', () => {
    expect(policyRefFromResult('require-labels', 'KyvernoValidatingPolicy')?.kind).toBe('ValidatingPolicy')
    expect(policyRefFromResult('shop/require-labels', 'KyvernoValidatingPolicy')?.kind).toBe(
      'NamespacedValidatingPolicy',
    )
  })

  it('maps mutating, generating and image-validating results to their kinds', () => {
    expect(policyRefFromResult('verify-signed', 'KyvernoImageValidatingPolicy')?.kind).toBe('ImageValidatingPolicy')
    expect(policyRefFromResult('shop/notary', 'KyvernoImageValidatingPolicy')).toEqual({
      kind: 'NamespacedImageValidatingPolicy',
      namespace: 'shop',
      name: 'notary',
    })
    expect(policyRefFromResult('add-team', 'KyvernoMutatingPolicy')?.kind).toBe('MutatingPolicy')
    expect(policyRefFromResult('shop/netpol', 'KyvernoGeneratingPolicy')?.kind).toBe('NamespacedGeneratingPolicy')
  })

  it('has nothing to open for other tools or an empty policy', () => {
    expect(policyRefFromResult('pod-privileged', 'kubewarden')).toBeNull()
    expect(policyRefFromResult('', 'kyverno')).toBeNull()
  })
})

describe('ruleSummary', () => {
  it('lists the non-zero rule types', () => {
    expect(ruleSummary({ validate: 2, mutate: 1, generate: 0, verifyImages: 0 })).toBe('2 validate, 1 mutate')
    expect(ruleSummary({ validate: 0, mutate: 0, generate: 0, verifyImages: 0 })).toBe('—')
  })
})
