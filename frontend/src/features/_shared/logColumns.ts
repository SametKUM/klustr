// Column arithmetic for rendering log lines unwrapped. With autowrap off, xterm
// does not truncate an overlong line: every character past the right edge
// overwrites the last cell. So a line has to be cut to the viewport's width
// before it is written, measured the way xterm measures it — escape sequences
// take no columns, tabs run to the next multiple of 8, and the widths follow
// xterm's default Unicode 6 table (CJK is 2 columns, emoji 1, combining marks 0).
// A width this gets wrong costs at most a garbled last column, never a wrap.

const ESC = 0x1b
const TAB = 0x09
const TAB_WIDTH = 8
const SGR_RESET = '\x1b[0m'

// Printable ASCII only: nothing that could be an escape, a tab, a control or a
// multi-column character, so string length is the column count.
const NEEDS_SCAN = /[^\x20-\x7e]/
const ZERO_WIDTH = /[\p{Mn}\p{Me}\p{Cf}]/u

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    cp === 0x2329 ||
    cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x2fffd) ||
    (cp >= 0x30000 && cp <= 0x3fffd)
  )
}

function charWidth(cp: number): number {
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0
  if (cp < 0x300) return 1
  if (ZERO_WIDTH.test(String.fromCodePoint(cp))) return 0
  return isWide(cp) ? 2 : 1
}

function isControl(cp: number): boolean {
  return cp < 0x20 || (cp >= 0x7f && cp < 0xa0)
}

type Escape = { end: number; keep: boolean }

// Only SGR (colour) and OSC (hyperlinks) survive clipping. Anything that moves
// the cursor, erases or resets would break the one-row-per-line layout.
function readEscape(text: string, i: number): Escape {
  const kind = text.charCodeAt(i + 1)
  if (kind === 0x5b) {
    let j = i + 2
    while (j < text.length) {
      const c = text.charCodeAt(j++)
      if (c >= 0x40 && c <= 0x7e) return { end: j, keep: c === 0x6d }
    }
    return { end: j, keep: false }
  }
  if (kind === 0x5d || kind === 0x50 || kind === 0x58 || kind === 0x5e || kind === 0x5f) {
    let j = i + 2
    while (j < text.length) {
      const c = text.charCodeAt(j)
      if (c === 0x07) return { end: j + 1, keep: kind === 0x5d }
      if (c === ESC && text.charCodeAt(j + 1) === 0x5c) return { end: j + 2, keep: kind === 0x5d }
      j++
    }
    return { end: j, keep: false }
  }
  return { end: Math.min(i + 2, text.length), keep: false }
}

export function columnWidth(text: string): number {
  if (!NEEDS_SCAN.test(text)) return text.length
  let col = 0
  for (let i = 0; i < text.length; ) {
    const c = text.charCodeAt(i)
    if (c === ESC) {
      i = readEscape(text, i).end
      continue
    }
    if (c === TAB) {
      col = (Math.floor(col / TAB_WIDTH) + 1) * TAB_WIDTH
      i++
      continue
    }
    const cp = text.codePointAt(i)!
    col += charWidth(cp)
    i += cp > 0xffff ? 2 : 1
  }
  return col
}

// clipColumns returns the part of text that falls in columns [start, start +
// width). Colour sequences ahead of the window are kept, so a colour that
// starts off-screen still applies; a wide character or tab cut by either edge
// is padded with spaces so later columns do not shift.
export function clipColumns(text: string, start: number, width: number): string {
  if (width <= 0) return ''
  if (!NEEDS_SCAN.test(text)) return text.slice(start, start + width)
  const end = start + width
  let out = ''
  let styled = false
  let col = 0
  // A combining mark belongs to the character before it and is kept only when
  // that character made it into the window.
  let baseShown = false
  let i = 0
  while (i < text.length) {
    const c = text.charCodeAt(i)
    if (c === ESC) {
      const esc = readEscape(text, i)
      if (esc.keep) {
        out += text.slice(i, esc.end)
        styled = true
      }
      i = esc.end
      continue
    }
    if (c === TAB) {
      if (col >= end) break
      const next = (Math.floor(col / TAB_WIDTH) + 1) * TAB_WIDTH
      const shown = Math.min(next, end) - Math.max(col, start)
      if (shown > 0) out += ' '.repeat(shown)
      col = next
      baseShown = false
      i++
      continue
    }
    const cp = text.codePointAt(i)!
    const size = cp > 0xffff ? 2 : 1
    const w = charWidth(cp)
    if (w === 0) {
      if (baseShown && !isControl(cp)) out += text.slice(i, i + size)
      i += size
      continue
    }
    if (col >= end) break
    if (col >= start && col + w <= end) {
      out += text.slice(i, i + size)
      baseShown = true
    } else {
      const shown = Math.min(col + w, end) - Math.max(col, start)
      if (shown > 0) out += ' '.repeat(shown)
      baseShown = false
    }
    col += w
    i += size
  }
  // The cut can drop the reset that closed a colour; without one here the
  // colour would bleed into the next row.
  return styled ? out + SGR_RESET : out
}
