import { describe, expect, it } from 'vitest'
import { pushCapped } from './pushCapped'

describe('pushCapped', () => {
  it('stays bounded, preserves order, and drops the oldest first', () => {
    const cap = 100
    const buf: number[] = []
    for (let i = 0; i < 10_000; i++) pushCapped(buf, i, cap)

    // Batch eviction keeps it at or below cap + one push, never unbounded.
    expect(buf.length).toBeLessThanOrEqual(cap + 1)
    // Order preserved and it's the most-recent tail (oldest evicted).
    expect(buf[buf.length - 1]).toBe(9999)
    for (let i = 1; i < buf.length; i++) expect(buf[i]).toBe(buf[i - 1] + 1)
  })
})
