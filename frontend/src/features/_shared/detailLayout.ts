import { DETAIL_WIDTH_MIN, DETAIL_WIDTH_MAX } from '@/store/ui.types'

export const LIST_WIDTH_MIN = 400

export function detailLayout(available: number, preferred: number, expanded: boolean) {
  const canSplit = available >= DETAIL_WIDTH_MIN + LIST_WIDTH_MIN + 1
  const fullWidth = expanded || !canSplit
  return {
    canSplit,
    fullWidth,
    width: fullWidth ? available : Math.min(preferred, available - LIST_WIDTH_MIN - 1),
    maxWidth: Math.min(
      DETAIL_WIDTH_MAX,
      Math.max(DETAIL_WIDTH_MIN, available - LIST_WIDTH_MIN - 1),
    ),
  }
}

// Custom resource printer columns arrive as `pc:<name>` ("pc:Sync Status"), so
// match on the bare, lowercased name.
const columnKey = (id: string) => id.replace(/^pc:/, '').replace(/[^a-z]/gi, '').toLowerCase()

// The identity column comes first; the table gives it the flexible width and
// the namespace/context subline. Lists without a name column (Kyverno's
// PolicyReports lead with namespace and subject) use their first other column,
// since the subline already shows namespace and context.
export function compactColumnIds(ids: string[]) {
  const identity = ids.find((id) => columnKey(id) === 'name') ??
    ids.find((id) => id !== 'klustrContext' && id !== 'namespace') ?? ids[0]
  const statuses = ['status', 'phase', 'health', 'ready', 'syncstatus', 'restarts'].flatMap((key) =>
    ids.filter((id) => columnKey(id) === key),
  )
  const restarts = ids.find((id) => columnKey(id) === 'restarts')
  const chosen = [identity, statuses[0], restarts ?? statuses[1]]
  return new Set(chosen.filter((id): id is string => !!id))
}
