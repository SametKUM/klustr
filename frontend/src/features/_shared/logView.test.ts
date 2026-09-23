import { describe, expect, it } from 'vitest'
import { pickVisible, renderEntry, type LogEntry, type LogLine } from './logView'

function line(body: string, prefix = ''): LogLine {
  return { text: prefix + body, body, prefix, prefixWidth: prefix.length }
}

describe('pickVisible', () => {
  const entries: LogEntry[] = [
    { marker: '# streaming app' },
    line('keep 1'),
    line('drop 1'),
    line('keep 2'),
    { marker: '# stream closed' },
    line('keep 3'),
  ]
  const keep = (text: string) => text.startsWith('keep')

  it('keeps markers and the lines the filter matches, in order', () => {
    const shown = pickVisible(entries, entries.length, keep, 100)
    expect(shown.map((e) => ('marker' in e ? e.marker : e.text))).toEqual([
      '# streaming app',
      'keep 1',
      'keep 2',
      '# stream closed',
      'keep 3',
    ])
  })

  it('stops at end so lines held back while paused stay hidden', () => {
    const shown = pickVisible(entries, 3, keep, 100)
    expect(shown.map((e) => ('marker' in e ? e.marker : e.text))).toEqual(['# streaming app', 'keep 1'])
  })

  it('returns only the newest entries up to limit', () => {
    const shown = pickVisible(entries, entries.length, keep, 2)
    expect(shown.map((e) => ('marker' in e ? e.marker : e.text))).toEqual(['# stream closed', 'keep 3'])
  })
})

describe('renderEntry', () => {
  it('writes the whole line when wrapping', () => {
    expect(renderEntry(line('abcdefghij', 'pod | '), { wrap: true, offset: 4, cols: 8 })).toBe('pod | abcdefghij')
  })

  it('pins the prefix and scrolls only the body when unwrapped', () => {
    expect(renderEntry(line('abcdefghij', 'pod | '), { wrap: false, offset: 4, cols: 10 })).toBe('pod | efgh')
  })

  it('clips markers to the width without scrolling them', () => {
    expect(renderEntry({ marker: '# stream closed: EOF' }, { wrap: false, offset: 4, cols: 8 })).toBe('# stream')
  })

  it('shows what fits of the prefix when there is no room for the body', () => {
    expect(renderEntry(line('abc', 'long-pod-name | '), { wrap: false, offset: 0, cols: 4 })).toBe('long')
  })
})
