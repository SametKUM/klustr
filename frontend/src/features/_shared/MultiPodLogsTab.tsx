import { useEffect, useMemo, useState } from 'react'
import { Download, Eraser, Filter, Pause, Play, Regex, RefreshCcw, TextWrap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api, type PodLogTarget } from '@/lib/api'
import { columnWidth } from '@/features/_shared/logColumns'
import { LogViewport } from '@/features/_shared/LogViewport'
import type { LogLine } from '@/features/_shared/logView'
import { useLogTerminal } from '@/features/_shared/useLogTerminal'
import { useUIStore } from '@/store/ui'

const TAIL_LINES = 50
const RETAIN_CAP = 100_000
const COLORS = [
  '\x1b[36m', // cyan
  '\x1b[32m', // green
  '\x1b[33m', // yellow
  '\x1b[35m', // magenta
  '\x1b[34m', // blue
  '\x1b[91m', // bright red
  '\x1b[92m', // bright green
  '\x1b[95m', // bright magenta
]
const RESET = '\x1b[0m'

function colorForPod(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

type Props = {
  contextName: string | null
  namespace: string
  selector: Record<string, string>
  title: string
}

type Session = {
  id: string
  unsubLine: () => void
  unsubClose: () => void
}

export function MultiPodLogsTab({ contextName, namespace, selector, title }: Props) {
  const setLogWrap = useUIStore((s) => s.setLogWrap)
  const selectorKey = useMemo(
    () =>
      Object.entries(selector)
        .map(([k, v]) => `${k}=${v}`)
        .sort()
        .join(','),
    [selector],
  )

  const [targets, setTargets] = useState<PodLogTarget[]>([])
  const [streaming, setStreaming] = useState(false)
  const [filterValue, setFilterValue] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const appliedPredicate = useMemo(() => {
    if (!filterValue) {
      return { predicate: () => true, error: null }
    } else if (useRegex) {
      try {
        const re = new RegExp(filterValue, 'i')
        return { predicate: (line: string) => re.test(line), error: null }
      } catch (e) {
        return { predicate: () => false, error: String(e) }
      }
    }
    const needle = filterValue.toLowerCase()
    return { predicate: (line: string) => line.toLowerCase().includes(needle), error: null }
  }, [filterValue, useRegex])
  const filterError = appliedPredicate.error

  const view = useLogTerminal({ scrollback: 20_000, retain: RETAIN_CAP, predicate: appliedPredicate.predicate })
  const { append, appendMarker, reset } = view

  useEffect(() => {
    if (!contextName || !selectorKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Invalidating the selector also invalidates its targets.
      setTargets([])
      return
    }
    let cancelled = false
    api
      .podLogTargets(contextName, namespace, selector)
      .then((list) => {
        if (!cancelled) setTargets(list ?? [])
      })
      .catch(() => {
        if (!cancelled) setTargets([])
      })
    return () => {
      cancelled = true
    }
  }, [contextName, namespace, selectorKey, reloadKey, selector])

  useEffect(() => {
    if (!contextName || targets.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Stream state follows the external target set.
      setStreaming(false)
      return
    }

    reset(
      `\x1b[2m# tailing ${title}: ${targets.length} pod${targets.length === 1 ? '' : 's'} (last ${TAIL_LINES} lines per container)\x1b[0m`,
    )

    let cancelled = false
    const sessions: Session[] = []
    let activeStarts = 0

    targets.forEach((target) => {
      const color = colorForPod(target.pod)
      target.containers.forEach((container) => {
        activeStarts++
        const prefix = `${color}${target.pod}/${container}${RESET} | `
        const rawPrefix = `${target.pod}/${container} | `
        const prefixWidth = columnWidth(rawPrefix)
        api
          .startPodLogs(contextName, namespace, target.pod, container, true, false, TAIL_LINES)
          .then((id) => {
            if (cancelled) {
              api.stopPodLogs(id).catch(() => {})
              return
            }
            const unsubLine = EventsOn(`pod:logs:line:${id}`, (lines: string[]) => {
              append(lines.map((line): LogLine => ({ text: rawPrefix + line, body: line, prefix, prefixWidth })))
            })
            const unsubClose = EventsOn(`pod:logs:close:${id}`, (msg: string) => {
              if (!msg) return
              appendMarker(`${prefix}\x1b[31m# stream closed: ${msg}\x1b[0m`)
            })
            sessions.push({ id, unsubLine, unsubClose })
          })
          .catch((e: unknown) => {
            if (cancelled) return
            appendMarker(`${prefix}\x1b[31m# start failed: ${String(e)}\x1b[0m`)
          })
          .finally(() => {
            activeStarts--
            // Only report "live" if at least one stream actually registered;
            // if every start failed (e.g. cluster-wide RBAC denial) the per-line
            // "# start failed" messages must not be contradicted by a green
            // "● live" indicator.
            if (activeStarts === 0 && !cancelled) setStreaming(sessions.length > 0)
          })
      })
    })

    return () => {
      cancelled = true
      setStreaming(false)
      for (const s of sessions) {
        s.unsubLine?.()
        s.unsubClose?.()
        api.stopPodLogs(s.id).catch(() => {})
        EventsOff(`pod:logs:line:${s.id}`, `pod:logs:close:${s.id}`)
      }
    }
  }, [contextName, namespace, targets, title, append, appendMarker, reset])

  const saveLogs = () => {
    const lines = view.filteredText()
    if (lines.length === 0) {
      toast.info('No logs to save yet')
      return
    }
    const safeName = `${namespace}-${title}-logs.log`.replace(/[^A-Za-z0-9._-]+/g, '-')
    api
      .saveTextFile(safeName, lines.join('\n') + '\n')
      .then((path) => {
        if (path) toast.success(`Saved ${lines.length} lines to ${path}`)
      })
      .catch((e) => toast.error(`Save failed: ${String(e)}`))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs">
        <span className="text-muted-foreground">
          Tailing {targets.length} pod{targets.length === 1 ? '' : 's'} · all containers
        </span>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setReloadKey((k) => k + 1)}
          aria-label="Reload pod list"
        >
          <RefreshCcw />
          Reload
        </Button>
        <Button type="button" size="xs" variant="outline" onClick={() => view.setPaused(!view.paused)}>
          {view.paused ? <Play /> : <Pause />}
          {view.paused ? `Resume${view.pending > 0 ? ` (${view.pending})` : ''}` : 'Pause'}
        </Button>
        <Button type="button" size="xs" variant="outline" onClick={() => view.reset()}>
          <Eraser />
          Clear
        </Button>
        <Button type="button" size="xs" variant="outline" onClick={saveLogs}>
          <Download />
          Save
        </Button>
        <Button
          type="button"
          size="xs"
          variant={view.wrap ? 'default' : 'outline'}
          aria-pressed={view.wrap}
          title="Wrap long lines — turn off to keep each line on one row and scroll sideways (Shift+wheel)"
          onClick={() => setLogWrap(!view.wrap)}
        >
          <TextWrap />
          Wrap
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <div className="relative w-44">
            <Filter className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/70" />
            <input
              type="text"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder={useRegex ? 'Regex filter…' : 'Substring filter…'}
              className={[
                'h-6 w-full rounded border bg-background pl-6 pr-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring',
                filterError ? 'border-destructive' : 'border-border',
              ].join(' ')}
            />
          </div>
          <Button
            type="button"
            size="icon-xs"
            variant={useRegex ? 'default' : 'outline'}
            aria-pressed={useRegex}
            aria-label="Toggle regex mode"
            onClick={() => setUseRegex((v) => !v)}
          >
            <Regex />
          </Button>
          <span className={view.paused ? 'text-amber-500' : streaming ? 'text-emerald-500' : 'text-muted-foreground'}>
            {view.paused ? '❙❙ paused' : streaming ? '● live' : '○ idle'}
          </span>
        </div>
      </div>
      {filterError && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-1 text-[10px] font-mono text-destructive break-words">
          {filterError}
        </div>
      )}
      <LogViewport view={view} />
    </div>
  )
}
