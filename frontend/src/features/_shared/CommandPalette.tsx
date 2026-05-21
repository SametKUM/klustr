import { useEffect, useMemo, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { ProviderIcon } from '@/features/_shared/providerIcons'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { api, type ContextInfo } from '@/lib/api'
import { useCRDStore } from '@/store/crds'
import { useActiveContexts, useUIStore } from '@/store/ui'
import { ARGO_GROUP, RESOURCE_GROUPS } from './resourceGroups'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const activeContexts = useActiveContexts()
  const toggleAggregatedContext = useUIStore((s) => s.toggleAggregatedContext)
  const setSelectedView = useUIStore((s) => s.setSelectedView)
  const setSelectedCRD = useUIStore((s) => s.setSelectedCRD)
  const crds = useCRDStore((s) => s.crds)

  const [contexts, setContexts] = useState<ContextInfo[]>([])

  useEffect(() => {
    api
      .listContexts()
      .then((cfg) => setContexts(cfg.contexts))
      .catch(() => setContexts([]))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const groups = useMemo(() => {
    const showArgo = crds.some(
      (c) => c.group === 'argoproj.io' && c.resource === 'applications',
    )
    return showArgo ? [...RESOURCE_GROUPS, ARGO_GROUP] : RESOURCE_GROUPS
  }, [crds])

  const activeContextSet = useMemo(() => new Set(activeContexts), [activeContexts])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to a view or toggle a context"
    >
      <CommandInput placeholder="Jump to view, toggle context…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {groups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={group.label}>
              {group.items
                .filter((item) => item.view !== undefined)
                .map((item) => (
                  <CommandItem
                    key={item.label}
                    value={`${group.label} ${item.label}`}
                    onSelect={() => {
                      if (item.view) {
                        setSelectedCRD(null)
                        setSelectedView(item.view)
                        setOpen(false)
                      }
                    }}
                  >
                    <LayoutGrid />
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </div>
        ))}

        {contexts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contexts">
              {contexts.map((c) => {
                const isActive = activeContextSet.has(c.name)
                return (
                  <CommandItem
                    key={c.name}
                    value={`context ${c.name} ${c.server}`}
                    onSelect={() => {
                      toggleAggregatedContext(c.name)
                      setOpen(false)
                    }}
                  >
                    <ProviderIcon context={c} />
                    <span className="truncate">{c.name}</span>
                    {isActive && (
                      <span className="ml-auto rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        active
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
