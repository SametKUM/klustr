import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Layers,
  Loader2,
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
import { ProviderIcon, providerMeta } from '@/features/_shared/providerIcons'
import { api, type ContextInfo } from '@/lib/api'
import { useUIStore, type ContextGroup, type TagColor } from '@/store/ui'
import { COLOR_PALETTE, TAG_COLOR_ORDER, resolveTagMeta, type ContextTagMeta } from './contextTagMeta'
import { ContextTagMenuContent } from './ContextTagPicker'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; contexts: ContextInfo[] }
  | { kind: 'error'; message: string }

export function ConnectionsScreen() {
  const setSelectedContext = useUIStore((s) => s.setSelectedContext)
  const setAggregatedContexts = useUIStore((s) => s.setAggregatedContexts)
  const defaultContext = useUIStore((s) => s.defaultContext)
  const setDefaultContext = useUIStore((s) => s.setDefaultContext)
  const contextTags = useUIStore((s) => s.contextTags)
  const contextGroups = useUIStore((s) => s.contextGroups)
  const upsertContextGroup = useUIStore((s) => s.upsertContextGroup)
  const removeContextGroup = useUIStore((s) => s.removeContextGroup)

  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [query, setQuery] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [editing, setEditing] = useState<ContextGroup | null>(null)

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

  const pickedCount = picked.size
  const pickedNames = useMemo(
    () => contexts.filter((c) => picked.has(c.name)).map((c) => c.name),
    [contexts, picked],
  )

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
            <h1 className="text-lg font-semibold tracking-tight">Choose contexts</h1>
            <p className="text-xs text-muted-foreground">
              Pick a single context, or check two or more to view them together. Mark one as
              auto-connect to skip this screen on next launch.
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

          {state.kind === 'ready' && (
            <GroupsSection
              groups={contextGroups}
              contexts={contexts}
              onConnectGroup={connectGroup}
              onCreate={() =>
                setEditing({
                  id: cryptoRandomId(),
                  name: '',
                  contexts: [],
                  color: 'sky',
                })
              }
              onEdit={(g) => setEditing(g)}
              onDelete={(id) => removeContextGroup(id)}
            />
          )}

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
                    isPicked={picked.has(c.name)}
                    tagIds={contextTags[c.name] ?? []}
                    onConnect={() => connectSingle(c.name)}
                    onTogglePick={() => togglePick(c.name)}
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

function GroupsSection({
  groups,
  contexts,
  onConnectGroup,
  onCreate,
  onEdit,
  onDelete,
}: {
  groups: ContextGroup[]
  contexts: ContextInfo[]
  onConnectGroup: (group: ContextGroup) => void
  onCreate: () => void
  onEdit: (group: ContextGroup) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Groups
        </h2>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onCreate}>
          <Plus className="size-3" />
          New group
        </Button>
      </div>
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          No groups yet. Create one to connect to 2+ contexts in a single click.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              contexts={contexts}
              onConnect={() => onConnectGroup(g)}
              onEdit={() => onEdit(g)}
              onDelete={() => onDelete(g.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function GroupCard({
  group,
  contexts,
  onConnect,
  onEdit,
  onDelete,
}: {
  group: ContextGroup
  contexts: ContextInfo[]
  onConnect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const members = group.contexts
    .map((name) => contexts.find((c) => c.name === name))
    .filter((c): c is ContextInfo => c !== undefined)
  const missing = group.contexts.length - members.length
  const colorClasses = COLOR_PALETTE[group.color] ?? COLOR_PALETTE.sky
  return (
    <li>
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
        className={[
          'group relative flex w-full cursor-pointer items-start gap-2.5 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'hover:border-ring hover:bg-accent',
        ].join(' ')}
      >
        <span
          aria-hidden
          className={`absolute left-0 top-0 h-full w-[3px] ${colorClasses.barClass}`}
        />
        <span
          aria-hidden
          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md border ${colorClasses.badgeClass}`}
        >
          <Layers className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate pr-12 text-sm font-medium">{group.name}</div>
          <div
            className="truncate text-xs text-muted-foreground"
            title={members.map((m) => m.name).join(', ')}
          >
            {members.length} context{members.length === 1 ? '' : 's'}
            {missing > 0 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">({missing} missing)</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {members.slice(0, 4).map((m) => (
              <span
                key={m.name}
                className="inline-flex max-w-[8rem] items-center gap-1 rounded border border-border bg-background/60 px-1 py-px text-[10px]"
              >
                <ProviderIcon context={m} className="size-3 shrink-0" />
                <span className="truncate">{m.name}</span>
              </span>
            ))}
            {members.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{members.length - 4} more</span>
            )}
          </div>
        </div>
        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label="Edit group"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="inline-flex size-5 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground hover:bg-muted"
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
            className="inline-flex size-5 items-center justify-center rounded-md border border-destructive/40 bg-background/80 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </li>
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
                  >
                    {selected && <Check className="size-3 text-white" />}
                  </button>
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

function PickCheckbox({ checked }: { checked: boolean }) {
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

function ContextCard({
  context,
  isDefault,
  isPicked,
  tagIds,
  onConnect,
  onTogglePick,
  onToggleDefault,
}: {
  context: ContextInfo
  isDefault: boolean
  isPicked: boolean
  tagIds: string[]
  onConnect: () => void
  onTogglePick: () => void
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
      <div
        role="button"
        tabIndex={0}
        aria-label={`Connect to ${context.name}`}
        aria-pressed={isPicked}
        onClick={onConnect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onConnect()
          }
        }}
        className={[
          'group relative flex w-full cursor-pointer items-start gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isPicked
            ? 'border-primary bg-accent'
            : 'border-border hover:border-ring hover:bg-accent',
        ].join(' ')}
      >
        {primaryTagMeta && (
          <span
            className={`absolute left-0 top-0 h-full w-[3px] rounded-l-lg ${primaryTagMeta.dotClass}`}
            aria-hidden
          />
        )}
        <button
          type="button"
          aria-label={isPicked ? `Unselect ${context.name}` : `Add ${context.name} to selection`}
          aria-pressed={isPicked}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePick()
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="-m-1 inline-flex shrink-0 items-center justify-center rounded p-1 hover:bg-muted/60"
        >
          <PickCheckbox checked={isPicked} />
        </button>
        <ProviderIcon context={context} className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate pr-7 text-sm font-medium">{context.name}</div>
          <div className="truncate pr-7 text-xs text-muted-foreground">
            {context.server || context.cluster || meta.label}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <CardTagBadges contextName={context.name} tagMetas={tagMetas} />
          </div>
        </div>
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
                'absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-md border transition-opacity',
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
    </li>
  )
}
