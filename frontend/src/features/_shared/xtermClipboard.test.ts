import { describe, expect, it } from 'vitest'
import { clipboardActionFor } from './xtermClipboard'

type Chord = Parameters<typeof clipboardActionFor>[0]

function chord(key: string, mods: Partial<Chord> = {}): Chord {
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key
  return { key, code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods }
}

const linux = { isMac: false }

describe('clipboardActionFor', () => {
  it('binds the terminal-convention chords on Linux/Windows', () => {
    expect(clipboardActionFor(chord('C', { ctrlKey: true, shiftKey: true }), { ...linux, hasSelection: false })).toBe('copy')
    expect(clipboardActionFor(chord('V', { ctrlKey: true, shiftKey: true }), { ...linux, hasSelection: false })).toBe('paste')
    expect(clipboardActionFor(chord('Insert', { ctrlKey: true }), { ...linux, hasSelection: false })).toBe('copy')
    expect(clipboardActionFor(chord('Insert', { shiftKey: true }), { ...linux, hasSelection: false })).toBe('paste')
  })

  it('matches by physical key so non-QWERTY layouts still work', () => {
    const ev = { ...chord('C', { ctrlKey: true, shiftKey: true }), key: 'Ц' }
    expect(clipboardActionFor(ev, { ...linux, hasSelection: false })).toBe('copy')
  })

  it('turns plain Ctrl+C into copy only while text is selected', () => {
    const ctrlC = chord('c', { ctrlKey: true })
    expect(clipboardActionFor(ctrlC, { ...linux, hasSelection: true })).toBe('copy')
    expect(clipboardActionFor(ctrlC, { ...linux, hasSelection: false })).toBeNull()
  })

  it('never hijacks plain Ctrl+V — that stays the ^V control byte', () => {
    expect(clipboardActionFor(chord('v', { ctrlKey: true }), { ...linux, hasSelection: true })).toBeNull()
  })

  it('leaves Insert alone without a modifier and with both', () => {
    expect(clipboardActionFor(chord('Insert'), { ...linux, hasSelection: true })).toBeNull()
    expect(clipboardActionFor(chord('Insert', { ctrlKey: true, shiftKey: true }), { ...linux, hasSelection: true })).toBeNull()
  })

  it('ignores Alt and Meta chords', () => {
    expect(clipboardActionFor(chord('C', { ctrlKey: true, shiftKey: true, altKey: true }), { ...linux, hasSelection: true })).toBeNull()
    expect(clipboardActionFor(chord('c', { metaKey: true }), { ...linux, hasSelection: true })).toBeNull()
  })

  it('stays out of the way on macOS, where the native Edit menu already works', () => {
    const mac = { isMac: true, hasSelection: true }
    expect(clipboardActionFor(chord('C', { ctrlKey: true, shiftKey: true }), mac)).toBeNull()
    expect(clipboardActionFor(chord('c', { ctrlKey: true }), mac)).toBeNull()
    expect(clipboardActionFor(chord('Insert', { shiftKey: true }), mac)).toBeNull()
  })
})
