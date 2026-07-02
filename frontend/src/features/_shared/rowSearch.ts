// Whole-row table search. Every term must match somewhere in the row (AND),
// values are flattened recursively so arrays and nested objects (hostnames,
// ports, subjects, …) are searchable, and a `column:value` term scopes the
// match to columns whose id starts with that prefix.

export type SearchTerm = { raw: string; column?: string; text: string }

export function parseSearch(query: string): SearchTerm[] {
  const terms: SearchTerm[] = []
  for (const token of query.trim().split(/\s+/)) {
    if (!token) continue
    const raw = token.toLowerCase()
    const idx = raw.indexOf(':')
    if (idx > 0 && idx < raw.length - 1) {
      terms.push({ raw, column: raw.slice(0, idx), text: raw.slice(idx + 1) })
    } else {
      terms.push({ raw, text: raw })
    }
  }
  return terms
}

const MAX_DEPTH = 4

function collect(v: unknown, out: string[], depth: number): void {
  if (v == null) return
  switch (typeof v) {
    case 'string':
      if (v) out.push(v.toLowerCase())
      return
    case 'number':
    case 'boolean':
      out.push(String(v))
      return
    case 'object':
      if (depth >= MAX_DEPTH) return
      if (Array.isArray(v)) {
        for (const x of v) collect(x, out, depth + 1)
      } else {
        for (const x of Object.values(v)) collect(x, out, depth + 1)
      }
  }
}

export function searchText(v: unknown): string {
  const out: string[] = []
  collect(v, out, 0)
  return out.join(' ')
}

// Rows are referentially stable across re-merges (stableList + the tagged-twin
// cache), so the flattened haystack is computed once per row object, not once
// per keystroke.
const haystackCache = new WeakMap<object, string>()

function rowHaystack(row: object): string {
  let h = haystackCache.get(row)
  if (h === undefined) {
    h = searchText(row)
    haystackCache.set(row, h)
  }
  return h
}

export function rowMatchesSearch(
  row: object,
  terms: SearchTerm[],
  columnIds: string[],
  getColumnValue: (row: object, columnId: string) => unknown,
): boolean {
  for (const t of terms) {
    if (t.column !== undefined) {
      const cols = columnIds.filter((id) => id.startsWith(t.column as string))
      if (cols.length > 0) {
        if (!cols.some((id) => searchText(getColumnValue(row, id)).includes(t.text))) return false
        continue
      }
      // No column with that prefix: the colon is part of the value
      // (10:30, http://…) — fall through to a literal whole-row match.
    }
    if (!rowHaystack(row).includes(t.raw)) return false
  }
  return true
}
