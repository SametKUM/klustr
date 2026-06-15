import { crdKey } from '@/store/crds'
import type { CRDInfo } from '@/lib/api'

export const ROOT_LABEL = 'root'
export const SUBGROUP_PREFIX = 'group:'

export type GroupedCRDs = {
  group: string
  crds: CRDInfo[]
}

export function groupByAPIGroup(crds: CRDInfo[]): GroupedCRDs[] {
  const map = new Map<string, CRDInfo[]>()
  for (const c of crds) {
    const list = map.get(c.group) ?? []
    list.push(c)
    map.set(c.group, list)
  }
  const out: GroupedCRDs[] = []
  for (const [group, list] of map) {
    list.sort((a, b) => a.kind.localeCompare(b.kind))
    out.push({ group, crds: list })
  }
  out.sort((a, b) => a.group.localeCompare(b.group))
  return out
}

// orderedCRDKeys returns CRD keys in the exact order CRDGroups renders them
// (API group asc, then kind asc), so sidebar arrow-key navigation can treat
// CRDs as a continuation of the builtin nav list. When expandedGroups is
// given, only the currently-visible CRDs (root + their subgroup expanded) are
// returned, matching what the user can actually see.
export function orderedCRDKeys(crds: CRDInfo[], expandedGroups?: string[]): string[] {
  const groups = groupByAPIGroup(crds)
  if (!expandedGroups) {
    return groups.flatMap((g) => g.crds.map((c) => crdKey(c)))
  }
  if (!expandedGroups.includes(ROOT_LABEL)) return []
  return groups
    .filter((g) => expandedGroups.includes(SUBGROUP_PREFIX + g.group))
    .flatMap((g) => g.crds.map((c) => crdKey(c)))
}
