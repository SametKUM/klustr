// Parser + formatter for Kubernetes resource.Quantity strings as they
// arrive from the backend (e.g. "7962736Ki", "2Gi", "500m", "4").
// Tiny on purpose — the upstream k8s.io/apimachinery parser is far more
// expressive than anything we render in the UI.

const BINARY_SUFFIXES: Array<[string, number]> = [
  ['Ki', 1024],
  ['Mi', 1024 ** 2],
  ['Gi', 1024 ** 3],
  ['Ti', 1024 ** 4],
  ['Pi', 1024 ** 5],
  ['Ei', 1024 ** 6],
]

const DECIMAL_SUFFIXES: Array<[string, number]> = [
  ['n', 1e-9],
  ['u', 1e-6],
  ['m', 1e-3],
  ['k', 1e3],
  ['M', 1e6],
  ['G', 1e9],
  ['T', 1e12],
  ['P', 1e15],
  ['E', 1e18],
]

// parseQuantity returns the value in base units (bytes for memory,
// cores for cpu) or null if the input doesn't look like a quantity.
export function parseQuantity(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  for (const [suffix, mul] of BINARY_SUFFIXES) {
    if (s.endsWith(suffix)) {
      const n = Number(s.slice(0, -suffix.length))
      return Number.isFinite(n) ? n * mul : null
    }
  }
  for (const [suffix, mul] of DECIMAL_SUFFIXES) {
    if (s.endsWith(suffix)) {
      const n = Number(s.slice(0, -suffix.length))
      return Number.isFinite(n) ? n * mul : null
    }
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const MEMORY_UNITS = ['B', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei']

// formatMemoryQuantity turns a raw K8s memory quantity ("7962736Ki",
// "2Gi", "500M") into a compact binary string ("7.6Gi", "2Gi", "477Mi").
// Returns the raw input unchanged when it can't be parsed, so an
// unexpected suffix doesn't silently disappear from the UI.
export function formatMemoryQuantity(raw: string): string {
  if (!raw) return ''
  const bytes = parseQuantity(raw)
  if (bytes === null) return raw
  if (bytes <= 0) return '0'
  let v = bytes
  let i = 0
  while (v >= 1024 && i < MEMORY_UNITS.length - 1) {
    v /= 1024
    i++
  }
  const rounded = v.toFixed(v >= 100 || i === 0 ? 0 : 1)
  const trimmed = rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded
  return trimmed + MEMORY_UNITS[i]
}
