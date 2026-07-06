import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { ArrowDownToLine, Download, Eraser, Filter, History, Pause, Play, Regex } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api, type PodDetail } from '@/lib/api'
import { xtermThemeFor } from '@/features/_shared/xtermTheme'
import { highlightLogContent } from '@/features/_shared/logHighlight'
import { InlinePicker } from '@/features/_shared/InlinePicker'
import { useUIStore } from '@/store/ui'

const TAIL_LINES = 200

type Props = {
  detail: PodDetail
  contextName?: string | null
  initialContainer?: string
}

export function PodLogsTab({ detail, contextName, initialContainer }: Props) {
  const fallbackContext = useUIStore((s) => s.selectedContext)
  const selectedContext = contextName ?? fallbackContext
  const themeId = useUIStore((s) => s.themeId)
  const containerNames = useMemo(
    () => [...detail.initContainers.map((c) => c.name), ...detail.containers.map((c) => c.name)],
    [detail.initContainers, detail.containers],
  )
  const defaultContainer = detail.containers[0]?.name ?? detail.initContainers[0]?.name ?? ''
  const [container, setContainer] = useState(
    initialContainer && containerNames.includes(initialContainer) ? initialContainer : defaultContainer,
  )
  const [previous, setPrevious] = useState(false)
  // A previous (terminated) instance only exists once the container restarted.
  const canPrevious = useMemo(() => {
    const c = [...detail.containers, ...detail.initContainers].find((c) => c.name === container)
    return (c?.restartCount ?? 0) > 0
  }, [detail.containers, detail.initContainers, container])
  const showPrevious = previous && canPrevious
  const [error, setError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [paused, setPaused] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [filterValue, setFilterValue] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [bufferLength, setBufferLength] = useState(0)
  const termHostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const pausedRef = useRef(false)
  const bufferRef = useRef<string[]>([])
  const predicateRef = useRef<(line: string) => boolean>(() => true)
  const rawLinesRef = useRef<string[]>([])

  // Repaint the terminal from the retained raw buffer through the current
  // predicate. The filter is a view over captured logs, not just a gate on
  // incoming lines — without this, typing a filter does nothing to lines that
  // already streamed in.
  const rerender = useCallback(() => {
    const term = termRef.current
    if (!term) return
    term.reset()
    const styled: string[] = []
    for (const line of rawLinesRef.current) {
      if (predicateRef.current(line)) styled.push(highlightLogContent(line))
    }
    if (styled.length > 0) term.write(styled.join('\r\n') + '\r\n')
    bufferRef.current = []
    setBufferLength(0)
  }, [])

  useEffect(() => {
    if (!filterValue) {
      predicateRef.current = () => true
      setFilterError(null)
    } else if (useRegex) {
      try {
        const re = new RegExp(filterValue, 'i')
        predicateRef.current = (line) => re.test(line)
        setFilterError(null)
      } catch (e: unknown) {
        predicateRef.current = () => false
        setFilterError(String(e))
      }
    } else {
      const needle = filterValue.toLowerCase()
      predicateRef.current = (line) => line.toLowerCase().includes(needle)
      setFilterError(null)
    }
    rerender()
  }, [filterValue, useRegex, rerender])

  useEffect(() => {
    pausedRef.current = paused
    if (!paused && termRef.current && bufferRef.current.length > 0) {
      const term = termRef.current
      // One coalesced write instead of up to 5k synchronous writeln calls, which
      // would block the main thread when unpausing after a busy period.
      term.write(bufferRef.current.join('\r\n') + '\r\n')
      bufferRef.current = []
      setBufferLength(0)
    }
  }, [paused])

  useEffect(() => {
    if (!termHostRef.current) return
    const term = new Terminal({
      convertEol: true,
      fontFamily:
        '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback: 10_000,
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
        // ignore: terminal may not be ready
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
    // intentionally not depending on themeId: see effect below for live updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = xtermThemeFor(themeId)
    }
  }, [themeId])

  useEffect(() => {
    if (!selectedContext || !container) return
    const term = termRef.current
    if (!term) return

    term.clear()
    term.writeln(
      showPrevious
        ? `\x1b[2m# previous instance of ${container} (last ${TAIL_LINES} lines before termination)\x1b[0m`
        : `\x1b[2m# streaming ${container} (last ${TAIL_LINES} lines)\x1b[0m`,
    )
    setError(null)

    let cancelled = false
    let sessionId: string | null = null
    let unsubLine: (() => void) | null = null
    let unsubClose: (() => void) | null = null

    api
      .startPodLogs(selectedContext, detail.namespace, detail.name, container, !showPrevious, showPrevious, TAIL_LINES)
      .then((id) => {
        if (cancelled) {
          api.stopPodLogs(id).catch(() => {})
          return
        }
        sessionId = id
        setStreaming(true)
        unsubLine = EventsOn(`pod:logs:line:${id}`, (lines: string[]) => {
          const styledOut: string[] = []
          for (const line of lines) {
            // Retain every raw line (regardless of filter or pause) so the
            // filter can repaint over the full buffer and Save reflects it.
            rawLinesRef.current.push(line)
            if (!predicateRef.current(line)) continue
            styledOut.push(highlightLogContent(line))
          }
          // Amortized trim: one splice per batch, not an O(n) shift per line.
          if (rawLinesRef.current.length > 50_000) {
            rawLinesRef.current.splice(0, rawLinesRef.current.length - 50_000)
          }
          if (styledOut.length === 0) return
          if (pausedRef.current) {
            for (const s of styledOut) bufferRef.current.push(s)
            if (bufferRef.current.length > 5_000) {
              bufferRef.current.splice(0, bufferRef.current.length - 5_000)
            }
            setBufferLength(bufferRef.current.length)
            return
          }
          // One coalesced write per batch instead of a writeln per line.
          term.write(styledOut.join('\r\n') + '\r\n')
        })
        unsubClose = EventsOn(`pod:logs:close:${id}`, (msg: string) => {
          setStreaming(false)
          const styled = msg
            ? `\x1b[31m# stream closed: ${msg}\x1b[0m`
            : `\x1b[2m# stream ended\x1b[0m`
          // Route through the same pause buffer as live lines so the marker
          // stays in chronological order instead of jumping ahead of buffered
          // lines that preceded it.
          if (pausedRef.current) {
            bufferRef.current.push(styled)
            if (bufferRef.current.length > 5_000) {
              bufferRef.current.splice(0, bufferRef.current.length - 5_000)
            }
            setBufferLength(bufferRef.current.length)
            return
          }
          term.writeln(styled)
        })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(String(e))
        setStreaming(false)
      })

    return () => {
      cancelled = true
      unsubLine?.()
      unsubClose?.()
      bufferRef.current = []
      rawLinesRef.current = []
      setBufferLength(0)
      if (sessionId) {
        api.stopPodLogs(sessionId).catch(() => {})
        EventsOff(`pod:logs:line:${sessionId}`, `pod:logs:close:${sessionId}`)
      }
    }
  }, [selectedContext, detail.namespace, detail.name, container, showPrevious])

  const saveLogs = () => {
    const lines = rawLinesRef.current.filter((l) => predicateRef.current(l))
    if (lines.length === 0) {
      toast.info('No logs to save yet')
      return
    }
    const safeName = `${detail.namespace}-${detail.name}-${container}${showPrevious ? '-previous' : ''}.log`.replace(/[^A-Za-z0-9._-]+/g, '-')
    api
      .saveTextFile(safeName, lines.join('\n') + '\n')
      .then((path) => {
        if (path) toast.success(`Saved ${lines.length} lines to ${path}`)
      })
      .catch((e) => {
        toast.error(`Save failed: ${String(e)}`)
      })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs">
        <label className="text-muted-foreground">Container</label>
        <InlinePicker
          value={container}
          options={containerNames}
          onChange={setContainer}
          ariaLabel="Select container"
          minWidth={140}
        />
        {canPrevious && (
          <Button
            type="button"
            size="xs"
            variant={showPrevious ? 'default' : 'outline'}
            aria-pressed={showPrevious}
            title="Logs of the previous (terminated) container instance — kubectl logs --previous"
            onClick={() => setPrevious((v) => !v)}
          >
            <History />
            Previous
          </Button>
        )}

        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play /> : <Pause />}
          {paused ? `Resume${bufferLength > 0 ? ` (${bufferLength})` : ''}` : 'Pause'}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => {
            termRef.current?.clear()
            bufferRef.current = []
            rawLinesRef.current = []
            setBufferLength(0)
            // clear() leaves the (now empty) view bottom-anchored, but atBottom
            // only updates on scroll, so reset it here or the "Jump to bottom"
            // pill lingers over an empty terminal until the next scroll/write.
            setAtBottom(true)
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
      {error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-mono text-destructive break-words">
          {error}
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
