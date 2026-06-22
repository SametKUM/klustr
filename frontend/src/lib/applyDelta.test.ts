import { describe, expect, it } from 'vitest'
import { applyDeltaToList, deltaKey } from './applyDelta'

type Row = { namespace?: string; name?: string; v?: number }

const r = (namespace: string, name: string, v = 0): Row => ({ namespace, name, v })

describe('applyDeltaToList', () => {
  it('returns the same array reference for an empty delta', () => {
    const prev = [r('ns', 'a'), r('ns', 'b')]
    expect(applyDeltaToList(prev, [], [])).toBe(prev)
  })

  it('preserves identity of untouched items and only replaces upserted keys', () => {
    const a = r('ns', 'a')
    const b = r('ns', 'b')
    const prev = [a, b]
    const bNew = r('ns', 'b', 1)
    const out = applyDeltaToList(prev, [bNew], [])
    expect(out).not.toBe(prev)
    expect(out.find((x) => x.name === 'a')).toBe(a) // untouched keeps identity
    expect(out.find((x) => x.name === 'b')).toBe(bNew) // upserted is the new object
  })

  it('removes keys and inserts new ones in (namespace, name) order', () => {
    const prev = [r('ns', 'a'), r('ns', 'c')]
    const out = applyDeltaToList(prev, [r('ns', 'b')], ['ns/c'])
    expect(out.map((x) => x.name)).toEqual(['a', 'b'])
  })

  it('sorts by namespace first, then name', () => {
    const out = applyDeltaToList<Row>(
      [],
      [r('zeta', 'a'), r('alpha', 'z'), r('alpha', 'a')],
      [],
    )
    expect(out.map((x) => `${x.namespace}/${x.name}`)).toEqual([
      'alpha/a',
      'alpha/z',
      'zeta/a',
    ])
  })

  it('treats removal of an absent key as a no-op (born-and-died safety)', () => {
    const prev = [r('ns', 'a')]
    const out = applyDeltaToList(prev, [], ['ns/ghost'])
    expect(out.map((x) => x.name)).toEqual(['a'])
  })

  it('an upsert supersedes a remove for the same key in one batch', () => {
    const prev = [r('ns', 'a', 0)]
    const out = applyDeltaToList(prev, [r('ns', 'a', 9)], ['ns/a'])
    expect(out).toHaveLength(1)
    expect(out[0].v).toBe(9)
  })

  it('interleaves new upserts into the sorted base regardless of upsert order', () => {
    const a = r('ns', 'a')
    const c = r('ns', 'c')
    const e = r('ns', 'e')
    const out = applyDeltaToList([a, c, e], [r('ns', 'd'), r('ns', 'b')], [])
    expect(out.map((x) => x.name)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(out.find((x) => x.name === 'a')).toBe(a) // untouched keep identity
    expect(out.find((x) => x.name === 'e')).toBe(e)
  })

  it('deltaKey joins namespace and name', () => {
    expect(deltaKey({ namespace: 'ns', name: 'a' })).toBe('ns/a')
    expect(deltaKey({ name: 'cluster-scoped' })).toBe('/cluster-scoped')
  })
})
