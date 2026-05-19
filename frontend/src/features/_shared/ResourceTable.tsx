import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ArrowDown, ArrowUp, ChevronsUpDown, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { onKubeChange } from '@/lib/events'
import { namespaceQuery } from '@/lib/namespaceFilter'
import { useActiveContexts, useIsAggregated, useUIStore, type ResourceKind } from '@/store/ui'
import { useTablePrefs } from '@/store/tablePrefs'
import { type ByContext } from '@/store/resources'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ColumnControls } from './ColumnControls'
import { RowContextMenu } from './RowContextMenu'
import { BulkDeleteDialog, BulkRestartDialog, type BulkItem } from './BulkActionDialogs'
import { isRestartable } from './RestartWorkloadButton'

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
  const persistedSizing = useMemo<ColumnSizingState>(
    () => prefs?.sizing ?? EMPTY_SIZING,
    [prefs?.sizing],
  )
  const setOrder = useTablePrefs((s) => s.setOrder)
  const setHidden = useTablePrefs((s) => s.setHidden)
  const setSizing = useTablePrefs((s) => s.setSizing)
  const resetPrefs = useTablePrefs((s) => s.reset)
  const [liveSizing, setLiveSizing] = useState<ColumnSizingState>(persistedSizing)
  const liveSizingRef = useRef(liveSizing)
  liveSizingRef.current = liveSizing
  const isResizingRef = useRef(false)
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({})
  useEffect(() => {
    if (isResizingRef.current) return
    if (sizingEqual(liveSizingRef.current, persistedSizing)) return
    setLiveSizing(persistedSizing)
  }, [persistedSizing])
  const startResize = useCallback(
    (colId: string) => (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const isTouch = 'touches' in e
      const startX = isTouch
        ? (e as React.TouchEvent).touches[0].clientX
        : (e as React.MouseEvent).clientX
      const el = colRefs.current[colId]
      const handleEl = (e.currentTarget as HTMLElement) ?? null
      const thEl = handleEl?.closest('th') as HTMLElement | null
      const measured = thEl?.getBoundingClientRect().width ?? 0
      const startWidth =
        measured > 0 ? measured : (liveSizingRef.current[colId] ?? 160)
      let last = startWidth
      isResizingRef.current = true
      if (handleEl) handleEl.dataset.resizing = 'true'

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const x =
          'touches' in ev
            ? (ev as TouchEvent).touches[0].clientX
            : (ev as MouseEvent).clientX
        const w = Math.max(60, Math.round(startWidth + (x - startX)))
        last = w
        if (el) el.style.width = `${w}px`
      }
      const onEnd = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onEnd)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onEnd)
        window.removeEventListener('touchcancel', onEnd)
        isResizingRef.current = false
        if (handleEl) delete handleEl.dataset.resizing
        if (last === startWidth) return
        const nextSizing: ColumnSizingState = { ...liveSizingRef.current, [colId]: last }
        setLiveSizing(nextSizing)
        setSizing(kind, nextSizing)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onEnd)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onEnd)
      window.addEventListener('touchcancel', onEnd)
    },
    [kind, setSizing],
  )
  const [dragColId, setDragColId] = useState<string | null>(null)
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkRestartOpen, setBulkRestartOpen] = useState(false)
  useEffect(() => {
    setSelectedKeys(new Set())
  }, [activeContexts, selectedNamespaces, kind])
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
  const columnOrder = useMemo(() => {
    const saved = prefs?.order ?? []
    if (!isAggregated || saved.includes('klustrContext')) {
      return mergeOrder(allColumnIds, saved)
    }
    const withoutCtx = allColumnIds.filter((id) => id !== 'klustrContext')
    return ['klustrContext', ...mergeOrder(withoutCtx, saved)]
  }, [allColumnIds, prefs?.order, isAggregated])
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
      columnSizing: liveSizing,
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
      setLiveSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (sizingEqual(prev, next)) return prev
        return next
      })
    },
    defaultColumn: { minSize: 60, size: 160 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const visibleRows = table.getRowModel().rows
  const visibleKeys = visibleRows
    .map((r) => {
      const tagged = r.original as Tagged<T>
      const ident = tagged as unknown as RowIdentity
      return ident.name ? identityKey(tagged[KLUSTR_CTX], ident) : null
    })
    .filter((k): k is string => k !== null)
  const selectedItems: BulkItem[] = []
  for (const r of visibleRows) {
    const tagged = r.original as Tagged<T>
    const ctx = tagged[KLUSTR_CTX]
    const ident = tagged as unknown as RowIdentity
    if (!ident.name) continue
    const key = identityKey(ctx, ident)
    if (!selectedKeys.has(key)) continue
    selectedItems.push({
      contextName: ctx,
      kind,
      namespace: ident.namespace ?? '',
      name: ident.name,
    })
  }
  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.has(k))
  const toggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleAllVisible = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const k of visibleKeys) next.delete(k)
      } else {
        for (const k of visibleKeys) next.add(k)
      }
      return next
    })
  }
  const clearSelection = () => setSelectedKeys(new Set())

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

  const canRestart = isRestartable(kind)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {selectedItems.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs">
          <span className="font-medium text-foreground">{selectedItems.length} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkDeleteOpen(true)}
            className="h-7 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          {canRestart && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkRestartOpen(true)}
              className="h-7 gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Restart
            </Button>
          )}
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}
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
          <colgroup>
            <col style={{ width: 36 }} />
            {table.getVisibleLeafColumns().map((col) => (
              <col
                key={col.id}
                ref={(el) => {
                  colRefs.current[col.id] = el
                }}
                style={{ width: col.getSize() }}
              />
            ))}
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                <th className="px-2 py-2 align-middle">
                  <Checkbox
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select all visible"
                  />
                </th>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted()
                  const canSort = h.column.getCanSort()
                  const colId = h.column.id
                  const isDragging = dragColId === colId
                  const isDropTarget =
                    dragColId !== null && dropTargetColId === colId && dragColId !== colId
                  return (
                    <th
                      key={h.id}
                      draggable
                      onDragStart={(e) => {
                        if (isResizingRef.current) {
                          e.preventDefault()
                          return
                        }
                        setDragColId(colId)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', colId)
                      }}
                      onDragOver={(e) => {
                        if (!dragColId || dragColId === colId) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (dropTargetColId !== colId) setDropTargetColId(colId)
                      }}
                      onDragLeave={() => {
                        if (dropTargetColId === colId) setDropTargetColId(null)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragColId && dragColId !== colId) {
                          const ids = table.getAllLeafColumns().map((c) => c.id)
                          const from = ids.indexOf(dragColId)
                          const to = ids.indexOf(colId)
                          if (from >= 0 && to >= 0) {
                            const next = ids.slice()
                            next.splice(from, 1)
                            next.splice(to, 0, dragColId)
                            setOrder(kind, next)
                          }
                        }
                        setDragColId(null)
                        setDropTargetColId(null)
                      }}
                      onDragEnd={() => {
                        setDragColId(null)
                        setDropTargetColId(null)
                      }}
                      className={[
                        'group relative select-none overflow-hidden px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground',
                        isDragging ? 'opacity-40' : '',
                        isDropTarget
                          ? 'before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-primary before:content-[""]'
                          : '',
                      ].join(' ')}
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
                        draggable={false}
                        onMouseDown={startResize(h.column.id)}
                        onTouchStart={startResize(h.column.id)}
                        onClick={(e) => e.stopPropagation()}
                        className={[
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                          'bg-border opacity-0 group-hover:opacity-100',
                          'data-[resizing=true]:bg-primary data-[resizing=true]:opacity-100',
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
                  colSpan={tableColumns.length + 2}
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
                const rowKey = identity.name ? identityKey(ctx, identity) : null
                const isSelected = rowKey !== null && selectedKeys.has(rowKey)
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
                      isSelected ? 'bg-primary/10' : '',
                    ].join(' ')}
                    onClick={onRowClick ? () => onRowClick(tagged as unknown as T, ctx) : undefined}
                  >
                    <td
                      className="px-2 py-1.5 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {rowKey && (
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(rowKey)}
                          aria-label={`Select ${identity.name}`}
                        />
                      )}
                    </td>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
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
      <BulkDeleteDialog
        items={selectedItems}
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onSuccess={clearSelection}
      />
      <BulkRestartDialog
        items={selectedItems}
        open={bulkRestartOpen}
        onOpenChange={setBulkRestartOpen}
        onSuccess={clearSelection}
      />
    </div>
  )
}
