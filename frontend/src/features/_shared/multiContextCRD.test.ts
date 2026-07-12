import { describe, expect, it } from 'vitest'
import { KLUSTR_CTX, resourceContext, resolveResourceContexts } from './resourceContext'
import { retainActiveContextData } from './useContextResourceData'

describe('multi-context custom resources', () => {
  it('reads the mutation target from the tagged row context', () => {
    expect(resourceContext({ name: 'same-name', [KLUSTR_CTX]: 'production' })).toBe('production')
    expect(resourceContext({ name: 'same-name' })).toBe('')
  })

  it('drops stale context rows without changing retained lists', () => {
    const production = [{ name: 'shared' }]
    const staging = [{ name: 'shared' }]
    const next = retainActiveContextData({ production, staging }, ['staging'])

    expect(next).toEqual({ staging })
    expect(next.staging).toBe(staging)
  })

  it('excludes unsupported contexts from custom-resource table loading', () => {
    const activeContexts = ['production', 'legacy']

    expect(resolveResourceContexts(activeContexts, ['production'])).toEqual(['production'])
    expect(resolveResourceContexts(activeContexts)).toBe(activeContexts)
  })
})
