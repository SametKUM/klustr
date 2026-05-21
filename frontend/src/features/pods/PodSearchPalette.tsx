import { useEffect, useMemo, useState } from 'react'
import { Box } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { api, type PodInfo } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { useResources } from '@/store/resources'
import { useActiveContexts, useIsAggregated, useUIStore } from '@/store/ui'

type Hit = PodInfo & { __ctx: string }

export function PodSearchPalette() {
  const [open, setOpen] = useState(false)
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const setSelectedView = useUIStore((s) => s.setSelectedView)

  const podsByCtx = useResources((s) => s.pods)
  const setPods = useResources((s) => s.setPods)

  // Refresh pods in every active context on open. Stores fill when the user
  // visits the Pods view; the palette must not depend on that having happened.
  useEffect(() => {
    if (!open || activeContexts.length === 0) return
    let cancelled = false
    for (const ctx of activeContexts) {
      api
        .listPods(ctx, '')
        .then((list) => {
          if (!cancelled) setPods(ctx, list ?? [])
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [open, activeContexts, setPods])

  // Keep the live cache fresh while the dialog is open.
  useEffect(() => {
    if (!open || activeContexts.length === 0) return
    const unsub = onKubeChange('Pod', (ctx) => {
      if (!activeContexts.includes(ctx)) return
      api
        .listPods(ctx, '')
        .then((list) => setPods(ctx, list ?? []))
        .catch(() => {})
    })
    return unsub
  }, [open, activeContexts, setPods])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hits: Hit[] = useMemo(() => {
    const out: Hit[] = []
    for (const ctx of activeContexts) {
      for (const p of podsByCtx[ctx] ?? []) {
        out.push({ ...p, __ctx: ctx })
      }
    }
    out.sort((a, b) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name))
    return out
  }, [podsByCtx, activeContexts])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Pod search"
      description="Jump to any pod across active contexts"
    >
      <CommandInput
        placeholder={
          isAggregated
            ? `Search pods across ${activeContexts.length} contexts…`
            : 'Search pods (namespace, name)…'
        }
      />
      <CommandList>
        <CommandEmpty>
          {activeContexts.length === 0 ? 'Select a context first.' : 'No matching pods.'}
        </CommandEmpty>
        {hits.length > 0 && (
          <CommandGroup heading={`Pods (${hits.length})`}>
            {hits.map((p) => (
              <CommandItem
                key={`${p.__ctx}/${p.namespace}/${p.name}`}
                value={`${p.namespace} ${p.name} ${p.__ctx}`}
                onSelect={() => {
                  setSelectedView('pods')
                  setSelectedResource({
                    kind: 'Pod',
                    namespace: p.namespace,
                    name: p.name,
                    context: p.__ctx,
                  })
                  setOpen(false)
                }}
              >
                <Box />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {p.namespace} · {p.status} · {p.ready}
                  </div>
                </div>
                {isAggregated && (
                  <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {p.__ctx}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
