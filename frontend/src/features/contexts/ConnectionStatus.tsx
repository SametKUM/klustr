import { useEffect, useState } from 'react'
import { Boxes, CheckCircle2, OctagonX, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { api, type ServerVersion } from '@/lib/api'
import { useUIStore } from '@/store/ui'

type Status =
  | { kind: 'idle' }
  | { kind: 'pinging' }
  | { kind: 'connected'; version: ServerVersion }
  | { kind: 'error'; message: string }

export function ConnectionStatus() {
  const selected = useUIStore((s) => s.selectedContext)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    if (!selected) {
      setStatus({ kind: 'idle' })
      return
    }
    let cancelled = false
    setStatus({ kind: 'pinging' })
    api
      .pingContext(selected)
      .then((v) => {
        if (cancelled) return
        setStatus({ kind: 'connected', version: v })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setStatus({ kind: 'error', message: String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  if (status.kind === 'idle') {
    return <WelcomeCard />
  }

  if (status.kind === 'pinging') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size="lg" />
        Connecting to {selected}…
      </div>
    )
  }

  if (status.kind === 'error') {
    return (
      <div className="max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-center">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-destructive">
          <OctagonX className="size-4" />
          Cannot reach {selected}
        </div>
        <div className="mt-2 break-words font-mono text-xs text-muted-foreground">{status.message}</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card px-8 py-6 text-center">
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-4" />
        Connected
      </div>
      <div className="mt-1 text-base font-semibold">{selected}</div>
      <div className="mt-2 text-xs text-muted-foreground">
        Kubernetes {status.version.gitVersion} · {status.version.platform}
      </div>
    </div>
  )
}

function WelcomeCard() {
  return (
    <div className="max-w-md rounded-xl border border-border bg-card px-8 py-6 text-center shadow-sm">
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Sparkles className="size-4" />
        Welcome
      </div>
      <div className="mt-2 text-base font-semibold">Pick a kubeconfig context to get started.</div>
      <div className="mt-1 text-xs text-muted-foreground">
        The picker is in the header above, or hit <Shortcut>⌘ K</Shortcut> any time.
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Boxes className="size-3.5" />
        <span>
          Tip: press <Shortcut>/</Shortcut> in any list to filter, click a row to open details.
        </span>
      </div>
    </div>
  )
}

function Shortcut({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-flex items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  )
}
