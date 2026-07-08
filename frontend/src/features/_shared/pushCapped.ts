// pushCapped appends and, on overflow, drops the oldest 10% in one splice.
// A per-line shift() at the cap is O(n) (it reindexes the whole array), which
// is O(n²) over a high-volume stream; batch eviction is amortized O(1).
export function pushCapped<T>(buf: T[], item: T, cap: number): void {
  buf.push(item)
  if (buf.length > cap) buf.splice(0, Math.ceil(cap / 10))
}
