import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { type NamespaceInfo } from '@/lib/api'
import { useResources } from '@/store/resources'
import { selectFavorites, useNamespaceFavorites } from '@/store/namespaceFavorites'
import { useActiveContexts, useUIStore } from '@/store/ui'

export function NamespaceSearchPalette() {
  const [open, setOpen] = useState(false)
  const activeContexts = useActiveContexts()
  const selectedContext = useUIStore((s) => s.selectedContext)
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const toggleSelectedNamespace = useUIStore((s) => s.toggleSelectedNamespace)
  const clearSelectedNamespaces = useUIStore((s) => s.clearSelectedNamespaces)
  const namespacesByContext = useResources((s) => s.namespaces)
  const favorites = useNamespaceFavorites(selectFavorites(selectedContext))
  const toggleFavorite = useNamespaceFavorites((s) => s.toggle)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Namespace search"
      description="Toggle namespaces in the current context (multi-select)"
    >
      <CommandInput placeholder="Search namespaces…" />
      <CommandList>
        <CommandEmpty>
          {activeContexts.length > 0 ? 'No matching namespaces.' : 'Select a context first.'}
        </CommandEmpty>
        <CommandGroup heading="Scope">
          <CommandItem value="__all__ All namespaces" onSelect={() => clearSelectedNamespaces()}>
            <Checkbox checked={selectedNamespaces.length === 0} />
            <span className="flex-1 truncate">All namespaces</span>
          </CommandItem>
        </CommandGroup>
        {favoriteNamespaces.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Favorites">
              {favoriteNamespaces.map((ns) => (
                <PaletteRow
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
            <CommandGroup heading={`Namespaces (${otherNamespaces.length})`}>
              {otherNamespaces.map((ns) => (
                <PaletteRow
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
    </CommandDialog>
  )
}

type RowProps = {
  ns: NamespaceInfo
  selected: boolean
  favorite: boolean
  onToggleSelect: () => void
  onToggleFavorite: () => void
}

function PaletteRow({ ns, selected, favorite, onToggleSelect, onToggleFavorite }: RowProps) {
  return (
    <CommandItem value={ns.name} onSelect={onToggleSelect}>
      <Checkbox checked={selected} />
      <span className="flex-1 truncate">{ns.name}</span>
      {ns.phase !== 'Active' && (
        <span className="rounded bg-muted px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
          {ns.phase}
        </span>
      )}
      <button
        type="button"
        aria-label={favorite ? `Unfavorite ${ns.name}` : `Favorite ${ns.name}`}
        title={favorite ? 'Unfavorite' : 'Favorite'}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite()
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
