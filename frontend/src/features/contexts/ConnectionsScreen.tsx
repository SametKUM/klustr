import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Command,
  Layers,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Tag,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemePicker } from '@/features/_shared/ThemePicker'
import { ReadOnlyToggle } from '@/features/_shared/ReadOnlyToggle'
import { ProviderIcon, ProviderIconStack, providerMeta } from '@/features/_shared/providerIcons'
import { api, type ContextInfo } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import {
  useUIStore,
  type ContextGroup,
  type LastSession,
  type TagColor,
} from '@/store/ui'
import {
  BUILT_IN_TAG_ORDER,
  COLOR_PALETTE,
  TAG_COLOR_ORDER,
  resolveTagMeta,
  type ContextTagMeta,
} from './contextTagMeta'
import { ContextTagMenuContent } from './ContextTagPicker'
import {
  CredentialHelpersHint,
  CredentialKeyButton,
  CredentialMappingDialog,
} from './CredentialHelpersSection'
import { useAwsVaultDetected, useCredentialsStore, useCredentialStatus } from '@/store/credentials'
import { TagBadge } from './TagBadge'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; contexts: ContextInfo[] }
  | { kind: 'error'; message: string }

type GroupedSection = {
  id: string
  meta: ContextTagMeta | null
  items: ContextInfo[]
}

const UNTAGGED_KEY = '__untagged__'

