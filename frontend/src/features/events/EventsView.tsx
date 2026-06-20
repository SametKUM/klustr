import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, RefreshCw, Search, X } from 'lucide-react'
import { api, type EventInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { formatAge } from '@/lib/time'
import { namespaceQuery } from '@/lib/namespaceFilter'
import { ErrorBox, Th, Td } from '@/features/_shared/DetailPrimitives'
import { useActiveContexts, useIsAggregated, useUIStore } from '@/store/ui'

type TaggedEvent = EventInfo & { contextName: string }

type SortKey = 'type' | 'reason' | 'age' | 'count'

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  active: boolean
  dir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  return (
    <th className="px-2 py-1.5 text-left font-medium uppercase tracking-wide">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase hover:text-foreground"
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-30" />
        )}
      </button>
    </th>
  )
}

export function EventsView() {
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)
  const [events, setEvents] = useState<TaggedEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('age')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const ctxKey = activeContexts.join('|')
  // Events have no informer (the API is List-only), so unlike every other list
  // view this screen can't be fed by onKubeChange. Poll like metrics do, and
  // gate setState on a generation token so a slow in-flight response from a
  // previous context/namespace can't overwrite the current one.
  const genRef = useRef(0)

  const refresh = useCallback(
    async (silent = false) => {
      if (activeContexts.length === 0) return
      const gen = ++genRef.current
      if (!silent) setLoading(true)
      setError(null)
      try {
        const { apiNamespace, matches } = namespaceQuery(selectedNamespaces)
        const results = await Promise.all(
          activeContexts.map((ctx) =>
            api
              .listEvents(ctx, apiNamespace, '', '')
              .then((list) =>
                list.map((e) => Object.assign(e, { contextName: ctx }) as TaggedEvent),
              )
              .catch(() => [] as TaggedEvent[]),
          ),
        )
        if (gen !== genRef.current) return
        const merged: TaggedEvent[] = []
        for (const list of results) {
          for (const e of list) {
            if (selectedNamespaces.length > 1 && !matches(e.namespace)) continue
            merged.push(e)
          }
        }
        merged.sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''))
        setEvents(merged)
      } catch (err) {
        if (gen === genRef.current) setError(String(err))
      } finally {
        if (gen === genRef.current && !silent) setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctxKey, selectedNamespaces],
  )

  useEffect(() => {
    refresh()
    const id = setInterval(() => refresh(true), 15_000)
    return () => clearInterval(id)
  }, [refresh])

  // The list is bounded at 200 events server-side, so filter + sort client-side
  // on every keystroke without debounce — it's cheap at this size and keeps the
  // input instant.
  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase()
    const matched = term
      ? events.filter((e) =>
          [
            e.type,
            e.reason,
            e.message,
            e.namespace,
            e.objectKind,
            e.objectName,
            e.source,
            e.contextName,
          ].some((f) => f?.toLowerCase().includes(term)),
        )
      : events
    const arr = [...matched]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
        case 'reason':
          cmp = a.reason.localeCompare(b.reason)
          break
        case 'count':
          cmp = a.count - b.count
          break
        case 'age':
          cmp = (a.lastSeen ?? '').localeCompare(b.lastSeen ?? '')
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [events, filter, sortKey, sortDir])

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'age' || key === 'count' ? 'desc' : 'asc')
    }
  }

  if (activeContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a kubeconfig context to see events.
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          {loading
            ? 'Loading…'
            : filter.trim()
              ? `${visible.length} of ${events.length} event${events.length === 1 ? '' : 's'}`
              : `${events.length} event${events.length === 1 ? '' : 's'}`}
          {selectedNamespaces.length === 0
            ? ' across all namespaces'
            : selectedNamespaces.length === 1
              ? ` in ${selectedNamespaces[0]}`
              : ` in ${selectedNamespaces.length} namespaces`}
          {isAggregated ? ` across ${activeContexts.length} contexts` : ''}
        </span>
        <div className="relative ml-auto w-64 max-w-full">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && filter) setFilter('')
            }}
            placeholder="Filter events"
            className="h-7 w-full rounded border border-border bg-background pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {filter && (
            <button
              type="button"
              aria-label="Clear filter"
              onClick={() => setFilter('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refresh()}
          disabled={loading}
          className="h-7 gap-1.5 text-xs"
        >
          <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        {!error && events.length === 0 && !loading && (
          <div className="py-8 text-center text-xs text-muted-foreground">No events.</div>
        )}
        {events.length > 0 && visible.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No events match the filter.
          </div>
        )}
        {visible.length > 0 && (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  {isAggregated && <Th>Context</Th>}
                  <SortHeader label="Type" sortKey="type" active={sortKey === 'type'} dir={sortDir} onSort={onSort} />
                  <SortHeader label="Reason" sortKey="reason" active={sortKey === 'reason'} dir={sortDir} onSort={onSort} />
                  <SortHeader label="Age" sortKey="age" active={sortKey === 'age'} dir={sortDir} onSort={onSort} />
                  <Th>Namespace</Th>
                  <Th>Object</Th>
                  <Th>From</Th>
                  <SortHeader label="Count" sortKey="count" active={sortKey === 'count'} dir={sortDir} onSort={onSort} />
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const clickable = !!(e.objectKind && e.objectName)
                  return (
                    <tr
                      key={e.contextName + '/' + e.namespace + '/' + e.name}
                      className={`border-t border-border align-top ${
                        clickable ? 'cursor-pointer hover:bg-muted/40' : ''
                      }`}
                      onClick={
                        clickable
                          ? () =>
                              setSelectedResource({
                                kind: e.objectKind as any,
                                namespace: e.namespace,
                                name: e.objectName,
                                context: e.contextName,
                              })
                          : undefined
                      }
                    >
                      {isAggregated && <Td className="font-mono text-xs">{e.contextName}</Td>}
                      <Td><span className={typeClass(e.type)}>{e.type}</span></Td>
                      <Td className="font-mono">{e.reason}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{formatAge(e.lastSeen)}</Td>
                      <Td>{e.namespace || '—'}</Td>
                      <Td className="font-mono text-xs">
                        {clickable ? `${e.objectKind}/${e.objectName}` : '—'}
                      </Td>
                      <Td className="text-muted-foreground">{e.source || '—'}</Td>
                      <Td className="font-mono">{e.count}</Td>
                      <Td className="max-w-[28rem] whitespace-pre-wrap break-words">{e.message}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function typeClass(type: string): string {
  if (type === 'Warning') return 'text-amber-600 dark:text-amber-400 font-medium'
  if (type === 'Error') return 'text-destructive font-medium'
  return 'text-muted-foreground'
}
