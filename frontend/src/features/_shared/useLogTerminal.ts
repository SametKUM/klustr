import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useUIStore } from '@/store/ui'
import { isMarker, lineColumns, pickVisible, renderEntry, type LogEntry, type LogLine } from './logView'
import { pushCapped } from './pushCapped'
import { xtermThemeFor } from './xtermTheme'
import { installClipboardBindings } from './xtermClipboard'

// RIS in-band instead of term.reset(): reset() takes effect immediately, so
// batches still queued inside xterm would land ahead of the repaint.
const FULL_RESET = '\x1bc'
const AUTOWRAP_OFF = '\x1b[?7l'
const WHEEL_LINE_COLUMNS = 3

type PaintState = { frame: number; busy: boolean; again: boolean; keepScroll: boolean }

function idlePaintState(): PaintState {
  return { frame: 0, busy: false, again: false, keepScroll: true }
}

type Options = {
  scrollback: number
  retain: number
  predicate: (text: string) => boolean
}

// useLogTerminal owns a read-only xterm log view: the retained lines, pause,
// the filter, and the wrap mode. The terminal is a projection of the retained
// entries, repainted whenever what it should show changes. Unwrapped, each line
// is exactly one row cut to the visible columns, so sideways scrolling is a
// repaint at a new column offset.
export function useLogTerminal({ scrollback, retain, predicate }: Options) {
  const themeId = useUIStore((s) => s.themeId)
  const wrap = useUIStore((s) => s.logWrap)
  const hostRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const entriesRef = useRef<LogEntry[]>([])
  const predicateRef = useRef(predicate)
  const wrapRef = useRef(wrap)
  const pausedRef = useRef(false)
  // Entries that arrived while paused sit at the end of entriesRef; repaints
  // while paused stop short of them so the frozen view stays frozen.
  const heldRef = useRef(0)
  const offsetRef = useRef(0)
  const extentRef = useRef(0)
  const paintRef = useRef<PaintState>(idlePaintState())
  const [paused, setPausedState] = useState(false)
  const [pending, setPending] = useState(0)
  const [atBottom, setAtBottom] = useState(true)
  const [cols, setCols] = useState(0)
  const [extent, setExtent] = useState(0)

  const paint = useCallback(function paint() {
    const term = termRef.current
    if (!term) return
    const state = paintRef.current
    const keepScroll = state.keepScroll
    state.keepScroll = true
    const entries = entriesRef.current
    const end = entries.length - Math.min(heldRef.current, entries.length)
    const limit = (term.options.scrollback ?? 0) + term.rows
    const shown = pickVisible(entries, end, predicateRef.current, limit)
    const unwrapped = !wrapRef.current
    if (unwrapped) {
      let widest = 0
      for (const entry of shown) if (!isMarker(entry)) widest = Math.max(widest, lineColumns(entry))
      extentRef.current = widest
      offsetRef.current = Math.min(offsetRef.current, Math.max(0, widest - term.cols))
      setExtent(widest)
    }
    setCols(term.cols)
    const layout = { wrap: !unwrapped, offset: offsetRef.current, cols: term.cols }
    const rows = shown.map((entry) => renderEntry(entry, layout))
    const buf = term.buffer.active
    const fromBottom = keepScroll ? buf.baseY - buf.viewportY : 0
    state.busy = true
    term.write(
      FULL_RESET + (unwrapped ? AUTOWRAP_OFF : '') + (rows.length > 0 ? rows.join('\r\n') + '\r\n' : ''),
      () => {
        state.busy = false
        if (termRef.current !== term) return
        if (fromBottom > 0) term.scrollToLine(Math.max(0, term.buffer.active.baseY - fromBottom))
        if (state.again) {
          state.again = false
          state.frame = requestAnimationFrame(() => {
            state.frame = 0
            paint()
          })
        }
      },
    )
  }, [])

  // Coalesces repaint requests into at most one per frame, and never queues a
  // second repaint behind one xterm has not parsed yet. keepScroll holds the
  // viewport on the same rows (sideways scroll, resize); anything else lands at
  // the bottom.
  const requestPaint = useCallback(
    (keepScroll = false) => {
      const state = paintRef.current
      if (!keepScroll) state.keepScroll = false
      if (state.busy) {
        state.again = true
        return
      }
      if (state.frame) return
      state.frame = requestAnimationFrame(() => {
        state.frame = 0
        paint()
      })
    },
    [paint],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const term = new Terminal({
      convertEol: true,
      fontFamily:
        '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback,
      theme: xtermThemeFor(themeId),
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    installClipboardBindings(term, { readOnly: true })
    fit.fit()
    termRef.current = term
    fitRef.current = fit
    const state = idlePaintState()
    paintRef.current = state

    const observer = new ResizeObserver(() => {
      try {
        fit.fit()
      } catch {
        // ignore: terminal may not be ready
      }
    })
    observer.observe(host)

    const scrollDisposable = term.onScroll(() => {
      const buf = term.buffer.active
      setAtBottom(buf.viewportY >= buf.baseY)
    })
    // Unwrapped rows were cut to the old width and xterm cannot reflow them
    // back, so a width change needs a repaint.
    const resizeDisposable = term.onResize((size) => {
      setCols(size.cols)
      if (!wrapRef.current) requestPaint(true)
    })

    // Captured on the host so a sideways gesture never reaches xterm's own
    // (vertical-only) wheel handling.
    const onWheel = (e: WheelEvent) => {
      const bar = barRef.current
      if (wrapRef.current || !bar) return
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0
      if (dx === 0) return
      e.preventDefault()
      e.stopPropagation()
      const column = bar.clientWidth / Math.max(1, term.cols)
      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? column * WHEEL_LINE_COLUMNS
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? bar.clientWidth
            : 1
      bar.scrollLeft += dx * unit
    }
    host.addEventListener('wheel', onWheel, { capture: true, passive: false })

    return () => {
      cancelAnimationFrame(state.frame)
      host.removeEventListener('wheel', onWheel, { capture: true })
      observer.disconnect()
      scrollDisposable.dispose()
      resizeDisposable.dispose()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // intentionally not depending on themeId: see effect below for live updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestPaint, scrollback])

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = xtermThemeFor(themeId)
  }, [themeId])

  useEffect(() => {
    predicateRef.current = predicate
    requestPaint()
  }, [predicate, requestPaint])

  useEffect(() => {
    wrapRef.current = wrap
    offsetRef.current = 0
    requestPaint()
  }, [wrap, requestPaint])

  const append = useCallback(
    (lines: LogLine[]) => {
      const term = termRef.current
      if (!term) return
      const layout = { wrap: wrapRef.current, offset: offsetRef.current, cols: term.cols }
      const out: string[] = []
      let held = 0
      let widest = extentRef.current
      for (const line of lines) {
        // Retain every line regardless of filter or pause, so the filter can
        // repaint over the full buffer and Save reflects it.
        pushCapped(entriesRef.current, line, retain)
        if (pausedRef.current) heldRef.current++
        if (!predicateRef.current(line.text)) continue
        if (pausedRef.current) {
          held++
          continue
        }
        if (!layout.wrap) widest = Math.max(widest, lineColumns(line))
        out.push(renderEntry(line, layout))
      }
      if (held > 0) setPending((n) => n + held)
      if (widest > extentRef.current) {
        extentRef.current = widest
        setExtent(widest)
      }
      // One coalesced write per batch instead of a writeln per line.
      if (out.length > 0) term.write(out.join('\r\n') + '\r\n')
    },
    [retain],
  )

  const appendMarker = useCallback(
    (marker: string) => {
      const term = termRef.current
      if (!term) return
      pushCapped(entriesRef.current, { marker }, retain)
      if (pausedRef.current) {
        heldRef.current++
        setPending((n) => n + 1)
        return
      }
      term.write(renderEntry({ marker }, { wrap: wrapRef.current, offset: 0, cols: term.cols }) + '\r\n')
    },
    [retain],
  )

  const reset = useCallback(
    (header?: string) => {
      entriesRef.current = header ? [{ marker: header }] : []
      heldRef.current = 0
      extentRef.current = 0
      setPending(0)
      setExtent(0)
      setAtBottom(true)
      requestPaint()
    },
    [requestPaint],
  )

  const setPaused = useCallback(
    (next: boolean) => {
      pausedRef.current = next
      heldRef.current = 0
      setPausedState(next)
      setPending(0)
      if (!next) requestPaint()
    },
    [requestPaint],
  )

  const filteredText = useCallback(
    () =>
      entriesRef.current.flatMap((entry) =>
        !isMarker(entry) && predicateRef.current(entry.text) ? [entry.text] : [],
      ),
    [],
  )

  const refit = useCallback(() => {
    const fit = fitRef.current
    if (!fit) return
    requestAnimationFrame(() => {
      try {
        fit.fit()
      } catch {
        return
      }
    })
  }, [])

  const scrollColumns = useCallback(
    (bar: HTMLDivElement) => {
      const term = termRef.current
      if (!term || bar.clientWidth === 0) return
      const next = Math.round((bar.scrollLeft * term.cols) / bar.clientWidth)
      if (next === offsetRef.current) return
      offsetRef.current = next
      requestPaint(true)
    },
    [requestPaint],
  )

  const terminal = useCallback(() => termRef.current, [])
  const scrollToBottom = useCallback(() => termRef.current?.scrollToBottom(), [])

  return {
    hostRef,
    barRef,
    terminal,
    wrap,
    cols,
    extent,
    atBottom,
    paused,
    pending,
    append,
    appendMarker,
    reset,
    setPaused,
    filteredText,
    refit,
    scrollColumns,
    scrollToBottom,
  }
}

export type LogTerminal = ReturnType<typeof useLogTerminal>
