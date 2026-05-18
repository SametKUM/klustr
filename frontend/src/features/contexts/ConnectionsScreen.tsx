import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, RefreshCcw, Search, Tag, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ThemePicker } from '@/features/_shared/ThemePicker'
import { ProviderIcon, providerMeta } from '@/features/_shared/providerIcons'
import { api, type ContextInfo } from '@/lib/api'
import { useUIStore } from '@/store/ui'
import { resolveTagMeta, type ContextTagMeta } from './contextTagMeta'
import { ContextTagMenuContent } from './ContextTagPicker'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; contexts: ContextInfo[] }
  | { kind: 'error'; message: string }

export function ConnectionsScreen() {
  const setSelectedContext = useUIStore((s) => s.setSelectedContext)
  const defaultContext = useUIStore((s) => s.defaultContext)
  const setDefaultContext = useUIStore((s) => s.setDefaultContext)
  const contextTags = useUIStore((s) => s.contextTags)

  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [query, setQuery] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    api
      .listContexts()
      .then((cfg) => {
        if (cancelled) return
        setState({ kind: 'ready', contexts: cfg.contexts })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setState({ kind: 'error', message: String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const contexts = state.kind === 'ready' ? state.contexts : []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contexts
    return contexts.filter((c) => {
      const meta = providerMeta(c)
      return (
        c.name.toLowerCase().includes(q) ||
        (c.cluster ?? '').toLowerCase().includes(q) ||
        (c.server ?? '').toLowerCase().includes(q) ||
        meta.label.toLowerCase().includes(q)
      )
    })
  }, [contexts, query])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-semibold tracking-tight">Klustr</span>
        <ThemePicker />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-10">
          <div className="flex w-full max-w-5xl flex-col gap-5">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-lg font-semibold tracking-tight">Choose a context</h1>
            <p className="text-xs text-muted-foreground">
              Connect to a cluster from your <code className="rounded bg-muted px-1 font-mono text-[11px]">~/.kube/config</code>. Mark one as auto-connect to skip this screen next launch.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contexts…"
                className="h-9 pl-8"
                autoFocus
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((k) => k + 1)}
              disabled={state.kind === 'loading'}
              title="Reload kubeconfig"
            >
              <RefreshCcw className={state.kind === 'loading' ? 'animate-spin' : ''} />
              Reload
            </Button>
          </div>

          <div>
            {state.kind === 'loading' && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading kubeconfig…
              </div>
            )}

            {state.kind === 'error' && (
              <div className="mx-auto max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-center">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="size-4" />
                  Could not read kubeconfig
                </div>
                <div className="mt-2 break-words font-mono text-xs text-muted-foreground">{state.message}</div>
              </div>
            )}

            {state.kind === 'ready' && filtered.length === 0 && (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {contexts.length === 0 ? 'No contexts found in kubeconfig.' : 'No contexts match your search.'}
              </div>
            )}

            {state.kind === 'ready' && filtered.length > 0 && (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c) => (
                  <ContextCard
                    key={c.name}
                    context={c}
                    isDefault={c.name === defaultContext}
                    tagIds={contextTags[c.name] ?? []}
                    onConnect={() => setSelectedContext(c.name)}
                    onToggleDefault={() =>
                      setDefaultContext(c.name === defaultContext ? null : c.name)
                    }
                  />
                ))}
              </ul>
            )}
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function CardTagBadges({
  contextName,
  tagMetas,
}: {
  contextName: string
  tagMetas: ContextTagMeta[]
}) {
  const [open, setOpen] = useState(false)
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const trigger =
    tagMetas.length > 0 ? (
      <span
        role="button"
        tabIndex={0}
        aria-label="Change tags"
        onClick={stop}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            stop(e)
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="inline-flex cursor-pointer items-center gap-1 rounded transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tagMetas.map((m) => (
          <span
            key={m.id}
            className={`rounded border px-1 py-px text-[10px] font-semibold tracking-wider ${m.badgeClass}`}
            aria-label={m.label}
          >
            {m.shortLabel}
          </span>
        ))}
      </span>
    ) : (
      <span
        role="button"
        tabIndex={0}
        aria-label="Add tag"
        onClick={stop}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            stop(e)
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
      >
        <Tag className="size-3" />
        <span>Tag</span>
      </span>
    )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1" onClick={stop}>
        <ContextTagMenuContent contextName={contextName} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

function ContextCard({
  context,
  isDefault,
  tagIds,
  onConnect,
  onToggleDefault,
}: {
  context: ContextInfo
  isDefault: boolean
  tagIds: string[]
  onConnect: () => void
  onToggleDefault: () => void
}) {
  const customTags = useUIStore((s) => s.customTags)
  const meta = providerMeta(context)
  const tagMetas = tagIds
    .map((id) => resolveTagMeta(id, customTags))
    .filter((m): m is ContextTagMeta => m !== null)
  const primaryTagMeta = tagMetas[0] ?? null
  return (
    <li>
      <button
        type="button"
        onClick={onConnect}
        className="group relative flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3.5 py-3 pb-9 text-left transition-colors hover:border-ring hover:bg-accent"
      >
        {primaryTagMeta && (
          <span
            className={`absolute left-0 top-0 h-full w-[3px] rounded-l-lg ${primaryTagMeta.dotClass}`}
            aria-hidden
          />
        )}
        <ProviderIcon context={context} className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{context.name}</span>
            <CardTagBadges contextName={context.name} tagMetas={tagMetas} />
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {context.server || context.cluster || meta.label}
          </div>
        </div>
        <span
          role="button"
          aria-label={isDefault ? 'Disable auto-connect on launch' : 'Enable auto-connect on launch'}
          aria-pressed={isDefault}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onToggleDefault()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              e.preventDefault()
              onToggleDefault()
            }
          }}
          className={[
            'absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-opacity',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isDefault
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 opacity-100 dark:text-amber-400'
              : 'border-border bg-background/80 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100',
          ].join(' ')}
          title={isDefault ? 'Auto-connecting to this context on launch' : 'Connect to this context on launch'}
        >
          {isDefault ? <Check className="size-3" /> : <Zap className="size-3" />}
          <span>Auto-connect</span>
        </span>
      </button>
    </li>
  )
}
