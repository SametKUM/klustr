export type NamespaceQuery = {
  apiNamespace: string
  matches: (namespace: string) => boolean
}

export function namespaceQuery(selected: readonly string[]): NamespaceQuery {
  // Sanitize before branching: persisted selections may carry duplicates or
  // an empty entry, and either would corrupt the comma-encoded set below.
  const uniq = [...new Set(selected)].filter((ns) => ns !== '').sort()
  if (uniq.length === 0) {
    return { apiNamespace: '', matches: () => true }
  }
  if (uniq.length === 1) {
    const only = uniq[0]
    return { apiNamespace: only, matches: (ns) => ns === only }
  }
  // The backend understands a comma-separated namespace set (namespace names
  // cannot contain commas) and lists each one from the informer cache, so a
  // multi-namespace selection no longer fetches the whole cluster.
  const set = new Set(uniq)
  return { apiNamespace: uniq.join(','), matches: (ns) => set.has(ns) }
}

export function namespaceLabel(selected: readonly string[]): string {
  if (selected.length === 0) return 'All namespaces'
  if (selected.length === 1) return selected[0]
  return `${selected.length} namespaces`
}
