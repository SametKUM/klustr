import { describe, expect, it } from 'vitest'
import { eventGroup, stampOf } from './stamp'

describe('eventGroup', () => {
  it('groups per-session events by kind', () => {
    expect(eventGroup('pod:logs:line:abc123')).toBe('pod:logs:line')
    expect(eventGroup('exec:out:s-1')).toBe('exec:out')
    expect(eventGroup('term:close:x')).toBe('term:close')
  })

  it('keeps other event names whole', () => {
    expect(eventGroup('kube:change')).toBe('kube:change')
    expect(eventGroup('pf:update')).toBe('pf:update')
  })
})

describe('stampOf', () => {
  it('reads the stamp Go appends', () => {
    expect(stampOf({ __klustrPerf: { t: 1730000000000000, bytes: 42 } })).toEqual({ t: 1730000000000000, bytes: 42 })
  })

  it('ignores ordinary event arguments', () => {
    expect(stampOf(undefined)).toBeNull()
    expect(stampOf('kube:change')).toBeNull()
    expect(stampOf({ upserts: [], removed: [], gen: 1 })).toBeNull()
    expect(stampOf({ __klustrPerf: { t: '1', bytes: 2 } })).toBeNull()
  })
})
