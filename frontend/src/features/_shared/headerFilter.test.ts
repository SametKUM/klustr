import { describe, expect, it } from 'vitest'
import { applyHeaderFilters, headerFilterOptions } from './headerFilter'

type Row = { status: string; node: string }

const rows: Row[] = [
  { status: 'Running', node: 'a' },
  { status: 'CrashLoopBackOff', node: 'b' },
  { status: 'Running', node: 'a' },
  { status: 'Completed', node: 'c' },
]

describe('headerFilterOptions', () => {
  it('returns sorted unique values', () => {
    expect(headerFilterOptions(rows, (r) => r.status, '')).toEqual([
      'Completed',
      'CrashLoopBackOff',
      'Running',
    ])
  })

  it('skips empty and non-string values', () => {
    const mixed = [{ v: '' }, { v: 'x' }, { v: null }, { v: 3 }]
    expect(headerFilterOptions(mixed, (r) => r.v, '')).toEqual(['x'])
  })

  it('keeps an active value that no longer occurs in the data', () => {
    expect(headerFilterOptions(rows, (r) => r.status, 'Evicted')).toContain('Evicted')
  })
})

describe('applyHeaderFilters', () => {
  const get = (row: Row, id: string) => row[id as keyof Row]

  it('returns the input untouched when nothing is active', () => {
    expect(applyHeaderFilters(rows, {}, get)).toBe(rows)
    expect(applyHeaderFilters(rows, { status: '' }, get)).toBe(rows)
  })

  it('matches exactly, not by substring', () => {
    expect(applyHeaderFilters(rows, { status: 'Running' }, get)).toHaveLength(2)
    expect(applyHeaderFilters(rows, { status: 'Run' }, get)).toHaveLength(0)
  })

  it('ANDs multiple active columns', () => {
    expect(applyHeaderFilters(rows, { status: 'Running', node: 'a' }, get)).toHaveLength(2)
    expect(applyHeaderFilters(rows, { status: 'Running', node: 'c' }, get)).toHaveLength(0)
  })
})
