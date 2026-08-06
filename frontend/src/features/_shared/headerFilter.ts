// Exact-match column filters, offered as a dropdown in the column header.
// Options are derived from the rows themselves, so the menu can only offer
// values that are actually on screen.

export function headerFilterOptions<R>(
  rows: R[],
  get: (row: R) => unknown,
  active: string,
): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const v = get(row)
    if (typeof v === 'string' && v) seen.add(v)
  }
  // A filter whose value has disappeared from the data still belongs in the
  // menu — otherwise the table is empty and nothing in the open dropdown shows
  // why.
  if (active) seen.add(active)
  return [...seen].sort((a, b) => a.localeCompare(b))
}

export function applyHeaderFilters<R>(
  rows: R[],
  values: Record<string, string>,
  get: (row: R, columnId: string) => unknown,
): R[] {
  const active = Object.entries(values).filter(([, v]) => v)
  if (active.length === 0) return rows
  return rows.filter((row) => active.every(([id, v]) => get(row, id) === v))
}
