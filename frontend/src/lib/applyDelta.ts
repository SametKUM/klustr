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
  // base is already sorted (the backend lister sorts, and this function keeps
  // it sorted); upserts arrive in Go map order, so sort only that small slice
  // and two-pointer merge into base — O(n + m·log m) with no full-list Map or
  // re-sort. removed/overridden base items are skipped; an upsert always wins
  // over a same-key removal in the same batch since it's emitted from `ups`.
  const ups = upserts.length > 1 ? [...upserts].sort(byNamespaceName) : upserts
  const removedSet = removed.length > 0 ? new Set(removed) : null
  const upKeys = ups.length > 0 ? new Set(ups.map(deltaKey)) : null
  const skip = (it: T): boolean => {
    const k = deltaKey(it)
    return (removedSet?.has(k) ?? false) || (upKeys?.has(k) ?? false)
  }
  const out: T[] = []
  let i = 0
  let j = 0
  while (i < base.length && j < ups.length) {
    if (skip(base[i])) {
      i++
      continue
    }
    if (byNamespaceName(base[i], ups[j]) <= 0) {
      out.push(base[i])
      i++
    } else {
      out.push(ups[j])
      j++
    }
  }
  for (; i < base.length; i++) {
    if (!skip(base[i])) out.push(base[i])
  }
  for (; j < ups.length; j++) out.push(ups[j])
  return out
}
