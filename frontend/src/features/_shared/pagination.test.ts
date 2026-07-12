import { describe, expect, it } from 'vitest'
import { resourcePageCount } from './pagination'

describe('resourcePageCount', () => {
  it('keeps every partial page reachable', () => {
    expect(resourcePageCount(283, 100)).toBe(3)
    expect(resourcePageCount(200, 100)).toBe(2)
    expect(resourcePageCount(1, 100)).toBe(1)
  })

  it('uses one page for empty and all-rows modes', () => {
    expect(resourcePageCount(0, 100)).toBe(1)
    expect(resourcePageCount(283, 0)).toBe(1)
  })
})
