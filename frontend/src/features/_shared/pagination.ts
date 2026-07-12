export function resourcePageCount(rowCount: number, pageSize: number): number {
  if (rowCount <= 0 || pageSize <= 0) return 1
  return Math.max(1, Math.ceil(rowCount / pageSize))
}
