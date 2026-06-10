import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { xtermThemeFor } from '@/features/_shared/xtermTheme'
import { useUIStore } from '@/store/ui'

type Props = {
  contextName: string | null
  nodeName: string
}

export function NodeShellTab({ contextName, nodeName }: Props) {
  const fallbackContext = useUIStore((s) => s.selectedContext)
  const selectedContext = contextName ?? fallbackContext
  const themeId = useUIStore((s) => s.themeId)
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
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
    if (!selectedContext || !term) return

    term.clear()
    term.writeln(
      `\x1b[2m# starting a privileged shell pod on ${nodeName} — image pull may take a moment…\x1b[0m`,
    )

    let cancelled = false
    let unsubOut: (() => void) | null = null
    let unsubClose: (() => void) | null = null
    setStarting(true)

    api
      .startNodeShell(selectedContext, nodeName)
      .then((id) => {
        if (cancelled) {
          api.stopExec(id).catch(() => {})
          return
        }
        sessionRef.current = id
        setStarting(false)
        setRunning(true)
        setError(null)
        unsubOut = EventsOn(`exec:out:${id}`, (data: string) => {
          term.write(data)
        })
        unsubClose = EventsOn(`exec:close:${id}`, (msg: string) => {
          setRunning(false)
          sessionRef.current = null
          if (msg) {
            term.writeln(`\r\n\x1b[31m# shell closed: ${msg}\x1b[0m`)
          } else {
            term.writeln(`\r\n\x1b[2m# shell ended — the helper pod was removed\x1b[0m`)
          }
        })
        api.resizeExec(id, term.cols, term.rows).catch(() => {})
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(String(e))
        setStarting(false)
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
  }, [selectedContext, nodeName, nonce])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs">
        <span className="text-muted-foreground">
          Root shell via a temporary privileged pod (<code>nsenter</code> into the host) —
          removed when the session ends.
        </span>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setNonce((n) => n + 1)}
          className="ml-auto"
        >
          Reattach
        </Button>
        <span
          className={
            running ? 'text-emerald-500' : starting ? 'text-amber-500' : 'text-muted-foreground'
          }
        >
          {running ? '● running' : starting ? '◌ starting' : '○ idle'}
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
