import { useEffect, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from 'lucide-react'
import { onKubeChange } from '@/lib/events'
import { namespaceQuery } from '@/lib/namespaceFilter'
import { useActiveContexts, useIsAggregated, useUIStore, type ResourceKind } from '@/store/ui'
import { useTablePrefs } from '@/store/tablePrefs'
import { type ByContext } from '@/store/resources'
import { ColumnControls } from './ColumnControls'
import { RowContextMenu } from './RowContextMenu'

type RowIdentity = { namespace?: string; name?: string }

type Scope = 'namespaced' | 'cluster'

type Noun = { singular: string; plural: string }

export const KLUSTR_CTX = '__klustrCtx' as const

export type Tagged<T> = T & { [KLUSTR_CTX]: string }

export type ResourceTableProps<T> = {
  kind: string
  noun: Noun
  scope: Scope
  data: ByContext<T>
  setData: (ctx: string, list: T[]) => void
  fetch: (contextName: string, namespace: string) => Promise<T[]>
  columns: ColumnDef<T, any>[]
  defaultSort?: SortingState
  onRowClick?: (row: T, contextName: string) => void
}

function identityKey(ctx: string, r: RowIdentity): string {
  return `${ctx}/${r.namespace ?? ''}/${r.name ?? ''}`
}

function columnId<T>(c: ColumnDef<T, any>): string {
  if (c.id) return c.id
  const ak = (c as { accessorKey?: string }).accessorKey
  if (ak) return ak
  return ''
}

const EMPTY_SIZING: ColumnSizingState = {}

function sizingEqual(a: ColumnSizingState, b: ColumnSizingState): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function mergeOrder(all: string[], saved: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of saved) {
    if (all.includes(id) && !seen.has(id)) {
      result.push(id)
      seen.add(id)
    }
  }
  for (const id of all) {
    if (!seen.has(id)) result.push(id)
  }
  return result
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function ResourceTable<T>({
  kind,
  noun,
  scope,
  data,
  setData,
  fetch,
  columns,
  defaultSort,
  onRowClick,
}: ResourceTableProps<T>) {
  const activeContexts = useActiveContexts()
  const isAggregated = useIsAggregated()
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const selectedResource = useUIStore((s) => s.selectedResource)
  const lastSelectedResource = useUIStore((s) => s.lastSelectedResource)
  const query = useMemo(
    () =>
      scope === 'namespaced'
        ? namespaceQuery(selectedNamespaces)
        : { apiNamespace: '', matches: () => true },
    [scope, selectedNamespaces],
  )
  const [sorting, setSorting] = useState<SortingState>(defaultSort ?? [{ id: 'name', desc: false }])
  const [filter, setFilter] = useState('')
  const prefs = useTablePrefs((s) => s.byKind[kind])
  const columnSizing = useMemo<ColumnSizingState>(() => prefs?.sizing ?? EMPTY_SIZING, [prefs?.sizing])
  const setOrder = useTablePrefs((s) => s.setOrder)
  const setHidden = useTablePrefs((s) => s.setHidden)
  const setSizing = useTablePrefs((s) => s.setSizing)
  const resetPrefs = useTablePrefs((s) => s.reset)
  const [, setTick] = useState(0)
  const filterRef = useRef<HTMLInputElement>(null)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const [loadedSet, setLoadedSet] = useState<Set<string>>(() => new Set())
  const fetchRef = useRef(fetch)
  fetchRef.current = fetch
  const setDataRef = useRef(setData)
  setDataRef.current = setData

  const mergedData = useMemo<Tagged<T>[]>(() => {
    const out: Tagged<T>[] = []
    for (const ctx of activeContexts) {
      const list = data[ctx]
      if (!list || list.length === 0) continue
      for (const item of list) {
        if (scope === 'namespaced' && selectedNamespaces.length > 1) {
          const ns = (item as RowIdentity).namespace ?? ''
          if (!query.matches(ns)) continue
        }
        out.push({ ...(item as object), [KLUSTR_CTX]: ctx } as Tagged<T>)
      }
    }
    return out
  }, [activeContexts, data, scope, selectedNamespaces.length, query])

  useEffect(() => {
    if (selectedResource) return
    if (!lastSelectedResource) return
    const ctx = lastSelectedResource.context ?? activeContexts[0] ?? ''
    const key = identityKey(ctx, lastSelectedResource)
    setFlashKey(key)
    const id = window.setTimeout(() => setFlashKey(null), 1_200)
    return () => window.clearTimeout(id)
  }, [selectedResource, lastSelectedResource, activeContexts])

  useEffect(() => {
    if (mergedData.length === 0) setFilter('')
  }, [mergedData.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      filterRef.current?.focus()
      filterRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (activeContexts.length === 0) {
      setLoadedSet(new Set())
      return
    }
    setLoadedSet(new Set())
    let cancelled = false
    const reload = (ctx: string) => {
      fetchRef.current(ctx, query.apiNamespace).then((list) => {
        if (cancelled) return
        setDataRef.current(ctx, list ?? [])
        setLoadedSet((prev) => {
          if (prev.has(ctx)) return prev
          const next = new Set(prev)
          next.add(ctx)
          return next
        })
      }).catch(() => {
        if (cancelled) return
        setDataRef.current(ctx, [])
        setLoadedSet((prev) => {
          if (prev.has(ctx)) return prev
          const next = new Set(prev)
          next.add(ctx)
          return next
        })
      })
    }
    for (const ctx of activeContexts) reload(ctx)
    const unsub = onKubeChange(kind, (ctx) => {
      if (activeContexts.includes(ctx)) reload(ctx)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [activeContexts, query, kind])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  const tableColumns = useMemo<ColumnDef<Tagged<T>, any>[]>(() => {
    const baseCols = columns as unknown as ColumnDef<Tagged<T>, any>[]
    if (!isAggregated) return baseCols
    const ctxCol: ColumnDef<Tagged<T>, any> = {
      id: 'klustrContext',
      header: 'Context',
      accessorFn: (row) => row[KLUSTR_CTX],
    }
    return [ctxCol, ...baseCols]
  }, [columns, isAggregated])

  const allColumnIds = useMemo(() => tableColumns.map((c) => columnId(c)), [tableColumns])
  const columnOrder = useMemo(() => mergeOrder(allColumnIds, prefs?.order ?? []), [
    allColumnIds,
    prefs?.order,
  ])
  const columnVisibility = useMemo<VisibilityState>(() => {
    const v: VisibilityState = {}
    for (const id of allColumnIds) v[id] = !(prefs?.hidden ?? []).includes(id)
    return v
  }, [allColumnIds, prefs?.hidden])

  const table = useReactTable({
    data: mergedData,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter: filter,
      columnOrder,
      columnVisibility,
      columnSizing,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    onColumnOrderChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnOrder) : updater
      setOrder(kind, next)
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnVisibility) : updater
      const hidden = Object.entries(next)
        .filter(([, v]) => v === false)
        .map(([k]) => k)
      setHidden(kind, hidden)
    },
    onColumnSizingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnSizing) : updater
      if (sizingEqual(columnSizing, next)) return
      setSizing(kind, next)
    },
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60, size: 160 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (activeContexts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a kubeconfig context to see {noun.plural}.
      </div>
    )
  }

  const allLoaded = activeContexts.every((c) => loadedSet.has(c))
  const filteredCount = table.getRowModel().rows.length
  const total = mergedData.length
  const countLabel = !allLoaded
    ? `Loading ${noun.plural}…`
    : filter
      ? `${filteredCount} of ${total} ${total === 1 ? noun.singular : noun.plural}`
      : `${total} ${total === 1 ? noun.singular : noun.plural}`
  const scopeLabel =
    scope === 'namespaced'
      ? selectedNamespaces.length === 0
        ? ' across all namespaces'
        : selectedNamespaces.length === 1
          ? ` in ${selectedNamespaces[0]}`
          : ` in ${selectedNamespaces.length} namespaces`
      : ''
  const contextLabel = isAggregated ? ` across ${activeContexts.length} contexts` : ''

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="min-w-0">
          {countLabel}
          {scopeLabel}
          {contextLabel}
        </span>
        <div className="relative ml-auto w-64 max-w-full">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <input
            ref={filterRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (filter) setFilter('')
                else filterRef.current?.blur()
              }
            }}
            placeholder={`Filter ${noun.plural}   ⌨ /`}
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
        <ColumnControls table={table} onReset={() => resetPrefs(kind)} />
      </div>
      <div className="flex-1 overflow-auto">
        <table
          className="border-collapse text-sm"
          style={{ width: '100%', minWidth: table.getTotalSize(), tableLayout: 'fixed' }}
        >
          <thead className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted()
                  const canSort = h.column.getCanSort()
                  return (
                    <th
                      key={h.id}
                      style={{ width: h.getSize() }}
                      className="group relative select-none overflow-hidden px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    >
                      <span
                        className={[
                          'flex min-w-0 items-center gap-1',
                          canSort ? 'cursor-pointer' : '',
                        ].join(' ')}
                        onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      >
                        <span className="truncate">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </span>
                        {canSort &&
                          (sorted === 'asc' ? (
                            <ArrowUp className="size-3 shrink-0" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3 shrink-0" />
                          ) : (
                            <ChevronsUpDown className="size-3 shrink-0 opacity-30" />
                          ))}
                      </span>
                      <span
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        onClick={(e) => e.stopPropagation()}
                        className={[
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                          'opacity-0 group-hover:opacity-100',
                          h.column.getIsResizing() ? 'bg-primary opacity-100' : 'bg-border',
                        ].join(' ')}
                      />
                    </th>
                  )
                })}
                <th aria-hidden className="w-auto" />
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumns.length + 1}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {!allLoaded
                    ? `Loading ${noun.plural}…`
                    : filter
                      ? `No ${noun.plural} matching "${filter}".`
                      : `No ${noun.plural}${scope === 'namespaced' && selectedNamespaces.length > 0 ? scopeLabel : ''}.`}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const tagged = row.original as Tagged<T>
                const ctx = tagged[KLUSTR_CTX]
                const identity = tagged as unknown as RowIdentity
                const flashing = flashKey !== null && flashKey === identityKey(ctx, identity)
                const canPortForward =
                  kind === 'Pod' ? (tagged as { hasPorts?: boolean }).hasPorts === true : false
                const rowEl = (
                  <tr
                    key={row.id}
                    className={[
                      'border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors',
                      onRowClick ? 'cursor-pointer select-none' : '',
                      flashing ? 'bg-emerald-100/60 dark:bg-emerald-400/15' : '',
                    ].join(' ')}
                    onClick={onRowClick ? () => onRowClick(tagged as unknown as T, ctx) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="overflow-hidden truncate whitespace-nowrap px-3 py-1.5 align-middle"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                    <td aria-hidden />
                  </tr>
                )
                if (!identity.name) return rowEl
                return (
                  <RowContextMenu
                    key={row.id}
                    kind={kind as ResourceKind}
                    contextName={ctx}
                    namespace={identity.namespace ?? ''}
                    name={identity.name}
                    canPortForward={canPortForward}
                  >
                    {rowEl}
                  </RowContextMenu>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
