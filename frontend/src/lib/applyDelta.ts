// Applies an incremental delta (upserts + removed keys) to a resource list while
// preserving the object identity of untouched items — only changed keys get a
// new object — so memoized rows and the virtualizer bail out of re-rendering,
// the same identity guarantee stableList provides on the full-refetch path.
// Items are kept sorted by (namespace, name) to match the backend lister order.

type Identified = { namespace?: string; name?: string }

export function deltaKey(it: Identified): string {
  return `${it.namespace ?? ''}/${it.name ?? ''}`
}

function byNamespaceName(a: Identified, b: Identified): number {
  const an = a.namespace ?? ''
  const bn = b.namespace ?? ''
  if (an !== bn) return an < bn ? -1 : 1
  const am = a.name ?? ''
  const bm = b.name ?? ''
  if (am === bm) return 0
  return am < bm ? -1 : 1
}

export function applyDeltaToList<T extends Identified>(
  prev: readonly T[] | undefined,
  upserts: readonly T[],
  removed: readonly string[],
): T[] {
  const base = prev ?? []
  if (upserts.length === 0 && removed.length === 0) {
    return base as T[]
  }
  const byKey = new Map<string, T>()
  for (const it of base) byKey.set(deltaKey(it), it)
  for (const k of removed) byKey.delete(k)
  for (const u of upserts) byKey.set(deltaKey(u), u)
  const out = Array.from(byKey.values())
  out.sort(byNamespaceName)
  return out
}
