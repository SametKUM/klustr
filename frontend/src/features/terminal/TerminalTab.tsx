import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api } from '@/lib/api'
import { xtermThemeFor } from '@/features/_shared/xtermTheme'
import { installClipboardBindings } from '@/features/_shared/xtermClipboard'
import { TerminalContextMenu } from '@/features/_shared/TerminalContextMenu'
import { useUIStore } from '@/store/ui'

type Props = {
  tabId: string
  contextName: string
  active: boolean
}

// One <TerminalTab> per local shell session. The component stays mounted
// for the lifetime of the tab (visibility toggles via the `active` prop)
// so the xterm.js scrollback survives tab switches.
export function TerminalTab({ tabId, contextName, active }: Props) {
  const themeId = useUIStore((s) => s.themeId)
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!hostRef.current) return
    const term = new Terminal({
      cursorBlink: true,
      convertEol: false,
      // Front of the stack is Nerd Font families. Powerlevel10k, starship
      // and most modern prompts emit Private Use Area glyphs (Apple logo,
      // git branch, ⎈ kubectl, …) that only render in a Nerd Font; we
      // try the four most common installers in order and fall back to
      // plain monospace so users without a Nerd Font still get text.
      fontFamily:
        '"MesloLGS NF", "MesloLGM NF", "MesloLGL Nerd Font Mono", "MesloLGL Nerd Font", "MesloLGS Nerd Font Mono", "MesloLGS Nerd Font", "JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font", "FiraCode Nerd Font Mono", "FiraCode Nerd Font", "Hack Nerd Font Mono", "Hack Nerd Font", "JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback: 10_000,
      // xterm builds its own glyphs for box-drawing / block chars when
      // the chosen font does not carry them, and rescales the few
      // Powerline triangles that otherwise spill past the cell width.
      customGlyphs: true,
      rescaleOverlappingGlyphs: true,
      theme: xtermThemeFor(themeId),
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current)
    installClipboardBindings(term)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const observer = new ResizeObserver(() => {
      try {
        fit.fit()
        if (sessionRef.current) {
          api.resizeLocalTerminal(sessionRef.current, term.cols, term.rows).catch(() => {})
        }
      } catch {
        // ignore
      }
    })
    observer.observe(hostRef.current)

    const dataDisposable = term.onData((data) => {
      if (sessionRef.current) {
        api.sendLocalTerminalInput(sessionRef.current, data).catch(() => {})
      }
    })

    return () => {
      observer.disconnect()
      dataDisposable.dispose()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // theme applied via a separate effect to avoid recreating the terminal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = xtermThemeFor(themeId)
    }
  }, [themeId])

  useEffect(() => {
    const term = termRef.current
    if (!term) return

    term.clear()
    setClosed(false)
    setError(null)
    term.writeln(`\x1b[2m# starting shell — context: ${contextName}\x1b[0m`)

    let cancelled = false
    let unsubOut: (() => void) | null = null
    let unsubClose: (() => void) | null = null

    api
      .openLocalTerminal(contextName, term.cols, term.rows)
      .then((id) => {
        if (cancelled) {
          api.stopLocalTerminal(id).catch(() => {})
          return
        }
        sessionRef.current = id
        unsubOut = EventsOn(`term:out:${id}`, (data: string) => {
          term.write(data)
        })
        unsubClose = EventsOn(`term:close:${id}`, (msg: string) => {
          setClosed(true)
          sessionRef.current = null
          if (msg) {
            term.writeln(`\r\n\x1b[31m# shell exited: ${msg}\x1b[0m`)
          } else {
            term.writeln(`\r\n\x1b[2m# shell exited\x1b[0m`)
          }
        })
        api.resizeLocalTerminal(id, term.cols, term.rows).catch(() => {})
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(String(e))
      })

    return () => {
      cancelled = true
      unsubOut?.()
      unsubClose?.()
      const id = sessionRef.current
      sessionRef.current = null
      if (id) {
        api.stopLocalTerminal(id).catch(() => {})
        EventsOff(`term:out:${id}`, `term:close:${id}`)
      }
    }
  }, [contextName, nonce])

  // Refit + focus on activation: switching tabs only changes `active`, which
  // doesn't trigger ResizeObserver, so dimensions can stay stale otherwise.
  useEffect(() => {
    if (!active) return
    const fit = fitRef.current
    const term = termRef.current
    if (!fit || !term) return
    requestAnimationFrame(() => {
      try {
        fit.fit()
        if (sessionRef.current) {
          api.resizeLocalTerminal(sessionRef.current, term.cols, term.rows).catch(() => {})
        }
        term.focus()
      } catch {
        // ignore
      }
    })
  }, [active])

  return (
    <div
      key={tabId}
      className={`flex min-h-0 flex-1 flex-col ${active ? '' : 'hidden'}`}
    >
      {error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-mono text-destructive break-words">
          {error}
        </div>
      )}
      {closed && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">Shell exited.</span>
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            className="rounded border border-amber-500/40 px-2 py-0.5 text-amber-600 transition hover:bg-amber-500/15 dark:text-amber-400"
          >
            Restart
          </button>
        </div>
      )}
      <TerminalContextMenu terminal={() => termRef.current}>
        <div ref={hostRef} className="min-h-0 flex-1 bg-background px-2 py-1" />
      </TerminalContextMenu>
    </div>
  )
}
