import { describe, expect, it } from 'vitest'
import { namespaceLabel, namespaceQuery } from './namespaceFilter'

describe('namespaceQuery', () => {
  it('treats empty selection as all namespaces', () => {
    const q = namespaceQuery([])
    expect(q.apiNamespace).toBe('')
    expect(q.matches('anything')).toBe(true)
  })

  it('passes a single namespace through to the API and gates matches', () => {
    const q = namespaceQuery(['kube-system'])
    expect(q.apiNamespace).toBe('kube-system')
    expect(q.matches('kube-system')).toBe(true)
    expect(q.matches('default')).toBe(false)
  })

  it('encodes a multi-selection as a sorted comma-separated set', () => {
    const q = namespaceQuery(['c', 'a', 'b'])
    expect(q.apiNamespace).toBe('a,b,c')
    expect(q.matches('a')).toBe(true)
    expect(q.matches('c')).toBe(true)
    expect(q.matches('z')).toBe(false)
  })

  it('drops duplicates and empty entries from persisted selections', () => {
    expect(namespaceQuery(['b', 'a', 'b']).apiNamespace).toBe('a,b')
    expect(namespaceQuery(['', 'a']).apiNamespace).toBe('a')
    expect(namespaceQuery(['']).apiNamespace).toBe('')
    expect(namespaceQuery(['']).matches('anything')).toBe(true)
  })
})

describe('namespaceLabel', () => {
  it('returns "All namespaces" when nothing is selected', () => {
    expect(namespaceLabel([])).toBe('All namespaces')
  })

  it('returns the single namespace name', () => {
    expect(namespaceLabel(['default'])).toBe('default')
  })

  it('summarizes multi-selection by count', () => {
    expect(namespaceLabel(['a', 'b'])).toBe('2 namespaces')
    expect(namespaceLabel(['a', 'b', 'c', 'd'])).toBe('4 namespaces')
  })
})
