import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import '@xterm/xterm/css/xterm.css'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type PodDetail } from '@/lib/api'
import { xtermThemeFor } from '@/features/_shared/xtermTheme'
import { InlinePicker } from '@/features/_shared/InlinePicker'
import { TerminalAppPickerDialog } from '@/features/terminal/TerminalAppPickerDialog'
import { useTerminalStore } from '@/store/terminals'
import { useUIStore } from '@/store/ui'

const SHELLS = ['/bin/sh', '/bin/bash']
// Tagged, so the kubelet pulls once instead of on every session (an unpinned
// tag implies imagePullPolicy: Always).
const DEBUG_IMAGE_PRESETS = ['nicolaka/netshoot:v0.16', 'busybox:1.38', 'alpine:3.23']
const DEFAULT_DEBUG_IMAGE = DEBUG_IMAGE_PRESETS[0]

type Mode = 'exec' | 'debug'

type Props = {
  detail: PodDetail
  contextName?: string | null
  active: boolean
}

export function PodExecTab({ detail, contextName, active }: Props) {
  const fallbackContext = useUIStore((s) => s.selectedContext)
  const selectedContext = contextName ?? fallbackContext
  const themeId = useUIStore((s) => s.themeId)
  const containerNames = useMemo(
    () => detail.containers.map((c) => c.name),
    [detail.containers],
  )
  const defaultContainer = detail.containers[0]?.name ?? ''
  const [mode, setMode] = useState<Mode>('exec')
  const [container, setContainer] = useState(defaultContainer)
  const [shell, setShell] = useState(SHELLS[0])
  const [image, setImage] = useState(DEFAULT_DEBUG_IMAGE)
  const [elevated, setElevated] = useState(false)
  const [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0) // bumps to restart the exec-mode session
  const [externalOpen, setExternalOpen] = useState(false)

  // Seed from a debug container created in an earlier session so Reattach works
  // after a dialog reopen (component state has reset by then) instead of
  // injecting a second, unremovable ephemeral container. Newest wins: ephemeral
  // containers are appended, so the last running klustr-debugger-* is the most
  // recent.
  const [debugContainer, setDebugContainer] = useState<string | null>(() => {
    const existing = (detail.ephemeralContainers ?? []).filter(
      (c) => c.name.startsWith('klustr-debugger-') && c.state === 'Running',
    )
    return existing.length ? existing[existing.length - 1].name : null
  })

  const termHostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionRef = useRef<string | null>(null)
  const detachRef = useRef<(() => void) | null>(null)
  const connGenRef = useRef(0)

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
    if (!active) return
    const fit = fitRef.current
    const term = termRef.current
    if (!fit || !term) return
    requestAnimationFrame(() => {
      try {
        fit.fit()
        if (sessionRef.current) {
          api.resizeExec(sessionRef.current, term.cols, term.rows).catch(() => {})
        }
        term.focus()
      } catch {
        return
      }
    })
  }, [active])

  // Subscribe an already-started session id to the terminal. Returns an
  // unsubscribe. Both exec and debug sessions emit exec:out/close:<id>.
  const attachSession = useCallback((id: string) => {
    const term = termRef.current
    if (!term) return () => {}
    sessionRef.current = id
    setRunning(true)
    setError(null)
    const unsubOut = EventsOn(`exec:out:${id}`, (data: string) => {
      term.write(data)
    })
    const unsubClose = EventsOn(`exec:close:${id}`, (msg: string) => {
      setRunning(false)
      sessionRef.current = null
      term.writeln(
        msg
          ? `\r\n\x1b[31m# session closed: ${msg}\x1b[0m`
          : `\r\n\x1b[2m# session ended\x1b[0m`,
      )
    })
    api.resizeExec(id, term.cols, term.rows).catch(() => {})
    // The tab mounts inside a Dialog whose focus lands on the dialog, not the
    // xterm textarea, so focus after it settles (mirrors TerminalTab).
    requestAnimationFrame(() => term.focus())
    return () => {
      unsubOut?.()
      unsubClose?.()
      EventsOff(`exec:out:${id}`, `exec:close:${id}`)
    }
  }, [])

  const disconnect = useCallback(() => {
    connGenRef.current++
    detachRef.current?.()
    detachRef.current = null
    const id = sessionRef.current
    sessionRef.current = null
    if (id) api.stopExec(id).catch(() => {})
    setRunning(false)
    setBusy(false)
  }, [])

  // connect tears down any current session, prints a banner, runs start() to
  // obtain a session id, and attaches it.
  const connect = useCallback(
    async (banner: string, start: () => Promise<string>) => {
      const term = termRef.current
      if (!term) return
      disconnect()
      const gen = connGenRef.current
      term.clear()
      term.writeln(`\x1b[2m# ${banner}\x1b[0m`)
      setBusy(true)
      setError(null)
      try {
        const id = await start()
        if (gen !== connGenRef.current) {
          api.stopExec(id).catch(() => {})
          return
        }
        detachRef.current = attachSession(id)
      } catch (e: unknown) {
        if (gen !== connGenRef.current) return
        setError(String(e))
        setRunning(false)
      } finally {
        if (gen === connGenRef.current) setBusy(false)
      }
    },
    [attachSession, disconnect],
  )

  // Exec mode auto-attaches (unchanged behaviour). Debug mode is manual: leaving
  // exec mode tears the exec session down via this effect's cleanup; debug
  // sessions are started imperatively and torn down by the unmount effect below.
  useEffect(() => {
    if (mode !== 'exec') return
    if (!selectedContext || !container) return
    void connect(`attaching to ${container} (${shell})`, () =>
      api.startExec(selectedContext, detail.namespace, detail.name, container, [shell]),
    )
    return () => disconnect()
  }, [
    mode,
    selectedContext,
    detail.namespace,
    detail.name,
    container,
    shell,
    nonce,
    connect,
    disconnect,
  ])

  // Guarantees teardown on unmount regardless of mode (the exec effect above
  // registers no cleanup while in debug mode).
  useEffect(() => () => disconnect(), [disconnect])

  const startDebug = () => {
    if (!selectedContext || !container || busy) return
    void connect(
      `starting debug container (${image}, ${shell}${elevated ? ', SYS_PTRACE' : ''}) targeting ${container}`,
      async () => {
        const s = await api.startPodDebug(
          selectedContext,
          detail.namespace,
          detail.name,
          container,
          image,
          shell,
          elevated,
        )
        setDebugContainer(s.containerName)
        return s.sessionID
      },
    )
  }

  const reattachDebug = () => {
    if (!selectedContext || !debugContainer || busy) return
    void connect(`reattaching to ${debugContainer} (${shell})`, () =>
      api.startExec(selectedContext, detail.namespace, detail.name, debugContainer, [shell]),
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-xs">
        <InlinePicker
          value={mode}
          options={['exec', 'debug']}
          onChange={(m) => setMode(m as Mode)}
          ariaLabel="Session mode"
          minWidth={90}
        />

        {mode === 'exec' ? (
          <>
            <label className="text-muted-foreground">Container</label>
            <InlinePicker
              value={container}
              options={containerNames}
              onChange={setContainer}
              ariaLabel="Select container"
              minWidth={140}
            />
          </>
        ) : (
          <>
            <label className="text-muted-foreground">Target</label>
            <InlinePicker
              value={container}
              options={containerNames}
              onChange={setContainer}
              ariaLabel="Select target container"
              minWidth={140}
            />
            <label className="ml-2 text-muted-foreground">Image</label>
            <Input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              aria-label="Debug image"
              className="h-6 w-44 text-xs"
            />
            {DEBUG_IMAGE_PRESETS.map((p) => (
              <Button
                key={p}
                type="button"
                size="xs"
                variant={image === p ? 'default' : 'outline'}
                onClick={() => setImage(p)}
              >
                {p.split('/').pop()?.split(':')[0]}
              </Button>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-muted-foreground">
                  <Checkbox
                    checked={elevated}
                    onChange={(e) => setElevated((e.target as HTMLInputElement).checked)}
                    aria-label="Add SYS_PTRACE capability"
                  />
                  <span className="underline decoration-dotted underline-offset-2">
                    SYS_PTRACE
                  </span>
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[20rem] text-xs">
                Adds the CAP_SYS_PTRACE capability to the debug container. Without it the
                target's filesystem (/proc/1/root), environment and open files are
                Permission denied even as root — only its process names are visible. It
                also grants read access to the target process's memory, so anything it
                holds in RAM (tokens, keys) is exposed, and the PodSecurity baseline
                policy rejects pods that add it.
              </TooltipContent>
            </Tooltip>
          </>
        )}

        <label className="ml-2 text-muted-foreground">Shell</label>
        <InlinePicker
          value={shell}
          options={SHELLS}
          onChange={setShell}
          ariaLabel="Select shell"
          minWidth={120}
        />

        {mode === 'exec' ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setNonce((n) => n + 1)}
            className="ml-auto"
          >
            Reattach
          </Button>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="default"
              onClick={startDebug}
              disabled={!selectedContext || !container || busy}
            >
              {busy ? 'Starting…' : 'Start debug'}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={reattachDebug}
              disabled={!debugContainer || busy}
              title="Exec back into the debug container"
            >
              Reattach
            </Button>
          </div>
        )}

        {mode === 'exec' && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={(e) => {
              if (!selectedContext) return
              const pref = useTerminalStore.getState().preferredAppId
              if (pref && !e.altKey) {
                api
                  .openPodExecInSystemTerminal(
                    selectedContext,
                    detail.namespace,
                    detail.name,
                    container,
                    shell,
                    pref,
                  )
                  .catch((err) => {
                    toast.error('Could not open system terminal', {
                      description: String(err),
                    })
                    setExternalOpen(true)
                  })
                return
              }
              setExternalOpen(true)
            }}
            disabled={!selectedContext || !container}
            title="Open this exec session in a system terminal (Alt+click to choose app)"
          >
            <ExternalLink className="size-3" />
            External
          </Button>
        )}

        <span className={running ? 'text-emerald-500' : 'text-muted-foreground'}>
          {running ? '● running' : '○ idle'}
        </span>
      </div>

      {mode === 'debug' && (
        <div className="border-b border-border bg-muted/40 px-4 py-1.5 text-[11px] text-muted-foreground">
          Adds an ephemeral debug container to this pod, sharing the target's
          process namespace. Reading the target's filesystem under /proc/1/root
          additionally needs SYS_PTRACE. Ephemeral containers can't be removed —
          it stays until the pod restarts.
        </div>
      )}

      {error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-mono text-destructive break-words">
          {error}
        </div>
      )}
      <div ref={termHostRef} className="min-h-0 flex-1 bg-background px-2 py-1" />

      <TerminalAppPickerDialog
        open={externalOpen}
        description={
          <>
            Open a system terminal already <code>kubectl exec</code>'d into{' '}
            <span className="font-mono text-foreground">
              {detail.namespace}/{detail.name}
            </span>
            {container && (
              <>
                {' '}container{' '}
                <span className="font-mono text-foreground">{container}</span>
              </>
            )}
            .
          </>
        }
        onClose={() => setExternalOpen(false)}
        onLaunch={(appID) =>
          selectedContext
            ? api.openPodExecInSystemTerminal(
                selectedContext,
                detail.namespace,
                detail.name,
                container,
                shell,
                appID,
              )
            : Promise.resolve()
        }
      />
    </div>
  )
}
