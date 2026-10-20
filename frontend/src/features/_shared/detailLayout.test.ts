import { describe, expect, it } from 'vitest'
import { compactColumnIds, detailLayout, LIST_WIDTH_MIN } from './detailLayout'
import { clampDetailWidth } from '@/store/ui.persistence'

describe('resource inspector layout', () => {
  it('fits the default window with its expanded sidebar', () => {
    const layout = detailLayout(1280 - 256, 560, false)
    expect(layout).toMatchObject({ fullWidth: false, width: 560 })
    expect(1024 - layout.width - 1).toBeGreaterThanOrEqual(LIST_WIDTH_MIN)
  })

  it('uses the workspace width rather than the window width for its fallback', () => {
    expect(detailLayout(860, 560, false).fullWidth).toBe(true)
    expect(detailLayout(1600, 560, true).fullWidth).toBe(true)
    expect(detailLayout(960, 900, false).width).toBe(559)
  })

  it('validates persisted sizes', () => {
    expect(clampDetailWidth(Number.NaN)).toBe(560)
    expect(clampDetailWidth(-1)).toBe(480)
    expect(clampDetailWidth(2000)).toBe(960)
  })

  it('keeps identity, failure status and restarts in compact pod lists', () => {
    const columns = [
      'klustrContext',
      'namespace',
      'name',
      'usage',
      'ready',
      'status',
      'restarts',
      'node',
    ]
    expect([...compactColumnIds(columns)]).toEqual(['name', 'status', 'restarts'])
    expect(columns).toContain('namespace')
  })

  it('keeps custom resource printer columns and leads with the identity column', () => {
    expect([...compactColumnIds(['namespace', 'name', 'pc:Ready', 'pc:Sync Status', 'createdAt'])])
      .toEqual(['name', 'pc:Ready', 'pc:Sync Status'])
  })

  it('leads with the subject of lists that have no name column', () => {
    expect([...compactColumnIds(['klustrContext', 'namespace', 'subject', 'source', 'createdAt'])][0]).toBe('subject')
  })
})
