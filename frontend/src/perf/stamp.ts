// The stamp app/perfprobe.go appends to every event, and how events group.

export type Stamp = { t: number; bytes: number }

// Per-session events end in a session id; group them by kind, as Go does.
const STREAM_PREFIXES = ['pod:logs:line:', 'pod:logs:close:', 'exec:out:', 'exec:close:', 'term:out:', 'term:close:']

export function eventGroup(name: string): string {
  const prefix = STREAM_PREFIXES.find((p) => name.startsWith(p))
  return prefix ? prefix.slice(0, -1) : name
}

export function stampOf(value: unknown): Stamp | null {
  if (typeof value !== 'object' || value === null || !('__klustrPerf' in value)) return null
  const stamp = (value as { __klustrPerf: unknown }).__klustrPerf
  if (typeof stamp !== 'object' || stamp === null) return null
  const { t, bytes } = stamp as Record<string, unknown>
  return typeof t === 'number' && typeof bytes === 'number' ? { t, bytes } : null
}
