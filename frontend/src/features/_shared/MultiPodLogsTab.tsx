import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { ArrowDownToLine, Download, Eraser, Filter, Pause, Play, Regex, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api, type PodLogTarget } from '@/lib/api'
import { xtermThemeFor } from '@/features/_shared/xtermTheme'
import { highlightLogContent } from '@/features/_shared/logHighlight'
import { useUIStore } from '@/store/ui'

const TAIL_LINES = 50
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
  pod: string
  container: string
  unsubLine: () => void
  unsubClose: () => void
}

export function MultiPodLogsTab({ contextName, namespace, selector, title }: Props) {
  const themeId = useUIStore((s) => s.themeId)
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
  const [paused, setPaused] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [filterValue, setFilterValue] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const termHostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const pausedRef = useRef(false)
  const bufferRef = useRef<string[]>([])
  const visibleLinesRef = useRef<string[]>([])
  const predicateRef = useRef<(line: string) => boolean>(() => true)
  const sessionsRef = useRef<Session[]>([])

  useEffect(() => {
    pausedRef.current = paused
    if (!paused && termRef.current && bufferRef.current.length > 0) {
      const term = termRef.current
      for (const line of bufferRef.current) term.writeln(line)
      bufferRef.current = []
    }
  }, [paused])

  useEffect(() => {
    if (!filterValue) {
      predicateRef.current = () => true
      setFilterError(null)
      return
    }
    if (useRegex) {
      try {
        const re = new RegExp(filterValue, 'i')
        predicateRef.current = (line) => re.test(line)
        setFilterError(null)
      } catch (e) {
        predicateRef.current = () => false
        setFilterError(String(e))
      }
    } else {
      const needle = filterValue.toLowerCase()
      predicateRef.current = (line) => line.toLowerCase().includes(needle)
      setFilterError(null)
    }
  }, [filterValue, useRegex])

  useEffect(() => {
    if (!termHostRef.current) return
    const term = new Terminal({
      convertEol: true,
      fontFamily:
        '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback: 20_000,
      theme: xtermThemeFor(themeId),
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(termHostRef.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const observer = new ResizeObserver(() => {
      try {
        fit.fit()
      } catch {
        /* noop */
      }
    })
    observer.observe(termHostRef.current)

    const scrollDisposable = term.onScroll(() => {
      const buf = term.buffer.active
      setAtBottom(buf.viewportY >= buf.baseY)
    })

    return () => {
      observer.disconnect()
      scrollDisposable.dispose()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = xtermThemeFor(themeId)
  }, [themeId])

  useEffect(() => {
    if (!contextName || !selectorKey) {
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
      setStreaming(false)
      return
    }
    const term = termRef.current
    if (!term) return

    term.clear()
    term.writeln(
      `\x1b[2m# tailing ${title}: ${targets.length} pod${targets.length === 1 ? '' : 's'} (last ${TAIL_LINES} lines per container)\x1b[0m`,
    )

    let cancelled = false
    const sessions: Session[] = []
    sessionsRef.current = sessions
    let activeStarts = 0

    targets.forEach((target) => {
      const color = colorForPod(target.pod)
      target.containers.forEach((container) => {
        activeStarts++
        api
          .startPodLogs(contextName, namespace, target.pod, container, true, TAIL_LINES)
          .then((id) => {
            if (cancelled) {
              api.stopPodLogs(id).catch(() => {})
              return
            }
            const prefix = `${color}${target.pod}/${container}${RESET} | `
            const rawPrefix = `${target.pod}/${container} | `
            const unsubLine = EventsOn(`pod:logs:line:${id}`, (line: string) => {
              const rawLine = rawPrefix + line
              if (!predicateRef.current(rawLine)) return
              const styled = prefix + highlightLogContent(line)
              if (pausedRef.current) {
                bufferRef.current.push(styled)
                if (bufferRef.current.length > 10_000) bufferRef.current.shift()
                return
              }
              term.writeln(styled)
              visibleLinesRef.current.push(rawLine)
              if (visibleLinesRef.current.length > 100_000) visibleLinesRef.current.shift()
            })
            const unsubClose = EventsOn(`pod:logs:close:${id}`, (msg: string) => {
              if (msg) {
                term.writeln(`${prefix}\x1b[31m# stream closed: ${msg}\x1b[0m`)
              }
            })
            sessions.push({ id, pod: target.pod, container, unsubLine, unsubClose })
          })
          .catch((e: unknown) => {
            if (cancelled) return
            term.writeln(
              `${colorForPod(target.pod)}${target.pod}/${container}${RESET} | \x1b[31m# start failed: ${String(e)}\x1b[0m`,
            )
          })
          .finally(() => {
            activeStarts--
            if (activeStarts === 0 && !cancelled) setStreaming(true)
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
      sessionsRef.current = []
      bufferRef.current = []
      visibleLinesRef.current = []
    }
  }, [contextName, namespace, targets, title])

  const saveLogs = () => {
    const lines = visibleLinesRef.current
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
        <Button type="button" size="xs" variant="outline" onClick={() => setPaused((p) => !p)}>
          {paused ? <Play /> : <Pause />}
          {paused ? `Resume${bufferRef.current.length > 0 ? ` (${bufferRef.current.length})` : ''}` : 'Pause'}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => {
            termRef.current?.clear()
            bufferRef.current = []
            visibleLinesRef.current = []
          }}
        >
          <Eraser />
          Clear
        </Button>
        <Button type="button" size="xs" variant="outline" onClick={saveLogs}>
          <Download />
          Save
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
          <span className={paused ? 'text-amber-500' : streaming ? 'text-emerald-500' : 'text-muted-foreground'}>
            {paused ? '❙❙ paused' : streaming ? '● live' : '○ idle'}
          </span>
        </div>
      </div>
      {filterError && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-1 text-[10px] font-mono text-destructive break-words">
          {filterError}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <div ref={termHostRef} className="absolute inset-0 bg-background px-2 py-1" />
        {!atBottom && (
          <button
            type="button"
            onClick={() => termRef.current?.scrollToBottom()}
            className="absolute bottom-3 right-4 inline-flex items-center gap-1 rounded-full border border-border bg-popover px-3 py-1 text-xs text-popover-foreground shadow-sm hover:bg-muted"
          >
            <ArrowDownToLine className="size-3" />
            Jump to bottom
          </button>
        )}
      </div>
    </div>
  )
}
