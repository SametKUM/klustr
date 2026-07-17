import { useEffect, useMemo, useState } from 'react'
import { Boxes, ExternalLink, LayoutGrid, SquareTerminal } from 'lucide-react'
import { toast } from 'sonner'
import { ProviderIcon } from '@/features/_shared/providerIcons'
import { useTerminalStore } from '@/store/terminals'
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
import { crdKey, useCRDStore } from '@/store/crds'
import { useActiveContexts, useUIStore } from '@/store/ui'
import { groupByAPIGroup } from '@/features/crds/crdGrouping'
import { useVisibleResourceGroups } from './useVisibleResourceGroups'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const activeContexts = useActiveContexts()
  const toggleAggregatedContext = useUIStore((s) => s.toggleAggregatedContext)
  const setSelectedView = useUIStore((s) => s.setSelectedView)
  const setSelectedCRD = useUIStore((s) => s.setSelectedCRD)
  const groups = useVisibleResourceGroups()
  const crds = useCRDStore((s) => s.crds)
  const crdGroups = useMemo(() => groupByAPIGroup(crds), [crds])

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

        {crds.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Custom Resources">
              {crdGroups.flatMap((group) =>
                group.crds.map((crd) => {
                  const key = crdKey(crd)
                  return (
                    <CommandItem
                      key={key}
                      value={`custom resource ${crd.kind} ${crd.group} ${crd.resource} ${crd.singular} ${crd.shortNames.join(' ')}`}
                      onSelect={() => {
                        setSelectedCRD(key)
                        setOpen(false)
                      }}
                    >
                      <Boxes />
                      <span className="truncate">{crd.kind}</span>
                      <span className="ml-auto max-w-48 truncate font-mono text-[10px] text-muted-foreground">
                        {crd.group}
                      </span>
                    </CommandItem>
                  )
                }),
              )}
            </CommandGroup>
          </>
        )}

        {activeContexts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Terminal">
              {activeContexts.map((ctx) => (
                <CommandItem
                  key={`term-${ctx}`}
                  value={`terminal ${ctx}`}
                  onSelect={() => {
                    useTerminalStore.getState().openTab(ctx)
                    setOpen(false)
                  }}
                >
                  <SquareTerminal />
                  <span className="truncate">Open terminal — {ctx}</span>
                </CommandItem>
              ))}
              {activeContexts.map((ctx) => (
                <CommandItem
                  key={`systerm-${ctx}`}
                  value={`system terminal ${ctx}`}
                  onSelect={() => {
                    setOpen(false)
                    api
                      .openInSystemTerminal(ctx, useTerminalStore.getState().preferredAppId)
                      .catch((e) =>
                        toast.error('Could not open system terminal', {
                          description: String(e),
                        }),
                      )
                  }}
                >
                  <ExternalLink />
                  <span className="truncate">Open in system terminal — {ctx}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

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
