// Perf probe for hack/perf. Bundled only when the frontend is built with
// VITE_KLUSTR_PERF=1, and only useful against a Go build with -tags perfprobe
// (app/perfprobe.go), which appends a stamp argument to every event.
//
// It instruments the bridge from the outside, so no call site changes:
// - events: the listener wrapper of src/lib/runtime.ts strips every event's
//   stamp before the listener runs, and records the delivery latency, size and
//   handler time;
// - bindings: every method of the api object is wrapped to record its round
//   trip, under the Go method's name;
// - the main thread: timer lateness and frame intervals, per scenario phase.
// The report goes back to Go as one perf:report event.

import { api } from '@/lib/api'
import { EventsEmit, setListenerWrapper } from '@/lib/runtime'
import { runScenario } from './scenario'
import { eventGroup, stampOf, type Stamp } from './stamp'

type Binding = (...args: unknown[]) => Promise<unknown>

// U+F033D, the rune log-steady writes into every tenth line.
const ICON = '\u{F033D}'

type EventRecord = [phase: number, group: number, latencyUs: number, bytes: number, handleUs: number]
type CallRecord = [phase: number, method: string, ms: number, items: number, ok: 0 | 1]
type Phase = { name: string; startMs: number; endMs: number | null }

export type ExecWatcher = (sessionId: string, data: string) => void
export type CallWatcher = (method: string, result: unknown) => void

export class Probe {
  readonly phases: Phase[] = []
  private readonly groups: string[] = []
  private readonly events: EventRecord[] = []
  private readonly calls: CallRecord[] = []
  private readonly lag: number[][] = []
  private readonly frames: number[][] = []
  // A marker object is shared by every listener of one event, so the first
  // listener records the event and later ones add their handler time to it.
  private readonly seen = new WeakMap<object, EventRecord>()
  readonly marks: Record<string, number> = {}
  readonly errors: string[] = []
  private execWatchers: ExecWatcher[] = []
  private callWatchers: CallWatcher[] = []

  private get phase(): number {
    return Math.max(0, this.phases.length - 1)
  }

  setPhase(name: string): void {
    const now = performance.now()
    const current = this.phases.at(-1)
    if (current) current.endMs = now
    this.phases.push({ name, startMs: now, endMs: null })
    EventsEmit('perf:phase', name)
  }

  mark(name: string, value: number): void {
    this.marks[name] = value
  }

  bump(name: string, by = 1): void {
    this.marks[name] = (this.marks[name] ?? 0) + by
  }

  onExec(watcher: ExecWatcher): () => void {
    this.execWatchers.push(watcher)
    return () => {
      this.execWatchers = this.execWatchers.filter((w) => w !== watcher)
    }
  }

  onCall(watcher: CallWatcher): () => void {
    this.callWatchers.push(watcher)
    return () => {
      this.callWatchers = this.callWatchers.filter((w) => w !== watcher)
    }
  }

  private groupIndex(group: string): number {
    const i = this.groups.indexOf(group)
    if (i >= 0) return i
    this.groups.push(group)
    return this.groups.length - 1
  }

  private observe(name: string, marker: object, stamp: Stamp, args: unknown[], handleMs: number, receivedUs: number): void {
    const handleUs = Math.round(handleMs * 1000)
    const existing = this.seen.get(marker)
    if (existing) {
      existing[4] += handleUs
      return
    }
    const group = eventGroup(name)
    const record: EventRecord = [this.phase, this.groupIndex(group), receivedUs - stamp.t, stamp.bytes, handleUs]
    this.events.push(record)
    this.seen.set(marker, record)

    if (group === 'pod:logs:line' && Array.isArray(args[0])) {
      const lines = args[0] as unknown[]
      this.bump('logLines', lines.length)
      for (const line of lines) {
        if (typeof line !== 'string' || !line.includes('icon=')) continue
        this.bump(line.includes(ICON) ? 'logIconOk' : 'logIconBad')
      }
    }
    if (group === 'exec:out' && typeof args[0] === 'string') {
      const id = name.slice('exec:out:'.length)
      for (const watcher of this.execWatchers) watcher(id, args[0])
    }
  }

  private wrapEvents(): void {
    setListenerWrapper((name, listener) => (...args: unknown[]) => {
      const marker = args.at(-1)
      const stamp = stampOf(marker)
      if (!stamp) return listener(...args)
      // Wall clock on both sides: Go's UnixMicro and the page's time origin
      // share the machine's clock.
      const receivedUs = Math.round((performance.timeOrigin + performance.now()) * 1000)
      const rest = args.slice(0, -1)
      const t0 = performance.now()
      try {
        return listener(...rest)
      } finally {
        this.observe(name, marker as object, stamp, rest, performance.now() - t0, receivedUs)
      }
    })
  }

  private wrapBindings(): void {
    const methods = api as unknown as Record<string, unknown>
    for (const key of Object.keys(methods)) {
      const original = methods[key]
      if (typeof original !== 'function') continue
      // Reported under the Go method's name, as v2 reports were.
      const method = key[0].toUpperCase() + key.slice(1)
      methods[key] = (...args: unknown[]) => {
        const t0 = performance.now()
        const phase = this.phase
        const done = (result: unknown, ok: 0 | 1) => {
          const items = Array.isArray(result) ? result.length : -1
          this.calls.push([phase, method, performance.now() - t0, items, ok])
          for (const watcher of this.callWatchers) watcher(method, result)
        }
        return (original as Binding)(...args).then(
          (result) => {
            done(result, 1)
            return result
          },
          (error: unknown) => {
            done(undefined, 0)
            throw error
          },
        )
      }
    }
  }

  private sampleMainThread(): void {
    // Timer lateness: how long a 100 ms timer fires after it was due.
    const period = 100
    let due = performance.now() + period
    const tick = () => {
      const now = performance.now()
      this.series(this.lag).push(Math.round((now - due) * 10) / 10)
      due = now + period
      setTimeout(tick, period)
    }
    setTimeout(tick, period)

    let last = performance.now()
    const frame = (now: number) => {
      this.series(this.frames).push(Math.round((now - last) * 10) / 10)
      last = now
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  private series(byPhase: number[][]): number[] {
    const phase = this.phase
    while (byPhase.length <= phase) byPhase.push([])
    return byPhase[phase]
  }

  install(): void {
    this.wrapEvents()
    this.wrapBindings()
    this.sampleMainThread()
  }

  report(): void {
    const current = this.phases.at(-1)
    if (current && current.endMs === null) current.endMs = performance.now()
    const report = {
      version: 1,
      userAgent: navigator.userAgent,
      timeOrigin: performance.timeOrigin,
      phases: this.phases,
      groups: this.groups,
      events: this.events,
      calls: this.calls,
      lag: this.lag,
      frames: this.frames,
      marks: this.marks,
      errors: this.errors,
    }
    EventsEmit('perf:report', JSON.stringify(report))
  }
}

export function install(): void {
  const probe = new Probe()
  probe.install()
  console.info('[perf] probe installed')
  void runScenario(probe).catch((error: unknown) => {
    probe.errors.push(String(error))
    probe.report()
  })
}
