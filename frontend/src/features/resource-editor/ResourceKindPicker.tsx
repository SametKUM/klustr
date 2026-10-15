import { useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import type { ManifestKind } from '@/lib/api'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { filterResourceKinds, resourceKindKey } from './resourceKindSearch'

export function ResourceKindPicker({ resources, onSelect }: {
  resources: ManifestKind[]
  onSelect: (mapping: ManifestKind) => void
}) {
  const [search, setSearch] = useState('')
  const matches = filterResourceKinds(resources, search)
  return (
    <Command shouldFilter={false}>
      <CommandInput
        aria-label="Find a resource type"
        placeholder="Find a resource type…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No resource types found.</CommandEmpty>
        <CommandGroup>
          {matches.map((mapping) => (
            <CommandItem
              key={resourceKindKey(mapping)}
              value={resourceKindKey(mapping)}
              onSelect={() => onSelect(mapping)}
              title={mapping.resource}
            >
              <FilePlus2 className="size-4" />
              <span>{mapping.kind}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{mapping.apiVersion}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
