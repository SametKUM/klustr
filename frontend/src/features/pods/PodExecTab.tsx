import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api, type PodDetail } from '@/lib/api'
import { xtermThemeFor } from '@/features/_shared/xtermTheme'
import { useUIStore } from '@/store/ui'

const SHELLS = ['/bin/sh', '/bin/bash']

type Props = {
  detail: PodDetail
  contextName?: string | null
}

export function PodExecTab({ detail, contextName }: Props) {
  const fallbackContext = useUIStore((s) => s.selectedContext)
  const selectedContext = contextName ?? fallbackContext
  const themeId = useUIStore((s) => s.themeId)
  const containerNames = useMemo(
    () => detail.containers.map((c) => c.name),
    [detail.containers],
  )
  const defaultContainer = detail.containers[0]?.name ?? ''
  const [container, setContainer] = useState(defaultContainer)
  const [shell, setShell] = useState(SHELLS[0])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0) // bumps to restart session

  const termHostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionRef = useRef<string | null>(null)

  useEffect(() => {
    if (!termHostRef.current) return
    const term = new Terminal({
      cursorBlink: true,
      convertEol: false,
      fontFamily:
        '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback: 5_000,
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
        if (sessionRef.current) {
          api.resizeExec(sessionRef.current, term.cols, term.rows).catch(() => {})
        }
      } catch {
        // ignore
      }
    })
    observer.observe(termHostRef.current)

    const dataDisposable = term.onData((data) => {
      if (sessionRef.current) {
        api.sendExecInput(sessionRef.current, data).catch(() => {})
      }
    })

    return () => {
      observer.disconnect()
      dataDisposable.dispose()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // theme is applied via a separate effect to avoid recreating the terminal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = xtermThemeFor(themeId)
    }
  }, [themeId])

  useEffect(() => {
    const term = termRef.current
    if (!selectedContext || !container || !term) return

    term.clear()
    term.writeln(`\x1b[2m# attaching to ${container} (${shell})\x1b[0m`)

    let cancelled = false
    let unsubOut: (() => void) | null = null
    let unsubClose: (() => void) | null = null

    api
      .startExec(selectedContext, detail.namespace, detail.name, container, [shell])
      .then((id) => {
        if (cancelled) {
          api.stopExec(id).catch(() => {})
          return
        }
        sessionRef.current = id
        setRunning(true)
        setError(null)
        unsubOut = EventsOn(`exec:out:${id}`, (data: string) => {
          term.write(data)
        })
        unsubClose = EventsOn(`exec:close:${id}`, (msg: string) => {
          setRunning(false)
          sessionRef.current = null
          if (msg) {
            term.writeln(`\r\n\x1b[31m# exec closed: ${msg}\x1b[0m`)
          } else {
            term.writeln(`\r\n\x1b[2m# exec ended\x1b[0m`)
          }
        })
        api.resizeExec(id, term.cols, term.rows).catch(() => {})
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(String(e))
        setRunning(false)
      })

    return () => {
      cancelled = true
      unsubOut?.()
      unsubClose?.()
      const id = sessionRef.current
      sessionRef.current = null
      if (id) {
        api.stopExec(id).catch(() => {})
        EventsOff(`exec:out:${id}`, `exec:close:${id}`)
      }
    }
  }, [selectedContext, detail.namespace, detail.name, container, shell, nonce])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs">
        <label className="text-muted-foreground">Container</label>
        <select
          value={container}
          onChange={(e) => setContainer(e.target.value)}
          className="rounded border border-border bg-background px-2 py-0.5 text-xs"
        >
          {containerNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <label className="ml-2 text-muted-foreground">Shell</label>
        <select
          value={shell}
          onChange={(e) => setShell(e.target.value)}
          className="rounded border border-border bg-background px-2 py-0.5 text-xs"
        >
          {SHELLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="ml-auto rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
        >
          Reattach
        </button>
        <span className={running ? 'text-emerald-500' : 'text-muted-foreground'}>
          {running ? '● running' : '○ idle'}
        </span>
      </div>
      {error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-mono text-destructive break-words">
          {error}
        </div>
      )}
      <div ref={termHostRef} className="min-h-0 flex-1 bg-background px-2 py-1" />
    </div>
  )
}
