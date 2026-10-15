import { useId, useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { NamespaceFavoriteButton } from '@/features/contexts/NamespaceFavoriteButton'
import { selectFavorites, useNamespaceFavorites } from '@/store/namespaceFavorites'
import { isValidNamespaceName } from './manifestModel'

type Props = {
  contextName: string
  namespaces: string[]
  value: string
  onValueChange: (value: string) => void
  onCreateNamespace: (value: string) => boolean
  disabled: boolean
  container: HTMLDivElement | null
}

export function ManifestNamespaceSelector({ contextName, namespaces, value, onValueChange, onCreateNamespace, disabled, container }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState('')
  const nameId = useId()
  const favorites = useNamespaceFavorites(selectFavorites(contextName))
  const toggleFavorite = useNamespaceFavorites((state) => state.toggle)
  // A kubeconfig namespace can be absent from the list when list access is restricted.
  const names = [...new Set([...namespaces, ...(value ? [value] : [])])].sort((a, b) => a.localeCompare(b))
  const matches = names.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase()))
  const favoriteNames = matches.filter((name) => favorites.includes(name))
  const otherNames = matches.filter((name) => !favorites.includes(name))
  const customName = search.trim()
  // Selecting a new target does not create a Namespace; server review still validates it.
  const canUseCustom = isValidNamespaceName(customName) && !names.includes(customName)
  const namespaceName = newName.trim()
  const validName = isValidNamespaceName(namespaceName)
  const nameError = !namespaceName ? '' : !validName
    ? 'Use 1–63 lowercase letters, numbers or hyphens. Start and end with a letter or number.'
    : namespaces.includes(namespaceName) ? 'This namespace is already listed. Select it from the list.' : ''
  const close = () => {
    setOpen(false)
    setSearch('')
    setCreating(false)
    setNewName('')
    setCreateError('')
  }
  const select = (name: string) => {
    if (disabled) return
    onValueChange(name)
    close()
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
    <Popover open={open && !disabled} onOpenChange={(next) => { if (next) setOpen(true); else close() }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-label="Namespace"
          aria-expanded={open && !disabled}
          disabled={disabled}
          className="w-44 justify-between text-xs"
        >
          <span className="truncate">{value || 'Select a namespace'}</span>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent container={container} collisionBoundary={container} collisionPadding={8} className="w-72 max-w-[85vw] gap-0 p-0" align="start">
        {creating ? (
          <form
            aria-label="New namespace"
            className="flex max-h-[var(--radix-popover-content-available-height)] flex-col gap-3 overflow-y-auto p-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (disabled || !validName || nameError) return
              if (onCreateNamespace(namespaceName)) close()
              else setCreateError('Could not add the namespace. Check the manifest for errors.')
            }}
          >
            <span className="text-sm font-medium">New namespace</span>
            <div className="space-y-1.5">
              <label htmlFor={nameId} className="text-xs text-muted-foreground">Namespace name</label>
              <Input
                id={nameId}
                autoFocus
                autoComplete="off"
                value={newName}
                aria-invalid={!!nameError}
                aria-describedby={`${nameId}-help`}
                onChange={(event) => { setNewName(event.target.value); setCreateError('') }}
              />
              <p id={`${nameId}-help`} className={`text-xs ${nameError ? 'text-destructive' : 'text-muted-foreground'}`}>
                {nameError || 'Added to this draft and created after review.'}
              </p>
            </div>
            {createError && <p role="alert" className="text-xs text-destructive">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="xs" onClick={() => setCreating(false)}>Back</Button>
              <Button type="submit" size="xs" disabled={disabled || !validName || !!nameError}>
                <Plus className="size-3" aria-hidden="true" /> Add namespace
              </Button>
            </div>
          </form>
        ) : (
          <>
            <Command shouldFilter={false} className="min-h-0 max-h-[calc(var(--radix-popover-content-available-height)-2.5rem)]">
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
            <div className="shrink-0 border-t border-border p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setCreating(true)
                  setNewName(customName || (namespaces.includes(value) ? '' : value))
                  setCreateError('')
                }}
              >
                <Plus className="size-3.5" aria-hidden="true" /> New namespace…
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
