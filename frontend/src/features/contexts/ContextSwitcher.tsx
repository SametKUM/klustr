import { useEffect, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { api, type ContextInfo } from '@/lib/api'
import { ProviderIcon, ProviderIconStack } from '@/features/_shared/providerIcons'
import { useActiveContexts, useUIStore } from '@/store/ui'
import { COLOR_PALETTE, resolveTagMeta } from './contextTagMeta'
import { TagBadge } from './TagBadge'

export function ContextSwitcher() {
  const [contexts, setContexts] = useState<ContextInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const activeContexts = useActiveContexts()
  const toggleAggregated = useUIStore((s) => s.toggleAggregatedContext)
  const clearAggregated = useUIStore((s) => s.clearAggregatedContexts)
  const setAggregatedContexts = useUIStore((s) => s.setAggregatedContexts)
  const setSelectedContext = useUIStore((s) => s.setSelectedContext)
  const autoConnectContext = useUIStore((s) => s.defaultContext)
  const contextTags = useUIStore((s) => s.contextTags)
  const customTags = useUIStore((s) => s.customTags)
  const contextGroups = useUIStore((s) => s.contextGroups)
  const activeGroupId = useUIStore((s) => s.activeGroupId)

  useEffect(() => {
    let cancelled = false
    api
      .listContexts()
      .then((cfg) => {
        if (cancelled) return
        setContexts(cfg.contexts)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(String(e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const label = loading
    ? 'Loading…'
    : error
      ? 'No kubeconfig'
      : activeContexts.length === 0
        ? 'Select context'
        : activeContexts.length === 1
          ? activeContexts[0]
          : `${activeContexts.length} contexts`
  const activeContextInfos = activeContexts
    .map((name) => contexts.find((c) => c.name === name))
    .filter((c): c is ContextInfo => c !== undefined)
  const activeSet = new Set(activeContexts)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={loading || !!error}
          title={activeContexts.length > 1 ? activeContexts.join(', ') : undefined}
        >
          {activeContextInfos.length > 0 && (
            <ProviderIconStack
              contexts={activeContextInfos}
              size="sm"
              borderClass="border-background"
            />
          )}
          <span className="max-w-[18rem] truncate">{label}</span>
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[90vw] p-0" align="start">
        {activeContexts.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-1.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
              {activeContexts.length} active
            </span>
            <button
              type="button"
              onClick={() => {
                clearAggregated()
                setOpen(false)
              }}
              title="Disconnect all"
              aria-label="Disconnect all"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-3" />
              Disconnect
            </button>
          </div>
        )}
        <Command>
          <CommandInput placeholder="Filter contexts…" />
          <CommandList className="max-h-[24rem]">
            <CommandEmpty>No contexts match.</CommandEmpty>
            {contextGroups.length > 0 && (
              <>
                <CommandGroup heading="Groups">
                  {contextGroups.map((g) => {
                    const isActive = g.id === activeGroupId
                    const palette = COLOR_PALETTE[g.color] ?? COLOR_PALETTE.sky
                    const members = g.contexts
                      .map((name) => contexts.find((c) => c.name === name))
                      .filter((c): c is ContextInfo => c !== undefined)
                    const missing = g.contexts.length - members.length
                    return (
                      <CommandItem
                        key={g.id}
                        value={`__group_${g.id}_${g.name}`}
                        onSelect={() => {
                          // Activate only the members that exist in the live
                          // kubeconfig — setAggregatedContexts just dedupes, it
                          // doesn't drop stale names, so passing raw g.contexts
                          // would attach a phantom context (wrong count, an empty
                          // column, a permanently-red ping). Mirrors connectGroup.
                          if (members.length === 0) return
                          if (members.length === 1) {
                            setSelectedContext(members[0].name)
                          } else {
                            setAggregatedContexts(
                              members.map((m) => m.name),
                              g.id,
                            )
                          }
                          setOpen(false)
                        }}
                        className="items-center gap-2.5 py-2"
                      >
                        <Checkbox checked={isActive} />
                        <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${palette.dotClass}`} />
                        {members.length > 0 && (
                          <ProviderIconStack
                            contexts={members}
                            size="sm"
                            borderClass="border-popover"
                          />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium" title={g.name}>
                            {g.name}
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {g.contexts.length} cluster{g.contexts.length === 1 ? '' : 's'}
                            {missing > 0 && (
                              <span className="ml-1 text-amber-500">· {missing} missing</span>
                            )}
                          </span>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {contexts.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">No contexts found.</div>
            ) : (
              <CommandGroup heading="Kubeconfig contexts">
                {contexts.map((c) => {
                  const isActive = activeSet.has(c.name)
                  const isAutoConnect = c.name === autoConnectContext
                  const tagMetas = (contextTags[c.name] ?? [])
                    .map((id) => resolveTagMeta(id, customTags))
                    .filter(
                      (m): m is NonNullable<ReturnType<typeof resolveTagMeta>> => m !== null,
                    )
                  return (
                    <CommandItem
                      key={c.name}
                      value={c.name}
                      onSelect={() => {
                        setSelectedContext(c.name)
                        setOpen(false)
                      }}
                      className="items-center gap-2.5 py-2"
                    >
                      <Checkbox checked={isActive} onToggle={() => toggleAggregated(c.name)} />
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted leading-none shadow-sm">
                        <ProviderIcon context={c} className="block size-4 shrink-0" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="min-w-0 flex-1 truncate text-sm font-medium"
                            title={c.name}
                          >
                            {c.name}
                          </span>
                          {tagMetas.map((m) => (
                            <TagBadge key={m.id} meta={m} size="xs" />
                          ))}
                          {isAutoConnect && (
                            <span className="shrink-0 rounded bg-muted px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                              auto
                            </span>
                          )}
                        </div>
                        {(c.server || c.cluster) && (
                          <div
                            className="truncate text-[11px] text-muted-foreground"
                            title={c.server || c.cluster}
                          >
                            {c.server || c.cluster}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function Checkbox({ checked, onToggle }: { checked: boolean; onToggle?: () => void }) {
  const box = (
    <span
      aria-hidden
      className={[
        'inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/40 bg-transparent',
      ].join(' ')}
    >
      {checked && (
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
    </span>
  )
  if (!onToggle) return box
  return (
    <button
      type="button"
      aria-label={checked ? 'Remove from selection' : 'Add to selection'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className="-m-1.5 shrink-0 rounded p-1.5 transition-colors hover:bg-muted"
    >
      {box}
    </button>
  )
}
