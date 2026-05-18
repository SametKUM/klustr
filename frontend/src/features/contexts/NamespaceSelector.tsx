import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Star, X } from 'lucide-react'
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
import { api, type NamespaceInfo } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { namespaceLabel } from '@/lib/namespaceFilter'
import { useResources } from '@/store/resources'
import { selectFavorites, useNamespaceFavorites } from '@/store/namespaceFavorites'
import { useActiveContexts, useUIStore } from '@/store/ui'

export function NamespaceSelector() {
  const activeContexts = useActiveContexts()
  const selectedContext = useUIStore((s) => s.selectedContext)
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const toggleSelectedNamespace = useUIStore((s) => s.toggleSelectedNamespace)
  const clearSelectedNamespaces = useUIStore((s) => s.clearSelectedNamespaces)
  const namespacesByContext = useResources((s) => s.namespaces)
  const setNamespaces = useResources((s) => s.setNamespaces)
  const favorites = useNamespaceFavorites(selectFavorites(selectedContext))
  const toggleFavorite = useNamespaceFavorites((s) => s.toggle)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (activeContexts.length === 0) return
    let cancelled = false
    const reload = (ctx: string) => {
      api.listNamespaces(ctx).then((list) => {
        if (!cancelled) setNamespaces(ctx, list ?? [])
      })
    }
    for (const ctx of activeContexts) reload(ctx)
    const unsub = onKubeChange('Namespace', (ctx) => {
      if (activeContexts.includes(ctx)) reload(ctx)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [activeContexts, setNamespaces])

  const unifiedNamespaces = useMemo<NamespaceInfo[]>(() => {
    const byName = new Map<string, NamespaceInfo>()
    for (const ctx of activeContexts) {
      const list = namespacesByContext[ctx] ?? []
      for (const ns of list) {
        if (!byName.has(ns.name)) byName.set(ns.name, ns)
      }
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [activeContexts, namespacesByContext])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  const { favoriteNamespaces, otherNamespaces } = useMemo(() => {
    const fav: NamespaceInfo[] = []
    const others: NamespaceInfo[] = []
    for (const ns of unifiedNamespaces) {
      if (favoriteSet.has(ns.name)) fav.push(ns)
      else others.push(ns)
    }
    fav.sort((a, b) => a.name.localeCompare(b.name))
    return { favoriteNamespaces: fav, otherNamespaces: others }
  }, [unifiedNamespaces, favoriteSet])

  const disabled = activeContexts.length === 0
  const label =
    activeContexts.length === 0
      ? 'No context'
      : unifiedNamespaces.length === 0
        ? 'Loading…'
        : namespaceLabel(selectedNamespaces)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <span className="max-w-[14rem] truncate">{label}</span>
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 max-w-[90vw] p-0" align="start">
        <Command>
          <CommandInput placeholder="Filter namespaces…" />
          <CommandList>
            <CommandEmpty>No namespaces match.</CommandEmpty>
            <CommandGroup heading="Scope">
              <CommandItem
                value="__all__ All namespaces"
                onSelect={() => clearSelectedNamespaces()}
              >
                <Checkbox checked={selectedNamespaces.length === 0} />
                <span className="flex-1 truncate text-sm">All namespaces</span>
                {selectedNamespaces.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearSelectedNamespaces()
                    }}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3" />
                    Clear
                  </button>
                )}
              </CommandItem>
            </CommandGroup>
            {favoriteNamespaces.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Favorites">
                  {favoriteNamespaces.map((ns) => (
                    <NamespaceRow
                      key={ns.name}
                      ns={ns}
                      selected={selectedNamespaces.includes(ns.name)}
                      favorite
                      onToggleSelect={() => toggleSelectedNamespace(ns.name)}
                      onToggleFavorite={() =>
                        selectedContext && toggleFavorite(selectedContext, ns.name)
                      }
                    />
                  ))}
                </CommandGroup>
              </>
            )}
            {otherNamespaces.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Namespaces">
                  {otherNamespaces.map((ns) => (
                    <NamespaceRow
                      key={ns.name}
                      ns={ns}
                      selected={selectedNamespaces.includes(ns.name)}
                      favorite={false}
                      onToggleSelect={() => toggleSelectedNamespace(ns.name)}
                      onToggleFavorite={() =>
                        selectedContext && toggleFavorite(selectedContext, ns.name)
                      }
                    />
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

type RowProps = {
  ns: NamespaceInfo
  selected: boolean
  favorite: boolean
  onToggleSelect: () => void
  onToggleFavorite: () => void
}

function NamespaceRow({ ns, selected, favorite, onToggleSelect, onToggleFavorite }: RowProps) {
  return (
    <CommandItem value={ns.name} onSelect={onToggleSelect}>
      <Checkbox checked={selected} />
      <span className="flex-1 truncate text-sm">{ns.name}</span>
      {ns.phase !== 'Active' && (
        <span className="rounded bg-muted px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
          {ns.phase}
        </span>
      )}
      <FavoriteButton name={ns.name} favorite={favorite} onToggle={onToggleFavorite} />
    </CommandItem>
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

function FavoriteButton({
  name,
  favorite,
  onToggle,
}: {
  name: string
  favorite: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-label={favorite ? `Unfavorite ${name}` : `Favorite ${name}`}
      title={favorite ? 'Unfavorite' : 'Favorite'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={[
        '-mr-1.5 inline-flex size-5 shrink-0 items-center justify-center rounded transition-colors',
        favorite
          ? 'text-amber-500 hover:bg-muted'
          : 'text-muted-foreground/40 hover:bg-muted hover:text-foreground',
      ].join(' ')}
    >
      <Star className={['size-3.5', favorite ? 'fill-current' : ''].join(' ')} />
    </button>
  )
}
