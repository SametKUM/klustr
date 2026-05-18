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
import { ProviderIcon } from '@/features/_shared/providerIcons'
import { useActiveContexts, useUIStore } from '@/store/ui'
import { resolveTagMeta } from './contextTagMeta'

export function ContextSwitcher() {
  const [contexts, setContexts] = useState<ContextInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const activeContexts = useActiveContexts()
  const toggleAggregated = useUIStore((s) => s.toggleAggregatedContext)
  const clearAggregated = useUIStore((s) => s.clearAggregatedContexts)
  const autoConnectContext = useUIStore((s) => s.defaultContext)
  const contextTags = useUIStore((s) => s.contextTags)
  const customTags = useUIStore((s) => s.customTags)

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
  const singleCtx =
    activeContexts.length === 1 ? contexts.find((c) => c.name === activeContexts[0]) : null
  const activeSet = new Set(activeContexts)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || !!error}
          title={activeContexts.length > 1 ? activeContexts.join(', ') : undefined}
        >
          {singleCtx && <ProviderIcon context={singleCtx} className="size-3.5" />}
          <span className="max-w-[18rem] truncate">{label}</span>
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[90vw] p-0" align="start">
        <Command>
          <CommandInput placeholder="Filter contexts…" />
          <CommandList className="max-h-[24rem]">
            <CommandEmpty>No contexts match.</CommandEmpty>
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
                      onSelect={() => toggleAggregated(c.name)}
                      className="items-start gap-2 py-2"
                    >
                      <Checkbox checked={isActive} />
                      <ProviderIcon context={c} className="mt-0.5 size-3.5 shrink-0" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="min-w-0 flex-1 truncate text-sm font-medium"
                            title={c.name}
                          >
                            {c.name}
                          </span>
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
                        {tagMetas.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {tagMetas.map((m) => (
                              <span
                                key={m.id}
                                className={`rounded border px-1 py-px text-[9px] font-semibold leading-tight tracking-wider ${m.badgeClass}`}
                                aria-label={m.label}
                              >
                                {m.shortLabel}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
            {activeContexts.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem value="__disconnect__" onSelect={() => clearAggregated()}>
                    <LogOut className="size-3.5" />
                    <span className="text-sm">Disconnect all</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
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
}
