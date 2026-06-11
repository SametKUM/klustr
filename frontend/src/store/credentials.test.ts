import { beforeEach, describe, expect, it } from 'vitest'
import { useCredentialsStore } from './credentials'
import type { CredentialStatus } from '@/lib/api'

function status(context: string, state: string): CredentialStatus {
  return {
    context,
    provider: 'aws-vault',
    profile: 'prod',
    state,
    expiresAt: '',
    error: '',
  } as CredentialStatus
}

describe('credentials store', () => {
  beforeEach(() => {
    useCredentialsStore.setState({ providers: [], statuses: {} })
  })

  it('setStatuses indexes by context', () => {
    useCredentialsStore.getState().setStatuses([status('a', 'mapped'), status('b', 'captured')])
    const { statuses } = useCredentialsStore.getState()
    expect(Object.keys(statuses).sort()).toEqual(['a', 'b'])
    expect(statuses['b'].state).toBe('captured')
  })

  it('applyStatus upserts a single context', () => {
    useCredentialsStore.getState().setStatuses([status('a', 'mapped')])
    useCredentialsStore.getState().applyStatus(status('a', 'error'))
    useCredentialsStore.getState().applyStatus(status('c', 'captured'))
    const { statuses } = useCredentialsStore.getState()
    expect(statuses['a'].state).toBe('error')
    expect(statuses['c'].state).toBe('captured')
  })

  it('removeStatus deletes only the named context', () => {
    useCredentialsStore.getState().setStatuses([status('a', 'mapped'), status('b', 'mapped')])
    useCredentialsStore.getState().removeStatus('a')
    const { statuses } = useCredentialsStore.getState()
    expect(statuses['a']).toBeUndefined()
    expect(statuses['b']).toBeDefined()
  })

  it('removeStatus on unknown context keeps state identity', () => {
    const before = useCredentialsStore.getState().statuses
    useCredentialsStore.getState().removeStatus('nope')
    expect(useCredentialsStore.getState().statuses).toBe(before)
  })
})
