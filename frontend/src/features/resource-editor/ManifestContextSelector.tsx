import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Props = {
  contexts: string[]
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
  container: HTMLDivElement | null
}

export function ManifestContextSelector({ contexts, value, onValueChange, disabled, container }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const names = [...new Set(contexts)]
  const disconnected = !!value && !names.includes(value)
  const matches = names.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase()))
  const showDisconnected = disconnected && value.toLowerCase().includes(search.trim().toLowerCase())

  return (
    <Popover open={open && !disabled} onOpenChange={(next) => { setOpen(next); setSearch('') }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-label="Target context"
          aria-expanded={open && !disabled}
          disabled={disabled}
          title={value || undefined}
          className="min-w-44 max-w-80 justify-between text-xs"
        >
          <span className="truncate">{value ? `${value}${disconnected ? ' (disconnected)' : ''}` : 'Select a context'}</span>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent container={container} collisionBoundary={container} collisionPadding={8} className="w-80 max-w-[85vw] p-0" align="start">
        <Command shouldFilter={false} className="max-h-[var(--radix-popover-content-available-height)]">
          <CommandInput aria-label="Filter target contexts" placeholder="Filter contexts…" value={search} onValueChange={setSearch} />
          <CommandList hideScrollbar={false} className="min-h-0 overscroll-contain">
            <CommandEmpty>No active contexts match.</CommandEmpty>
            <CommandGroup heading="Active contexts">
              {matches.map((name) => (
                <CommandItem key={name} value={name} className="[&>svg:last-child]:hidden" onSelect={() => {
                  if (disabled) return
                  if (name !== value) onValueChange(name)
                  setOpen(false)
                  setSearch('')
                }}>
                  <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center">
                    {value === name && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 truncate" title={name}>{name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {showDisconnected && (
              <CommandGroup heading="Disconnected">
                <CommandItem value={value} disabled className="[&>svg:last-child]:hidden">
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate" title={value}>{value} (disconnected)</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
