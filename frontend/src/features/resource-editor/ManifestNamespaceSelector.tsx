import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { NamespaceFavoriteButton } from '@/features/contexts/NamespaceFavoriteButton'
import { selectFavorites, useNamespaceFavorites } from '@/store/namespaceFavorites'

type Props = {
  contextName: string
  namespaces: string[]
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
  container: HTMLDivElement | null
}

export function ManifestNamespaceSelector({ contextName, namespaces, value, onValueChange, disabled, container }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const favorites = useNamespaceFavorites(selectFavorites(contextName))
  const toggleFavorite = useNamespaceFavorites((state) => state.toggle)
  // A kubeconfig namespace can be absent from the list when list access is restricted.
  const names = [...new Set([...namespaces, ...(value ? [value] : [])])].sort((a, b) => a.localeCompare(b))
  const matches = names.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase()))
  const favoriteNames = matches.filter((name) => favorites.includes(name))
  const otherNames = matches.filter((name) => !favorites.includes(name))
  const customName = search.trim()
  // Selecting a new target does not create a Namespace; server review still validates it.
  const canUseCustom = customName.length <= 63 && /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(customName) && !names.includes(customName)
  const select = (name: string) => {
    if (disabled) return
    onValueChange(name)
    setOpen(false)
    setSearch('')
  }
  const row = (name: string) => (
    <CommandItem key={name} value={name} onSelect={() => select(name)} className="[&>svg:last-child]:hidden">
      <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center">
        {value === name && <Check className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <NamespaceFavoriteButton name={name} favorite={favorites.includes(name)} onToggle={() => toggleFavorite(contextName, name)} />
    </CommandItem>
  )

  return (
    <Popover open={open && !disabled} onOpenChange={(next) => { setOpen(next); setSearch('') }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-label="Default namespace"
          aria-expanded={open && !disabled}
          disabled={disabled}
          className="w-44 justify-between text-xs"
        >
          <span className="truncate">{value || 'Select a namespace'}</span>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent container={container} collisionBoundary={container} collisionPadding={8} className="w-72 max-w-[85vw] p-0" align="start">
        <Command shouldFilter={false} className="max-h-[var(--radix-popover-content-available-height)]">
          <CommandInput aria-label="Filter target namespaces" placeholder="Filter namespaces…" value={search} onValueChange={setSearch} />
          <CommandList hideScrollbar={false} className="min-h-0 overscroll-contain">
            <CommandEmpty>No namespaces match.</CommandEmpty>
            {favoriteNames.length > 0 && <CommandGroup heading="Favorites">{favoriteNames.map(row)}</CommandGroup>}
            {favoriteNames.length > 0 && otherNames.length > 0 && <CommandSeparator />}
            {otherNames.length > 0 && <CommandGroup heading="Namespaces">{otherNames.map(row)}</CommandGroup>}
            {canUseCustom && (
              <CommandGroup heading="Custom namespace">
                <CommandItem value={`use:${customName}`} onSelect={() => select(customName)}>
                  Use "{customName}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
