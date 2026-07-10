import { describe, expect, it } from 'vitest'
import { detectProvider } from './providerInfo'

describe('detectProvider', () => {
  it('detects providers from the server host', () => {
    expect(detectProvider({ name: 'x', server: 'https://abc.gr7.eu-central-1.eks.amazonaws.com' })).toBe('aws')
    expect(detectProvider({ name: 'x', server: 'https://abc.azmk8s.io:443' })).toBe('azure')
    expect(detectProvider({ name: 'x', server: 'https://abc.k8s.ondigitalocean.com' })).toBe('digitalocean')
    expect(detectProvider({ name: 'x', server: 'https://abc.linodelke.net' })).toBe('linode')
  })

  it('matches a provider token at a segment boundary in the name', () => {
    expect(detectProvider({ name: 'my-eks-prod', server: '' })).toBe('aws')
    expect(detectProvider({ name: 'aks-staging', server: '' })).toBe('azure')
    expect(detectProvider({ name: 'doks.team', server: '' })).toBe('digitalocean')
  })

  it('does not match a provider token embedded mid-word', () => {
    // 'geeks-dev' must not read as EKS, 'speaks-test' not as AKS.
    expect(detectProvider({ name: 'geeks-dev', server: 'https://example.test' })).toBe('k8s')
    expect(detectProvider({ name: 'speaks-test', server: 'https://example.test' })).toBe('k8s')
    expect(detectProvider({ name: 'my-lkely', server: 'https://example.test' })).toBe('k8s')
  })
})
