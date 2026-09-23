import { describe, expect, it } from 'vitest'
import { clipColumns, columnWidth } from './logColumns'

const RED = '\x1b[31m'
const RESET = '\x1b[0m'

describe('columnWidth', () => {
  it('counts printable ASCII by length', () => {
    expect(columnWidth('GET /healthz 200')).toBe(16)
  })

  it('gives escape sequences no width', () => {
    expect(columnWidth(`${RED}red${RESET}`)).toBe(3)
    expect(columnWidth('\x1b]8;;https://example.com\x07link\x1b]8;;\x07')).toBe(4)
  })

  it('runs tabs to the next multiple of 8', () => {
    expect(columnWidth('a\tb')).toBe(9)
    expect(columnWidth('\tat com.example.Main')).toBe(8 + 19)
  })

  it('follows the Unicode 6 widths xterm uses by default', () => {
    expect(columnWidth('日本')).toBe(4)
    expect(columnWidth('😀')).toBe(1)
    expect(columnWidth('é')).toBe(1)
  })
})

describe('clipColumns', () => {
  it('slices plain ASCII', () => {
    expect(clipColumns('abcdefghij', 2, 3)).toBe('cde')
    expect(clipColumns('abc', 5, 3)).toBe('')
    expect(clipColumns('abc', 0, 0)).toBe('')
  })

  it('keeps a colour that starts before the window and closes it after the cut', () => {
    expect(clipColumns(`${RED}abcdef${RESET}`, 2, 2)).toBe(`${RED}cd${RESET}`)
  })

  it('drops escapes that would move the cursor or erase', () => {
    expect(clipColumns('ab\x1b[2Kcd\x1b[1;1H', 0, 10)).toBe('abcd')
    expect(clipColumns('ab\x1bccd', 0, 10)).toBe('abcd')
  })

  it('drops control characters', () => {
    expect(clipColumns('ab\rcd\x07', 0, 10)).toBe('abcd')
  })

  it('pads a wide character cut by either edge', () => {
    expect(clipColumns('日本語', 1, 4)).toBe(' 本 ')
  })

  it('expands tabs so the window does not depend on tab stops', () => {
    expect(clipColumns('a\tb', 0, 10)).toBe('a       b')
    expect(clipColumns('a\tb', 4, 10)).toBe('    b')
  })

  it('keeps a combining mark only with its base character', () => {
    expect(clipColumns('abéx', 0, 3)).toBe('abé')
    expect(clipColumns('ébc', 1, 2)).toBe('bc')
  })

  it('never splits a surrogate pair', () => {
    expect(clipColumns('😀ab', 1, 2)).toBe('ab')
    expect(clipColumns('a😀b', 1, 1)).toBe('😀')
  })

  it('fills exactly the overlap of the window and the line', () => {
    const lines = [
      'plain ascii line with some words in it',
      `${RED}2026-09-23T10:00:00Z${RESET} level=error msg="boom"`,
      '\tat com.example.Main.run(Main.java:42)',
      '日本語のログ 行 with mixed 한국어 text',
      'emoji 😀 and é combining \x1b]8;;https://x.test\x07link\x1b]8;;\x07',
    ]
    for (const line of lines) {
      const total = columnWidth(line)
      for (let start = 0; start <= total + 2; start += 3) {
        for (const width of [1, 2, 5, 13, 80]) {
          const clipped = clipColumns(line, start, width)
          expect(columnWidth(clipped)).toBe(Math.max(0, Math.min(start + width, total) - start))
        }
      }
    }
  })
})
