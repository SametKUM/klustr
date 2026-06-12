import { describe, expect, it } from 'vitest'
import { stableList } from './stableList'

type Item = { namespace?: string; name: string; status: string }

const a = { namespace: 'default', name: 'a', status: 'Running' }
const b = { namespace: 'default', name: 'b', status: 'Running' }

describe('stableList', () => {
  it('returns next when there is no previous list', () => {
    const next = [{ ...a }]
    expect(stableList(undefined, next)).toBe(next)
    expect(stableList([], next)).toBe(next)
  })

  it('returns the previous array when nothing changed', () => {
    const prev = [{ ...a }, { ...b }]
    const next = [{ ...a }, { ...b }]
    expect(stableList(prev, next)).toBe(prev)
  })

  it('reuses unchanged items when one item changed', () => {
    const prev = [{ ...a }, { ...b }]
    const next = [{ ...a }, { ...b, status: 'CrashLoopBackOff' }]
    const out = stableList(prev, next)
    expect(out).not.toBe(prev)
    expect(out[0]).toBe(prev[0])
    expect(out[1]).toBe(next[1])
  })

  it('reuses surviving items across an insertion', () => {
    const prev = [{ ...a }, { ...b }]
    const inserted = { namespace: 'default', name: 'aa', status: 'Pending' }
    const next = [{ ...a }, inserted, { ...b }]
    const out = stableList(prev, next)
    expect(out).toHaveLength(3)
    expect(out[0]).toBe(prev[0])
    expect(out[1]).toBe(inserted)
    expect(out[2]).toBe(prev[1])
  })

  it('reuses surviving items across a deletion', () => {
    const prev = [{ ...a }, { ...b }]
    const next = [{ ...b }]
    const out = stableList(prev, next)
    expect(out).toHaveLength(1)
    expect(out[0]).toBe(prev[1])
  })

  it('treats same-name items in different namespaces as distinct', () => {
    const prev: Item[] = [
      { namespace: 'one', name: 'x', status: 'Running' },
      { namespace: 'two', name: 'x', status: 'Running' },
    ]
    const next: Item[] = [
      { namespace: 'one', name: 'x', status: 'Running' },
      { namespace: 'two', name: 'x', status: 'Failed' },
    ]
    const out = stableList(prev, next)
    expect(out[0]).toBe(prev[0])
    expect(out[1]).toBe(next[1])
  })

  it('detects nested changes', () => {
    const prev = [{ name: 'a', containers: [{ name: 'c', tone: 'ready' }] }]
    const next = [{ name: 'a', containers: [{ name: 'c', tone: 'error' }] }]
    const out = stableList(prev, next)
    expect(out[0]).toBe(next[0])
  })

  it('falls back to positional identity for nameless items', () => {
    const prev = [{ value: 1 }, { value: 2 }]
    const next = [{ value: 1 }, { value: 3 }]
    const out = stableList(prev, next)
    expect(out[0]).toBe(prev[0])
    expect(out[1]).toBe(next[1])
  })

  it('returns the previous array even when item order is preserved by key reuse', () => {
    const prev = [{ ...a }, { ...b }]
    const out1 = stableList(prev, [{ ...a }, { ...b }])
    const out2 = stableList(out1, [{ ...a }, { ...b }])
    expect(out2).toBe(prev)
  })
})
