import { useEffect, useMemo, useState } from 'react'
import { Download, Eraser, Filter, History, Pause, Play, Regex, TextWrap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api, type PodDetail } from '@/lib/api'
import { InlinePicker } from '@/features/_shared/InlinePicker'
import { LogViewport } from '@/features/_shared/LogViewport'
import type { LogLine } from '@/features/_shared/logView'
import { useLogTerminal } from '@/features/_shared/useLogTerminal'
import { useUIStore } from '@/store/ui'

const TAIL_LINES = 200

type Props = {
  detail: PodDetail
  contextName?: string | null
  initialContainer?: string
  active: boolean
}

export function PodLogsTab({ detail, contextName, initialContainer, active }: Props) {
  const fallbackContext = useUIStore((s) => s.selectedContext)
  const selectedContext = contextName ?? fallbackContext
  const setLogWrap = useUIStore((s) => s.setLogWrap)
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
  // A start failure belongs to the stream that failed; switching container or
  // mode leaves it behind instead of resetting it from the effect.
  const streamKey = JSON.stringify([selectedContext, detail.namespace, detail.name, container, showPrevious])
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const error = failure?.key === streamKey ? failure.message : null
  const [streaming, setStreaming] = useState(false)
  const [filterValue, setFilterValue] = useState('')
  const [useRegex, setUseRegex] = useState(false)

  // Debounce the applied filter so a full-buffer rescan runs once per typing
  // pause, not per keystroke (mirrors ResourceTable's appliedFilter).
  const [appliedFilter, setAppliedFilter] = useState('')
  useEffect(() => {
    const id = window.setTimeout(() => setAppliedFilter(filterValue), 150)
    return () => window.clearTimeout(id)
  }, [filterValue])

  const appliedPredicate = useMemo(() => {
    if (!appliedFilter) {
      return { predicate: () => true, error: null }
    } else if (useRegex) {
      try {
        const re = new RegExp(appliedFilter, 'i')
        return { predicate: (line: string) => re.test(line), error: null }
      } catch (e: unknown) {
        return { predicate: () => false, error: String(e) }
      }
    }
    const needle = appliedFilter.toLowerCase()
    return { predicate: (line: string) => line.toLowerCase().includes(needle), error: null }
  }, [appliedFilter, useRegex])
  const filterError = appliedPredicate.error

  const view = useLogTerminal({ scrollback: 10_000, retain: 50_000, predicate: appliedPredicate.predicate })
  const { append, appendMarker, reset, refit } = view

  useEffect(() => {
    if (active) refit()
  }, [active, refit])

  useEffect(() => {
    if (!selectedContext || !container) return

    reset(
      showPrevious
        ? `\x1b[2m# previous instance of ${container} (last ${TAIL_LINES} lines before termination)\x1b[0m`
        : `\x1b[2m# streaming ${container} (last ${TAIL_LINES} lines)\x1b[0m`,
    )

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
          append(lines.map((line): LogLine => ({ text: line, body: line, prefix: '', prefixWidth: 0 })))
        })
        unsubClose = EventsOn(`pod:logs:close:${id}`, (msg: string) => {
          setStreaming(false)
          appendMarker(msg ? `\x1b[31m# stream closed: ${msg}\x1b[0m` : `\x1b[2m# stream ended\x1b[0m`)
        })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setFailure({ key: streamKey, message: String(e) })
        setStreaming(false)
      })

    return () => {
      cancelled = true
      unsubLine?.()
      unsubClose?.()
      if (sessionId) {
        api.stopPodLogs(sessionId).catch(() => {})
        EventsOff(`pod:logs:line:${sessionId}`, `pod:logs:close:${sessionId}`)
      }
    }
  }, [selectedContext, detail.namespace, detail.name, container, showPrevious, streamKey, append, appendMarker, reset])

  const saveLogs = () => {
    const lines = view.filteredText()
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
        {/* The title sits on a wrapper because a disabled button gets no
            pointer events, so it would never show its own tooltip. */}
        <span
          className="inline-flex"
          title={
            canPrevious
              ? 'Logs of the previous (terminated) container instance — kubectl logs --previous'
              : 'No previous instance — this container has not restarted'
          }
        >
          <Button
            type="button"
            size="xs"
            variant={showPrevious ? 'default' : 'outline'}
            aria-pressed={showPrevious}
            disabled={!canPrevious}
            onClick={() => setPrevious((v) => !v)}
          >
            <History />
            Previous
          </Button>
        </span>

        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => view.setPaused(!view.paused)}
        >
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
      {error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-mono text-destructive break-words">
          {error}
        </div>
      )}
      <LogViewport view={view} />
    </div>
  )
}
