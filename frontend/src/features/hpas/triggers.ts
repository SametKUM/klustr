// Humanizes the KEDA trigger summary strings the backend builds in
// internal/kube/keda.go (e.g. "cron (start=0 1 * * 1-5 end=55 4 * * 1-5
// desiredReplicas=5 timezone=Europe/Istanbul)"). Cron triggers collapse into a
// single readable window; every other trigger type is branded and its
// key=value metadata is spaced out. Anything outside the safe cron subset
// falls back to the raw string so we never show a wrong schedule.

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const BRAND: Record<string, string> = {
  prometheus: 'Prometheus',
  kafka: 'Kafka',
  rabbitmq: 'RabbitMQ',
  'aws-sqs-queue': 'AWS SQS',
  redis: 'Redis',
  'redis-streams': 'Redis Streams',
  'redis-cluster': 'Redis',
  'redis-sentinel': 'Redis',
  cpu: 'CPU',
  memory: 'Memory',
  external: 'External',
  'external-push': 'External',
  'azure-servicebus': 'Azure Service Bus',
  'gcp-pubsub': 'Pub/Sub',
  datadog: 'Datadog',
}

export function humanizeTrigger(text: string): string {
  if (!text) return text
  const m = /^([a-z0-9-]+)\s*\((.*)\)\s*$/i.exec(text)
  if (!m) return text
  const [, type, inner] = m
  if (type === 'cron') {
    return humanizeCron(inner) ?? text
  }
  return humanizeGeneric(type, inner)
}

function humanizeCron(inner: string): string | null {
  const fields = parseOrderedFields(inner, ['start', 'end', 'desiredReplicas', 'timezone'])
  const start = fields.start ? describeCron(fields.start) : null
  const end = fields.end ? describeCron(fields.end) : null
  if (!start || !end) return null

  const window =
    start.days === end.days
      ? `${start.days} ${start.time} → ${end.time}`
      : `${start.days} ${start.time} → ${end.days} ${end.time}`

  const parts = [window]
  if (fields.desiredReplicas) {
    const n = fields.desiredReplicas
    parts.push(`${n} ${n === '1' ? 'replica' : 'replicas'}`)
  }
  let out = parts.join(' · ')
  if (fields.timezone) out += ` · ${fields.timezone}`
  return out
}

function describeCron(expr: string): { time: string; days: string } | null {
  const f = expr.trim().split(/\s+/)
  if (f.length !== 5) return null
  const [min, hour, dom, mon, dow] = f
  if (!/^\d{1,2}$/.test(min) || !/^\d{1,2}$/.test(hour)) return null
  const mi = Number(min)
  const hr = Number(hour)
  if (mi > 59 || hr > 23) return null
  if (dom !== '*' || mon !== '*') return null
  const days = describeDow(dow)
  if (days === null) return null
  return { time: `${pad(hr)}:${pad(mi)}`, days }
}

function describeDow(dow: string): string | null {
  if (dow === '*' || dow === '?') return 'Daily'
  const out: string[] = []
  for (const item of dow.split(',')) {
    const range = /^(\d)-(\d)$/.exec(item)
    if (range) {
      const a = Number(range[1])
      const b = Number(range[2])
      // Bail on out-of-range or wrap-around (e.g. 5-1 = Fri..Mon): rendering it
      // as "Fri–Mon" reads backwards, so fall back to the raw cron text rather
      // than show a confidently wrong schedule.
      if (a > 6 || b > 6 || b < a) return null
      out.push(`${DOW[a]}–${DOW[b]}`)
      continue
    }
    if (/^\d$/.test(item)) {
      const n = Number(item)
      if (n > 6) return null
      out.push(DOW[n])
      continue
    }
    return null
  }
  return out.join(', ')
}

function humanizeGeneric(type: string, inner: string): string {
  const brand = BRAND[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
  const segs: string[] = []
  for (const token of inner.split(/\s+/)) {
    const eq = token.indexOf('=')
    if (eq < 0) continue
    const key = token.slice(0, eq)
    let val = token.slice(eq + 1)
    if (!val) continue
    if (/url$/i.test(key) && val.includes('/')) {
      val = val.split('/').filter(Boolean).pop() ?? val
    }
    segs.push(`${spaceCamel(key)} ${val}`)
  }
  return segs.length ? `${brand} · ${segs.join(' · ')}` : brand
}

function parseOrderedFields(inner: string, keys: string[]): Record<string, string> {
  const found = keys
    .map((k) => ({ k, i: inner.indexOf(`${k}=`) }))
    .filter((p) => p.i >= 0)
    .sort((a, b) => a.i - b.i)
  const result: Record<string, string> = {}
  for (let j = 0; j < found.length; j++) {
    const valueStart = found[j].i + found[j].k.length + 1
    const valueEnd = j + 1 < found.length ? found[j + 1].i : inner.length
    result[found[j].k] = inner.slice(valueStart, valueEnd).trim()
  }
  return result
}

function spaceCamel(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
