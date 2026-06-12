// Re-fetching a list after a kube:change replaces every item's object identity
// even when nothing actually changed, which cascades into full table re-renders.
// stableList merges a fresh fetch result against the previous list, reusing the
// previous object for items whose serialized form is unchanged — and the
// previous array itself when nothing changed at all — so referential equality
// survives refetches and React/TanStack can bail out of re-rendering.

const serializedCache = new WeakMap<object, string>()

function serialize(item: unknown): string {
  if (typeof item !== 'object' || item === null) return JSON.stringify(item)
  let s = serializedCache.get(item)
  if (s === undefined) {
    s = JSON.stringify(item)
    serializedCache.set(item, s)
  }
  return s
}

type Identity = { namespace?: string; name?: string }

// Namespace/name identify an item within one (context, kind) list; K8s names
// cannot contain '/', so the '#index' fallback for nameless shapes can't collide.
function itemKey(item: unknown, index: number): string {
  const id = item as Identity
  if (typeof id?.name === 'string' && id.name !== '') {
    return `${id.namespace ?? ''}/${id.name}`
  }
  return `#${index}`
}

export function stableList<T>(prev: readonly T[] | undefined, next: T[]): T[] {
  if (prev && prev.length === 0 && next.length === 0) return prev as T[]
  if (!prev || prev.length === 0) return next
  const prevByKey = new Map<string, T>()
  prev.forEach((p, i) => prevByKey.set(itemKey(p, i), p))
  let unchanged = prev.length === next.length
  const out = next.map((n, i) => {
    const p = prevByKey.get(itemKey(n, i))
    if (p !== undefined && serialize(p) === serialize(n)) {
      if (unchanged && prev[i] !== p) unchanged = false
      return p
    }
    unchanged = false
    return n
  })
  return unchanged ? (prev as T[]) : out
}
