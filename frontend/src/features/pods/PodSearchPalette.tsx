import { useCallback, useEffect, useMemo, useState } from 'react'
import { defaultFilter } from 'cmdk'
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
import { stableList } from '@/lib/stableList'
import { useResources } from '@/store/resources'
import { useActiveContexts, useIsAggregated, useUIStore } from '@/store/ui'

// Spreading a PodInfo (a generated class) into a plain object drops its
// convertValues method, so omit it — hits are plain display rows, not
// round-trippable bindings.
type Hit = Omit<PodInfo, 'convertValues'> & { __ctx: string }

const MAX_RENDERED_PODS = 100

export function PodSearchPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const setSelectedView = useUIStore((s) => s.setSelectedView)

  const podsByCtx = useResources((s) => s.pods)
  const setPods = useResources((s) => s.setPods)

  // The Pods table shares this store slot; merging through stableList keeps
  // row identities stable so palette refreshes don't re-render its rows.
  const storePods = useCallback(
    (ctx: string, list: PodInfo[] | null) =>
      setPods(ctx, stableList(useResources.getState().pods[ctx], list ?? [])),
    [setPods],
  )

  // Refresh pods in every active context on open. Stores fill when the user
  // visits the Pods view; the palette must not depend on that having happened.
  useEffect(() => {
    if (!open || activeContexts.length === 0) return
    let cancelled = false
    for (const ctx of activeContexts) {
      api
        .listPods(ctx, '')
        .then((list) => {
          if (!cancelled) storePods(ctx, list)
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [open, activeContexts, storePods])

  // Keep the live cache fresh while the dialog is open.
  useEffect(() => {
    if (!open || activeContexts.length === 0) return
    const unsub = onKubeChange('Pod', (ctx) => {
      if (!activeContexts.includes(ctx)) return
      api
        .listPods(ctx, '')
        .then((list) => storePods(ctx, list))
        .catch(() => {})
    })
    return unsub
  }, [open, activeContexts, storePods])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setQuery('')
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

  const matchingHits = useMemo(() => {
    const search = query.trim()
    if (search.length === 0) return hits

    return hits
      .map((hit) => ({
        hit,
        score: defaultFilter(`${hit.namespace} ${hit.name} ${hit.__ctx}`, search),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ hit }) => hit)
  }, [hits, query])

  const visibleHits = matchingHits.slice(0, MAX_RENDERED_PODS)
  const hiddenHitCount = matchingHits.length - visibleHits.length

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
      title="Pod search"
      description="Jump to any pod across active contexts"
      shouldFilter={false}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
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
        {visibleHits.length > 0 && (
          <CommandGroup heading={`Pods (${matchingHits.length})`}>
            {visibleHits.map((p) => (
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
                  setQuery('')
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
      <div
        className={
          hiddenHitCount > 0
            ? 'border-t border-border/50 px-3 py-2 text-center text-xs text-muted-foreground'
            : 'sr-only'
        }
        aria-live="polite"
        aria-atomic="true"
      >
        {hiddenHitCount > 0
          ? `Showing ${MAX_RENDERED_PODS} of ${matchingHits.length} matching pods. Refine your search to narrow the list.`
          : ''}
      </div>
    </CommandDialog>
  )
}
