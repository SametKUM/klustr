// Types a test fixture as an API model. The Wails v3 models are plain
// interfaces; this stands in for the createFrom of v2's generated classes,
// which also accepted any partial object.
export function model<T>(value: unknown): T {
  return value as T
}
