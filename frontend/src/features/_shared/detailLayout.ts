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

export function compactColumnIds(ids: string[]) {
  const identity = ids.find((id) => id.toLowerCase() === 'name') ?? ids[0]
  const statuses = ['status', 'phase', 'health', 'ready', 'syncStatus', 'restarts'].filter((id) =>
    ids.includes(id),
  )
  const chosen = [identity, statuses[0], ids.includes('restarts') ? 'restarts' : statuses[1]]
  return new Set(chosen.filter((id): id is string => !!id))
}
