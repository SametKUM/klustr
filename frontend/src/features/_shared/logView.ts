import { clipColumns, columnWidth } from './logColumns'
import { highlightLogContent } from './logHighlight'

// A retained log line. text is what the filter matches and Save writes, body is
// the line as the container printed it, and prefix is pre-styled and stays
// pinned while unwrapped lines scroll sideways. styled and width are filled in
// on first use.
export type LogLine = {
  text: string
  body: string
  prefix: string
  prefixWidth: number
  styled?: string
  width?: number
}

// A status line the view writes itself (stream header, closed or failed
// notices). Markers bypass the filter and never scroll sideways.
export type LogMarker = { marker: string }

export type LogEntry = LogLine | LogMarker

export type LogLayout = { wrap: boolean; offset: number; cols: number }

export function isMarker(entry: LogEntry): entry is LogMarker {
  return 'marker' in entry
}

export function lineColumns(line: LogLine): number {
  line.width ??= columnWidth(line.body)
  return line.prefixWidth + line.width
}

// Walks back from end, so a repaint only touches entries that can still fit in
// the terminal's scrollback.
export function pickVisible(
  entries: LogEntry[],
  end: number,
  predicate: (text: string) => boolean,
  limit: number,
): LogEntry[] {
  const out: LogEntry[] = []
  for (let i = Math.min(end, entries.length) - 1; i >= 0 && out.length < limit; i--) {
    const entry = entries[i]
    if (isMarker(entry) || predicate(entry.text)) out.push(entry)
  }
  return out.reverse()
}

export function renderEntry(entry: LogEntry, layout: LogLayout): string {
  if (isMarker(entry)) return layout.wrap ? entry.marker : clipColumns(entry.marker, 0, layout.cols)
  entry.styled ??= highlightLogContent(entry.body)
  if (layout.wrap) return entry.prefix + entry.styled
  const room = layout.cols - entry.prefixWidth
  if (room <= 0) return clipColumns(entry.prefix, 0, layout.cols)
  return entry.prefix + clipColumns(entry.styled, layout.offset, room)
}