export function ConnectionsScreen() {
  const setSelectedContext = useUIStore((s) => s.setSelectedContext)
  const setAggregatedContexts = useUIStore((s) => s.setAggregatedContexts)
  const defaultContext = useUIStore((s) => s.defaultContext)
  const setDefaultContext = useUIStore((s) => s.setDefaultContext)
  const contextTags = useUIStore((s) => s.contextTags)
  const customTags = useUIStore((s) => s.customTags)
  const contextGroups = useUIStore((s) => s.contextGroups)
  const upsertContextGroup = useUIStore((s) => s.upsertContextGroup)
  const removeContextGroup = useUIStore((s) => s.removeContextGroup)
  const lastSession = useUIStore((s) => s.lastSession)
  const clearLastSession = useUIStore((s) => s.clearLastSession)

  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [query, setQuery] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [editing, setEditing] = useState<ContextGroup | null>(null)
  const [mappingTarget, setMappingTarget] = useState<ContextInfo | null>(null)
  const setCredStatuses = useCredentialsStore((s) => s.setStatuses)

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

  // The shell-env import can finish after the first list and add a KUBECONFIG
  // defined only in the login shell. Refresh silently (no loading flash) so
  // those contexts fold in without the initial list having to block on it.
  useEffect(() => {
    let cancelled = false
    const unsub = onKubeChange('_contexts', () => {
      api
        .listContexts()
        .then((cfg) => {
          if (!cancelled) setState({ kind: 'ready', contexts: cfg.contexts })
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const contexts = state.kind === 'ready' ? state.contexts : []

  const [versions, setVersions] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (state.kind !== 'ready') return
    let cancelled = false
    setVersions({})
    // Skip exec-auth contexts: pinging them here, before any credential helper
    // is mapped, invokes `aws eks get-token` / aws-vault and fails or hangs —
    // a thundering herd on a large kubeconfig for a purely decorative version
    // label. Bound the rest to a small worker pool instead of fanning out a
    // /version call per context at once.
    const targets = contexts.filter((c) => !c.awsExec && !c.awsVaultExec)
    let next = 0
    const worker = async () => {
      while (!cancelled) {
        const idx = next++
        if (idx >= targets.length) return
        const c = targets[idx]
        try {
          const v = await api.pingContext(c.name)
          if (!cancelled) {
            setVersions((prev) => ({ ...prev, [c.name]: shortenK8sVersion(v.gitVersion) }))
          }
        } catch {
          if (!cancelled) {
            setVersions((prev) => ({ ...prev, [c.name]: null }))
          }
        }
      }
    }
    const concurrency = Math.min(5, targets.length)
    void Promise.all(Array.from({ length: concurrency }, () => worker()))
    return () => {
      cancelled = true
    }
  }, [state.kind, contexts])

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

  const sections: GroupedSection[] = useMemo(() => {
    const byKey = new Map<string, ContextInfo[]>()
    for (const c of filtered) {
      const tagIds = contextTags[c.name] ?? []
      const primary = tagIds[0] ?? UNTAGGED_KEY
      const arr = byKey.get(primary) ?? []
      arr.push(c)
      byKey.set(primary, arr)
    }
    const customKeys = [...byKey.keys()]
      .filter((k) => k !== UNTAGGED_KEY && !BUILT_IN_TAG_ORDER.includes(k))
      .sort()
    const order = [...BUILT_IN_TAG_ORDER, ...customKeys, UNTAGGED_KEY]
    const out: GroupedSection[] = []
    for (const key of order) {
      const items = byKey.get(key)
      if (!items?.length) continue
      out.push({
        id: key,
        meta: key === UNTAGGED_KEY ? null : resolveTagMeta(key, customTags),
        items,
      })
    }
    return out
  }, [filtered, contextTags, customTags])

  const orderedVisible = useMemo(
    () => sections.flatMap((s) => s.items),
    [sections],
  )

  const heroContext = useMemo(
    () => (defaultContext ? contexts.find((c) => c.name === defaultContext) ?? null : null),
    [contexts, defaultContext],
  )

  const resolvedLastSession = useMemo(() => {
    if (!lastSession) return null
    const present = lastSession.contexts.filter((n) => contexts.some((c) => c.name === n))
    if (present.length === 0) return null
    if (
      heroContext &&
      present.length === 1 &&
      present[0] === heroContext.name &&
      !lastSession.groupId
    ) {
      return null
    }
    return { ...lastSession, contexts: present, missing: lastSession.contexts.length - present.length }
  }, [lastSession, contexts, heroContext])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      if (e.key < '1' || e.key > '9') return
      const ctx = orderedVisible[Number.parseInt(e.key, 10) - 1]
      if (!ctx) return
      e.preventDefault()
      setSelectedContext(ctx.name)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [orderedVisible, setSelectedContext])

  const togglePick = (name: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const connectPicked = () => {
    const list = [...picked]
    if (list.length === 0) return
    if (list.length === 1) {
      setSelectedContext(list[0])
    } else {
      setAggregatedContexts(list)
    }
  }

  const connectSingle = (name: string) => {
    setSelectedContext(name)
  }

  const connectGroup = (group: ContextGroup) => {
    const members = group.contexts.filter((m) => contexts.some((c) => c.name === m))
    if (members.length === 0) return
    if (members.length === 1) {
      setSelectedContext(members[0])
    } else {
      setAggregatedContexts(members, group.id)
    }
  }

  const reconnectLastSession = (session: LastSession) => {
    const members = session.contexts.filter((n) => contexts.some((c) => c.name === n))
    if (members.length === 0) return
    if (members.length === 1) {
      setSelectedContext(members[0])
    } else {
      const groupStillExists =
        session.groupId && contextGroups.some((g) => g.id === session.groupId)
      setAggregatedContexts(members, groupStillExists ? session.groupId : null)
    }
  }

  const pickedCount = picked.size
  const pickedNames = useMemo(
    () => contexts.filter((c) => picked.has(c.name)).map((c) => c.name),
    [contexts, picked],
  )

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-semibold tracking-tight">Klustr</span>
        <div className="flex items-center gap-1">
          <ReadOnlyToggle />
          <ThemePicker />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Connect to a cluster</h1>
            <p className="text-xs text-muted-foreground">
              {state.kind === 'ready' ? (
                <>
                  {contexts.length} context{contexts.length === 1 ? '' : 's'} in kubeconfig
                  {contextGroups.length > 0 && (
                    <> · {contextGroups.length} group{contextGroups.length === 1 ? '' : 's'}</>
                  )}
                  {defaultContext && <> · auto-connect: <span className="font-medium text-foreground">{defaultContext}</span></>}
                  {!defaultContext && <> · pick one or check multiple to view together</>}
                </>
              ) : (
                <>Loading kubeconfig…</>
              )}
            </p>
          </div>

          {heroContext && (
            <HeroCard
              context={heroContext}
              tagMetas={(contextTags[heroContext.name] ?? [])
                .map((id) => resolveTagMeta(id, customTags))
                .filter((m): m is ContextTagMeta => m !== null)}
              onConnect={() => connectSingle(heroContext.name)}
              onClearDefault={() => setDefaultContext(null)}
            />
          )}

          {resolvedLastSession && (
            <LastSessionCard
              session={resolvedLastSession}
              contexts={contexts}
              contextTags={contextTags}
              customTags={customTags}
              contextGroups={contextGroups}
              onReconnect={() => reconnectLastSession(resolvedLastSession)}
              onDismiss={clearLastSession}
            />
          )}

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
              onClick={() =>
                setEditing({
                  id: cryptoRandomId(),
                  name: '',
                  contexts: [],
                  color: 'sky',
                })
              }
              title="Create a saved group of 2+ contexts"
            >
              <Plus />
              New group
            </Button>
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

          {state.kind === 'ready' && contextGroups.length > 0 && (
            <GroupChipRow
              groups={contextGroups}
              contexts={contexts}
              onConnect={connectGroup}
              onEdit={(g) => setEditing(g)}
              onDelete={(id) => removeContextGroup(id)}
            />
          )}

          {state.kind === 'ready' && <CredentialHelpersHint contexts={contexts} />}

          <div>
            {state.kind === 'loading' && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Spinner size="lg" />
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

            {state.kind === 'ready' && sections.length > 0 && (
              <div className="flex flex-col gap-5">
                {sections.map((section, sectionIdx) => {
                  const baseIdx = sections
                    .slice(0, sectionIdx)
                    .reduce((acc, s) => acc + s.items.length, 0)
                  return (
                    <ContextSection
                      key={section.id}
                      section={section}
                      baseIndex={baseIdx}
                      defaultContext={defaultContext}
                      picked={picked}
                      contextTags={contextTags}
                      versions={versions}
                      onConnect={connectSingle}
                      onTogglePick={togglePick}
                      onToggleDefault={(name) =>
                        setDefaultContext(name === defaultContext ? null : name)
                      }
                      onMapCredentials={setMappingTarget}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {pickedCount > 0 && (
        <div className="pointer-events-none sticky bottom-0 left-0 right-0 z-10 flex justify-center">
          <div className="pointer-events-auto mb-4 flex items-center gap-3 rounded-full border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
            <span
              className="max-w-xs truncate text-xs text-muted-foreground"
              title={pickedNames.join(', ')}
            >
              {pickedCount === 1
                ? pickedNames[0]
                : `${pickedCount} contexts: ${pickedNames.join(', ')}`}
            </span>
            <Button size="sm" onClick={connectPicked}>
              {pickedCount === 1
                ? 'Connect'
                : `Connect to ${pickedCount} contexts`}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <GroupEditorDialog
          group={editing}
          contexts={contexts}
          onCancel={() => setEditing(null)}
          onSave={(g) => {
            upsertContextGroup(g)
            setEditing(null)
          }}
        />
      )}

      <CredentialMappingDialog
        contexts={mappingTarget ? [mappingTarget] : []}
        open={mappingTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMappingTarget(null)
        }}
        onSaved={() => {
          api.listCredentialStatuses().then((list) => setCredStatuses(list ?? []))
        }}
      />
    </div>
  )
}

function cryptoRandomId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `g_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  }
}

function shortenK8sVersion(v: string): string {
  const trimmed = v.trim()
  if (!trimmed) return ''
  const semver = trimmed.split('-')[0].split('+')[0]
  return semver
}

function shortcutHint(index: number): string | null {
  if (index < 0 || index > 8) return null
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
  return `${isMac ? '⌘' : 'Ctrl'}${index + 1}`
}

function HeroCard({
  context,
  tagMetas,
  onConnect,
  onClearDefault,
}: {
  context: ContextInfo
  tagMetas: ContextTagMeta[]
  onConnect: () => void
  onClearDefault: () => void
}) {
  const meta = providerMeta(context)
  const primary = tagMetas[0] ?? null
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Connect to ${context.name}`}
      onClick={onConnect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onConnect()
        }
      }}
      className="group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 px-4 py-3 text-left transition-colors hover:border-ring hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {primary && (
        <span aria-hidden className={`absolute left-0 top-0 h-full w-1 ${primary.barClass}`} />
      )}
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-500">
        <Zap className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Auto-connect
          <span className="text-muted-foreground/60">·</span>
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            mark another card's ⚡ to change
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <ProviderIcon context={context} className="size-4 shrink-0" />
          <span className="truncate text-base font-semibold">{context.name}</span>
          {primary && <TagBadge meta={primary} />}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {meta.label}
          {context.server ? <> · {context.server}</> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Disable auto-connect"
          onClick={(e) => {
            e.stopPropagation()
            onClearDefault()
          }}
          className="hidden h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted group-hover:flex"
        >
          <X className="size-3" />
          Unpin
        </button>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">
          Connect
          <kbd className="rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1 font-mono text-[10px]">
            {isMac ? '⌘1' : 'Ctrl 1'}
          </kbd>
        </span>
      </div>
    </div>
  )
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

type ResolvedLastSession = LastSession & { missing: number }

function SessionBadge({
  isAggregated,
  primaryCtx,
  sessionContexts,
}: {
  isAggregated: boolean
  primaryCtx: ContextInfo | null
  sessionContexts: ContextInfo[]
}) {
  if (isAggregated && sessionContexts.length > 0) {
    return <ProviderIconStack contexts={sessionContexts} size="sm" borderClass="border-card" />
  }
  if (!isAggregated && primaryCtx) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted leading-none shadow-sm">
        <ProviderIcon context={primaryCtx} className="block size-4 shrink-0" />
      </span>
    )
  }
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted leading-none text-muted-foreground shadow-sm">
      {isAggregated ? <Layers className="block size-4" /> : <Clock className="block size-4" />}
    </span>
  )
}

function LastSessionCard({
  session,
  contexts,
  contextTags,
  customTags,
  contextGroups,
  onReconnect,
  onDismiss,
}: {
  session: ResolvedLastSession
  contexts: ContextInfo[]
  contextTags: Record<string, string[]>
  customTags: Record<string, import('@/store/ui').CustomTagDef>
  contextGroups: ContextGroup[]
  onReconnect: () => void
  onDismiss: () => void
}) {
  const isAggregated = session.contexts.length > 1
  const group =
    session.groupId ? contextGroups.find((g) => g.id === session.groupId) ?? null : null
  const primaryName = session.contexts[0]
  const primaryCtx = contexts.find((c) => c.name === primaryName) ?? null
  const primaryTagMeta =
    primaryCtx
      ? (() => {
          const ids = contextTags[primaryName] ?? []
          for (const id of ids) {
            const m = resolveTagMeta(id, customTags)
            if (m) return m
          }
          return null
        })()
      : null
  const groupPalette = group ? COLOR_PALETTE[group.color] ?? COLOR_PALETTE.sky : null

  let title: React.ReactNode
  let subtitle: React.ReactNode
  if (isAggregated) {
    title = group ? `Group · ${group.name}` : `${session.contexts.length} contexts`
    subtitle = (
      <span className="truncate" title={session.contexts.join(', ')}>
        {session.contexts.slice(0, 3).join(', ')}
        {session.contexts.length > 3 && ` +${session.contexts.length - 3} more`}
      </span>
    )
  } else {
    const meta = primaryCtx ? providerMeta(primaryCtx) : null
    title = primaryName
    subtitle = (
      <span className="truncate">
        {meta?.label}
        {primaryCtx?.server ? <> · {primaryCtx.server}</> : null}
      </span>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Reconnect to last session (${session.contexts.join(', ')})`}
      onClick={onReconnect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onReconnect()
        }
      }}
      className="group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-lg border border-border bg-card/60 px-3 py-2.5 text-left transition-colors hover:border-ring hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {(groupPalette || primaryTagMeta) && (
        <span
          aria-hidden
          className={`absolute left-0 top-0 h-full w-[3px] ${
            groupPalette ? groupPalette.barClass : primaryTagMeta!.barClass
          }`}
        />
      )}
      <SessionBadge
        isAggregated={isAggregated}
        primaryCtx={primaryCtx}
        sessionContexts={session.contexts
          .map((n) => contexts.find((c) => c.name === n))
          .filter((c): c is ContextInfo => c !== undefined)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Last session
          <span className="text-muted-foreground/40">·</span>
          <span className="font-normal normal-case tracking-normal">
            {formatRelativeTime(session.at)}
          </span>
          {session.missing > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-normal normal-case tracking-normal text-amber-500">
                {session.missing} missing
              </span>
            </>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {primaryTagMeta && !isAggregated && <TagBadge meta={primaryTagMeta} />}
        </div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label="Dismiss last session"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="hidden size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted group-hover:inline-flex"
        >
          <X className="size-3.5" />
        </button>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium">
          Reconnect
          <ArrowRight className="size-3" />
        </span>
      </div>
    </div>
  )
}

function GroupChipRow({
  groups,
  contexts,
  onConnect,
  onEdit,
  onDelete,
}: {
  groups: ContextGroup[]
  contexts: ContextInfo[]
  onConnect: (group: ContextGroup) => void
  onEdit: (group: ContextGroup) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Layers className="size-3" />
        Groups
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const members = g.contexts
            .map((name) => contexts.find((c) => c.name === name))
            .filter((c): c is ContextInfo => c !== undefined)
          const missing = g.contexts.length - members.length
          const palette = COLOR_PALETTE[g.color] ?? COLOR_PALETTE.sky
          return (
            <li key={g.id}>
              <GroupCard
                group={g}
                palette={palette}
                members={members}
                missing={missing}
                onConnect={() => onConnect(g)}
                onEdit={() => onEdit(g)}
                onDelete={() => onDelete(g.id)}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function GroupCard({
  group,
  palette,
  members,
  missing,
  onConnect,
  onEdit,
  onDelete,
}: {
  group: ContextGroup
  palette: { dotClass: string; barClass: string }
  members: ContextInfo[]
  missing: number
  onConnect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const providerLabels: string[] = []
  const seen = new Set<string>()
  for (const c of members) {
    const meta = providerMeta(c)
    if (seen.has(meta.id)) continue
    seen.add(meta.id)
    providerLabels.push(meta.label)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Connect to ${group.name}`}
      onClick={onConnect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onConnect()
        }
      }}
      className="group relative flex h-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg border border-border bg-card/60 pl-4 pr-3 py-3 text-left transition-colors hover:border-ring hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] ${palette.barClass}`} />
      <ProviderIconBadge members={members} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span aria-hidden className={`size-1.5 rounded-full ${palette.dotClass}`} />
          <span>Group</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-normal normal-case tracking-normal">
            {members.length} cluster{members.length === 1 ? '' : 's'}
          </span>
          {missing > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-normal normal-case tracking-normal text-amber-500">
                {missing} missing
              </span>
            </>
          )}
        </div>
        <div className="mt-0.5 truncate text-base font-semibold" title={group.name}>
          {group.name}
        </div>
        {providerLabels.length > 0 && (
          <div
            className="mt-0.5 truncate text-xs text-muted-foreground"
            title={providerLabels.join(' · ')}
          >
            {providerLabels.slice(0, 3).join(' · ')}
            {providerLabels.length > 3 && ` +${providerLabels.length - 3}`}
          </div>
        )}
      </div>
      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
        <button
          type="button"
          aria-label="Edit group"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
        >
          <Pencil className="size-3" />
        </button>
        <button
          type="button"
          aria-label="Delete group"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="inline-flex size-6 items-center justify-center rounded-md border border-destructive/40 bg-background text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      <ArrowRight className="ml-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}

