import { useEffect, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api, type ContextInfo } from '@/lib/api'
import { ProviderIcon } from '@/features/_shared/providerIcons'
import { useUIStore } from '@/store/ui'
import { resolveTagMeta } from './contextTagMeta'

export function ContextSwitcher() {
  const [contexts, setContexts] = useState<ContextInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selected = useUIStore((s) => s.selectedContext)
  const setSelected = useUIStore((s) => s.setSelectedContext)
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

  const label = loading ? 'Loading…' : error ? 'No kubeconfig' : (selected ?? 'Select context')
  const selectedCtx = selected ? contexts.find((c) => c.name === selected) : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading || !!error}>
          {selectedCtx && <ProviderIcon context={selectedCtx} className="size-3.5" />}
          <span className="max-w-[18rem] truncate">{label}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-w-[90vw]" align="start">
        <DropdownMenuLabel>Kubeconfig contexts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {contexts.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No contexts found.</div>
        ) : (
          contexts.map((c) => {
            const isSelected = selected === c.name
            const isAutoConnect = c.name === autoConnectContext
            const tagMetas = (contextTags[c.name] ?? [])
              .map((id) => resolveTagMeta(id, customTags))
              .filter((m): m is NonNullable<ReturnType<typeof resolveTagMeta>> => m !== null)
            return (
              <DropdownMenuItem
                key={c.name}
                onSelect={() => setSelected(c.name)}
                className={isSelected ? 'bg-accent text-accent-foreground data-[highlighted]:bg-accent' : ''}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <ProviderIcon context={c} className="mt-0.5 size-3.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-sm">
                      <span className="truncate">{c.name}</span>
                      {isAutoConnect && (
                        <span className="rounded bg-muted px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                          auto
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{c.server || c.cluster}</div>
                  </div>
                  {tagMetas.length > 0 && (
                    <div className="mt-0.5 flex shrink-0 flex-wrap items-center gap-1">
                      {tagMetas.map((m) => (
                        <span
                          key={m.id}
                          className={`rounded border px-1 py-px text-[10px] font-semibold tracking-wider ${m.badgeClass}`}
                          aria-label={m.label}
                        >
                          {m.shortLabel}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            )
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setSelected(null)}>
          <LogOut className="size-3.5" />
          <span className="text-sm">Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
