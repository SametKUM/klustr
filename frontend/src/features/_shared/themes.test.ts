import { describe, expect, it } from 'vitest'
import { DEFAULT_DARK, DEFAULT_LIGHT, THEMES, THEME_FAMILIES, familyTheme, themeInMode } from './themes'

describe('theme families', () => {
  it('gives every theme a listed family and at most one theme per family and mode', () => {
    const families = new Set(THEME_FAMILIES.map((f) => f.id))
    const seen = new Set<string>()
    for (const t of THEMES) {
      expect(families.has(t.family)).toBe(true)
      const key = `${t.family}/${t.mode}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('finds a family variant by mode', () => {
    expect(familyTheme('dracula', 'light')?.id).toBe('dracula-light')
    expect(familyTheme('one', 'dark')?.id).toBe('one-dark')
    expect(familyTheme('tokyo-night', 'light')).toBeUndefined()
  })

  it('toggles to the same family in the other mode', () => {
    expect(themeInMode('dracula', 'light')).toBe('dracula-light')
    expect(themeInMode('nord-light', 'dark')).toBe('nord')
    expect(themeInMode('default-dark', 'light')).toBe(DEFAULT_LIGHT)
    expect(themeInMode('monokai', 'dark')).toBe('monokai')
  })

  it("falls back to the mode's default theme when the family has no variant", () => {
    expect(themeInMode('tokyo-night', 'light')).toBe(DEFAULT_LIGHT)
    expect(themeInMode('tokyo-night', 'dark')).toBe('tokyo-night')
    expect(themeInMode(DEFAULT_LIGHT, 'dark')).toBe(DEFAULT_DARK)
  })
})
