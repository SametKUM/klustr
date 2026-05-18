import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { crdKey } from '@/store/crds'
import type { CRDInfo } from '@/lib/api'

type Props = {
  crds: CRDInfo[]
  expandedGroups: string[]
  toggleGroup: (label: string) => void
  selectedCRDKey: string | null
  onSelect: (key: string | null) => void
}

const ROOT_LABEL = 'root'
const SUBGROUP_PREFIX = 'group:'

export function CRDGroups({
  crds,
  expandedGroups,
  toggleGroup,
  selectedCRDKey,
  onSelect,
}: Props) {
  const grouped = useMemo(() => groupByAPIGroup(crds), [crds])
  const rootExpanded = expandedGroups.includes(ROOT_LABEL)

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleGroup(ROOT_LABEL)}
        aria-expanded={rootExpanded}
        className="flex w-full items-center gap-1 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground"
      >
        <ChevronRight
          className={`size-3 shrink-0 transition-transform ${rootExpanded ? 'rotate-90' : ''}`}
        />
        <span>Custom Resources</span>
        <span className="ml-1 text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
          {crds.length}
        </span>
      </button>
      {rootExpanded && grouped.length === 0 && (
        <div className="px-2 py-1 text-xs text-muted-foreground/70">
          No CRDs found in this cluster.
        </div>
      )}
      {rootExpanded && grouped.length > 0 && (
        <div className="flex flex-col gap-1">
          {grouped.map((g) => {
            const subLabel = SUBGROUP_PREFIX + g.group
            const subExpanded = expandedGroups.includes(subLabel)
            return (
              <div key={g.group} className="pl-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(subLabel)}
                  aria-expanded={subExpanded}
                  className="flex w-full items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-sidebar-foreground"
                  title={g.group}
                >
                  <ChevronRight
                    className={`size-3 shrink-0 transition-transform ${subExpanded ? 'rotate-90' : ''}`}
                  />
                  <span className="truncate">{g.group}</span>
                </button>
                {subExpanded && (
                  <ul className="flex flex-col pl-3">
                    {g.crds.map((crd) => {
                      const key = crdKey(crd)
                      const active = selectedCRDKey === key
                      return (
                        <li
                          key={key}
                          className={[
                            'cursor-pointer rounded px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                            active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : '',
                          ].join(' ')}
                          title={`${crd.kind} (${crd.group}/${crd.version})`}
                          onClick={() => onSelect(key)}
                        >
                          {crd.kind}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type GroupedCRDs = {
  group: string
  crds: CRDInfo[]
}

function groupByAPIGroup(crds: CRDInfo[]): GroupedCRDs[] {
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
