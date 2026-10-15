import type { ManifestKind } from '@/lib/api'

export function resourceKindKey(mapping: ManifestKind): string {
  return `${mapping.apiVersion}/${mapping.resource}`
}

export function filterResourceKinds(resources: ManifestKind[], search: string): ManifestKind[] {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  return resources
    .filter((mapping) => {
      const key = resourceKindKey(mapping)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((mapping) => {
      const kind = mapping.kind.toLowerCase()
      const resource = mapping.resource.toLowerCase()
      const apiVersion = mapping.apiVersion.toLowerCase()
      let rank = 0
      for (const term of terms) {
        if (kind === term) continue
        if (resource === term) rank += 1
        else if (kind.startsWith(term)) rank += 2
        else if (resource.startsWith(term)) rank += 3
        else if (kind.includes(term) || resource.includes(term)) rank += 4
        else if (apiVersion.includes(term)) rank += 5
        else return { mapping, rank: -1 }
      }
      return { mapping, rank }
    })
    .filter(({ rank }) => rank >= 0)
    // Stable ties preserve discovery's preferred-version ordering.
    .sort((a, b) => a.rank - b.rank)
    .map(({ mapping }) => mapping)
}