function ProviderIconBadge({ members }: { members: ContextInfo[] }) {
  if (members.length === 0) {
    return (
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted leading-none text-muted-foreground shadow-sm">
        <Layers className="block size-5" />
      </span>
    )
  }
  if (members.length === 1) {
    return (
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted leading-none shadow-sm">
        <ProviderIcon context={members[0]} className="block size-7 shrink-0" />
      </span>
    )
  }
  return (
    <span className="flex h-12 shrink-0 items-center pl-0.5">
      <ProviderIconStack contexts={members} size="md" />
    </span>
  )
}

function ContextSection({
  section,
  baseIndex,
  defaultContext,
  picked,
  contextTags,
  versions,
  onConnect,
  onTogglePick,
  onToggleDefault,
  onMapCredentials,
}: {
  section: GroupedSection
  baseIndex: number
  defaultContext: string | null
  picked: Set<string>
  contextTags: Record<string, string[]>
  versions: Record<string, string | null>
  onConnect: (name: string) => void
  onTogglePick: (name: string) => void
  onToggleDefault: (name: string) => void
  onMapCredentials: (context: ContextInfo) => void
}) {
  const isProd = section.id === 'prod'
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {section.meta ? (
          <>
            <span aria-hidden className={`size-2 rounded-full ${section.meta.dotClass}`} />
            <h2
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                isProd ? 'text-red-500' : 'text-foreground'
              }`}
            >
              {section.meta.label}
            </h2>
          </>
        ) : (
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Untagged
          </h2>
        )}
        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
          {section.items.length}
        </span>
        {isProd && (
          <span className="inline-flex items-center gap-1 text-[10px] text-red-500/80">
            <AlertTriangle className="size-3" />
            production
          </span>
        )}
        <div className="ml-auto h-px flex-1 bg-border/60" />
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {section.items.map((c, idx) => (
          <ContextCard
            key={c.name}
            context={c}
            isDefault={c.name === defaultContext}
            isPicked={picked.has(c.name)}
            tagIds={contextTags[c.name] ?? []}
            shortcut={shortcutHint(baseIndex + idx)}
            highlight={isProd}
            version={versions[c.name]}
            onConnect={() => onConnect(c.name)}
            onTogglePick={() => onTogglePick(c.name)}
            onToggleDefault={() => onToggleDefault(c.name)}
            onMapCredentials={() => onMapCredentials(c)}
          />
        ))}
      </ul>
    </section>
  )
}

function GroupEditorDialog({
  group,
  contexts,
  onCancel,
  onSave,
}: {
  group: ContextGroup
  contexts: ContextInfo[]
  onCancel: () => void
  onSave: (group: ContextGroup) => void
}) {
  const [name, setName] = useState(group.name)
  const [members, setMembers] = useState<Set<string>>(() => new Set(group.contexts))
  const [color, setColor] = useState<TagColor>(group.color)
  const [filter, setFilter] = useState('')
  const isNew = group.name.length === 0
  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && members.size >= 2

  const toggleMember = (n: string) => {
    setMembers((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return contexts
    return contexts.filter((c) => c.name.toLowerCase().includes(q))
  }, [contexts, filter])

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New group' : 'Edit group'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. prod, staging-fleet"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {TAG_COLOR_ORDER.map((c) => {
                const palette = COLOR_PALETTE[c]
                const selected = c === color
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    title={c}
                    onClick={() => setColor(c)}
                    className={[
                      'inline-flex size-5 items-center justify-center rounded-full transition-transform',
                      palette.dotClass,
                      selected
                        ? 'scale-110 ring-2 ring-offset-2 ring-ring ring-offset-background'
                        : 'hover:scale-105',
                    ].join(' ')}
                  />
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Members ({members.size})
              </label>
              <span className="text-[10px] text-muted-foreground">Pick at least 2</span>
            </div>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter contexts…"
              className="h-8"
            />
            <ul className="max-h-72 overflow-y-auto rounded-md border border-border">
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-xs text-muted-foreground">No contexts match.</li>
              )}
              {filtered.map((c) => {
                const checked = members.has(c.name)
                return (
                  <li
                    key={c.name}
                    onClick={() => toggleMember(c.name)}
                    className="flex cursor-pointer items-center gap-2 border-b border-border/60 px-3 py-1.5 text-sm last:border-b-0 hover:bg-muted/50"
                  >
                    <CheckboxBox checked={checked} />
                    <ProviderIcon context={c} className="size-3.5 shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            <X className="size-3.5" />
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              onSave({
                id: group.id,
                name: trimmed,
                contexts: [...members],
                color,
              })
            }
          >
            <Check className="size-3.5" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CheckboxBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        'inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/40 bg-transparent',
      ].join(' ')}
    >
      {checked && (
        <svg
          viewBox="0 0 12 12"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="2.5 6.5 5 9 9.5 3.5" />
        </svg>
      )}
    </span>
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
          <TagBadge key={m.id} meta={m} />
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

function hostnameOf(server: string | undefined): string | null {
  if (!server) return null
  try {
    return new URL(server).hostname
  } catch {
    return null
  }
}

function ContextCard({
  context,
  isDefault,
  isPicked,
  tagIds,
  shortcut,
  highlight,
  version,
  onConnect,
  onTogglePick,
  onToggleDefault,
  onMapCredentials,
}: {
  context: ContextInfo
  isDefault: boolean
  isPicked: boolean
  tagIds: string[]
  shortcut: string | null
  highlight: boolean
  version: string | null | undefined
  onConnect: () => void
  onTogglePick: () => void
  onToggleDefault: () => void
  onMapCredentials: () => void
}) {
  const customTags = useUIStore((s) => s.customTags)
  const awsVaultDetected = useAwsVaultDetected()
  const hasCredKey =
    !!useCredentialStatus(context.name) ||
    (context.awsExec && !context.awsVaultExec && awsVaultDetected)
  const meta = providerMeta(context)
  const tagMetas = tagIds
    .map((id) => resolveTagMeta(id, customTags))
    .filter((m): m is ContextTagMeta => m !== null)
  const primaryTagMeta = tagMetas[0] ?? null
  const cluster = context.cluster && context.cluster !== context.name ? context.cluster : null
  const host = !cluster ? hostnameOf(context.server) : null
  const secondary = cluster ?? host
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Connect to ${context.name}`}
        onClick={onConnect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onConnect()
          }
        }}
        className={[
          'group relative flex w-full cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isPicked
            ? 'border-primary bg-accent'
            : highlight
              ? 'border-red-500/30 bg-red-500/[0.03] hover:border-red-500/60 hover:bg-red-500/[0.06]'
              : 'border-border hover:border-ring hover:bg-accent',
        ].join(' ')}
      >
        {primaryTagMeta && (
          <span
            className={`absolute left-0 top-0 h-full w-[3px] rounded-l-lg ${primaryTagMeta.dotClass}`}
            aria-hidden
          />
        )}
        <div className="relative shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-muted leading-none shadow-sm transition-colors group-hover:bg-muted/80">
                <ProviderIcon context={context} className="block size-6 shrink-0" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-[20rem] text-xs">
              <div className="font-medium">{meta.label}</div>
              {context.server && (
                <div className="break-all font-mono text-[10px] text-muted-foreground">
                  {context.server}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            aria-label={isPicked ? `Unselect ${context.name}` : `Add ${context.name} to selection`}
            aria-pressed={isPicked}
            onClick={(e) => {
              e.stopPropagation()
              onTogglePick()
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className={[
              'absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-[4px] border bg-background shadow-sm transition-opacity',
              'focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
              isPicked
                ? 'border-primary bg-primary text-primary-foreground opacity-100'
                : 'border-border text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100',
            ].join(' ')}
          >
            {isPicked && (
              <svg
                viewBox="0 0 12 12"
                className="size-2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="2.5 6.5 5 9 9.5 3.5" />
              </svg>
            )}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-1.5 ${hasCredKey ? 'pr-12' : 'pr-7'}`}>
            <span className="truncate text-sm font-semibold leading-tight">{context.name}</span>
            {isDefault && (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400"
                title="Auto-connect on launch"
              >
                <Zap className="size-2.5" />
                Auto
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            <span className={meta.className}>{meta.label}</span>
            {secondary && <span className="text-muted-foreground/80"> · {secondary}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <CardTagBadges contextName={context.name} tagMetas={tagMetas} />
            <div className="ml-auto flex items-center gap-1.5">
              {shortcut && (
                <span className="inline-flex items-center gap-0.5 rounded border border-border/70 bg-background/60 px-1 py-px font-mono text-[9px] text-muted-foreground">
                  <Command className="size-2.5" />
                  {shortcut.replace(/^⌘|^Ctrl/, '')}
                </span>
              )}
              {version && (
                <span
                  className="font-mono text-[10px] text-muted-foreground/70 tabular-nums"
                  title="Kubernetes server version"
                >
                  {version}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1.5">
          <CredentialKeyButton context={context} onMap={onMapCredentials} />
          <Tooltip>
            <TooltipTrigger asChild>
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
                  'inline-flex size-5 items-center justify-center rounded-md border transition-opacity',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isDefault
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 opacity-100 dark:text-amber-400'
                    : 'border-border bg-background/80 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100',
                ].join(' ')}
              >
                {isDefault ? <Check className="size-3" /> : <Zap className="size-3" />}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[14rem] text-xs">
              {isDefault
                ? 'Auto-connect enabled — Klustr will skip this picker and open this context on next launch. Click to disable.'
                : 'Set as auto-connect — Klustr will skip this picker and open this context on next launch.'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </li>
  )
}
