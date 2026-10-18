import { useEffect, useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api, type PodDetail } from '@/lib/api'
import { InlinePicker } from '@/features/_shared/InlinePicker'
import { LogViewport } from '@/features/_shared/LogViewport'
import { LogToolbar } from '@/features/_shared/LogToolbar'
import type { LogLine } from '@/features/_shared/logView'
import { useLogTerminal } from '@/features/_shared/useLogTerminal'
import { useUIStore } from '@/store/ui'

// How far back a stream starts; 0 asks for the whole log. Scrolling still
// reaches only the terminal's scrollback, the filter and Save the retained lines.
const TAIL_OPTIONS = [
  { value: '200', label: '200 lines' },
  { value: '1000', label: '1,000 lines' },
  { value: '10000', label: '10,000 lines' },
  { value: '0', label: 'Whole log' },
]
const DEFAULT_TAIL_LINES = 200

function streamHeader(container: string, previous: boolean, tailLines: number): string {
  const span = tailLines > 0 ? `last ${tailLines} lines` : 'whole log'
  return previous
    ? `\x1b[2m# previous instance of ${container} (${span}${tailLines > 0 ? ' before termination' : ''})\x1b[0m`
    : `\x1b[2m# streaming ${container} (${span})\x1b[0m`
}

type Props = {
  detail: PodDetail
  contextName?: string | null
  initialContainer?: string
  containerRequestId?: number
  active: boolean
}

export function PodLogsTab({ detail, contextName, initialContainer, containerRequestId, active }: Props) {
  const fallbackContext = useUIStore((s) => s.selectedContext)
  const selectedContext = contextName ?? fallbackContext
  const setLogWrap = useUIStore((s) => s.setLogWrap)
  const containerNames = useMemo(
    () => [...detail.initContainers.map((c) => c.name), ...detail.containers.map((c) => c.name)],
    [detail.initContainers, detail.containers],
  )
  const defaultContainer = detail.containers[0]?.name ?? detail.initContainers[0]?.name ?? ''
  const [selection, setSelection] = useState(() => ({
    requested: initialContainer,
    requestId: containerRequestId,
    container: initialContainer && containerNames.includes(initialContainer) ? initialContainer : defaultContainer,
  }))
  // A container link can target the already-mounted pod inspector. Synchronize
  // before committing effects so the old container never starts an extra stream.
  if (selection.requested !== initialContainer || (containerRequestId !== undefined && selection.requestId !== containerRequestId)) {
    setSelection({
      requested: initialContainer,
      requestId: containerRequestId,
      container: initialContainer && containerNames.includes(initialContainer) ? initialContainer : selection.container,
    })
  }
  const container = containerNames.includes(selection.container) ? selection.container : defaultContainer
  const setContainer = (container: string) => setSelection({ requested: initialContainer, requestId: containerRequestId, container })
  const [previous, setPrevious] = useState(false)
  // A previous (terminated) instance only exists once the container restarted.
  const canPrevious = useMemo(() => {
    const c = [...detail.containers, ...detail.initContainers].find((c) => c.name === container)
    return (c?.restartCount ?? 0) > 0
  }, [detail.containers, detail.initContainers, container])
  const showPrevious = previous && canPrevious
  const [tailLines, setTailLines] = useState(DEFAULT_TAIL_LINES)
  // A start failure belongs to the stream that failed; switching container,
  // mode or tail leaves it behind instead of resetting it from the effect.
  const streamKey = JSON.stringify([selectedContext, detail.namespace, detail.name, container, showPrevious, tailLines])
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

    reset(streamHeader(container, showPrevious, tailLines))

    let cancelled = false
    let sessionId: string | null = null
    let unsubLine: (() => void) | null = null
    let unsubClose: (() => void) | null = null

    api
      .startPodLogs(selectedContext, detail.namespace, detail.name, container, !showPrevious, showPrevious, tailLines)
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
  }, [selectedContext, detail.namespace, detail.name, container, showPrevious, tailLines, streamKey, append, appendMarker, reset])

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
      <LogToolbar
        view={view}
        onSave={saveLogs}
        onToggleWrap={() => setLogWrap(!view.wrap)}
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        useRegex={useRegex}
        onRegexChange={setUseRegex}
        filterError={filterError}
        streaming={streaming}
        previous={showPrevious}
        source={
          <>
            <div className="flex min-w-0 max-w-96 flex-1 items-center gap-2">
              <span className="hidden shrink-0 text-muted-foreground @min-[38rem]/log-toolbar:inline">Container</span>
              <InlinePicker
                value={container}
                options={containerNames}
                onChange={setContainer}
                ariaLabel="Select container"
                minWidth={0}
                className="min-w-0 flex-1 shrink"
              />
            </div>
            <InlinePicker
              value={String(tailLines)}
              options={TAIL_OPTIONS}
              onChange={(v) => setTailLines(Number(v))}
              ariaLabel="Select how many lines to load"
              minWidth={0}
              className="w-28"
            />
            {/* The title sits on a wrapper because a disabled button gets no
                pointer events, so it would never show its own tooltip. */}
            <span
              className="inline-flex shrink-0"
              title={
                canPrevious
                  ? showPrevious
                    ? 'Showing previous instance logs. Click to return to current logs.'
                    : 'Show logs from the previous terminated container instance'
                  : 'No previous instance — this container has not restarted'
              }
            >
              <Button
                type="button"
                size="xs"
                variant={showPrevious ? 'default' : 'outline'}
                aria-label="Show previous container logs"
                aria-pressed={showPrevious}
                disabled={!canPrevious}
                onClick={() => setPrevious((v) => !v)}
              >
                <History />
                Previous
              </Button>
            </span>
          </>
        }
      />
      {error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-mono text-destructive break-words">
          {error}
        </div>
      )}
      <LogViewport view={view} />
    </div>
  )
}
