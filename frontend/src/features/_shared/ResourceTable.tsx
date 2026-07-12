import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type Row,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleCheck,
  MoveDownLeft,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { isKindSynced, onKubeChange } from '@/lib/events'
import { namespaceQuery } from '@/lib/namespaceFilter'
import { stableList } from '@/lib/stableList'
import { useNowTick } from '@/lib/nowTick'
import {
  useActiveContexts,
  useIsAggregated,
  useUIStore,
  type ResourceKind,
  type SelectedResource,
} from '@/store/ui'
import { useTablePrefs, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/store/tablePrefs'
import { type ByContext } from '@/store/resources'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ColumnControls } from './ColumnControls'
import { RowContextMenu } from './RowContextMenu'
import {
  BulkCordonDialog,
  BulkDeleteDialog,
  BulkDrainDialog,
  BulkRestartDialog,
  type BulkItem,
} from './BulkActionDialogs'
import { isRestartable } from './workloadCapabilities'
import { parseSearch, rowMatchesSearch } from './rowSearch'
import { KLUSTR_CTX, resolveResourceContexts, type Tagged } from './resourceContext'
import { resourcePageCount } from './pagination'

type RowIdentity = { namespace?: string; name?: string }

type Scope = 'namespaced' | 'cluster'

type Noun = { singular: string; plural: string }

// Skeleton grace fallback: re-check every step while the kind is still syncing,
// giving up (showing the possibly-empty result) only at the hard cap.
const GRACE_STEP_MS = 5_000
const GRACE_HARD_CAP_MS = 30_000

// Each source item gets exactly one tagged twin so the merged rows keep
// referential equality across re-merges; stableList already guarantees a
// source item survives refetches unchanged. An item belongs to exactly one
// context's list, so a single cache is safe.
const taggedCache = new WeakMap<object, unknown>()

function tagItem<T>(item: T, ctx: string): Tagged<T> {
  const cached = taggedCache.get(item as object) as Tagged<T> | undefined
  if (cached) return cached
  const tagged = { ...(item as object), [KLUSTR_CTX]: ctx } as Tagged<T>
  taggedCache.set(item as object, tagged)
  return tagged
}

export type ResourceTableProps<T> = {
  kind: string
  noun: Noun
  scope: Scope
  data: ByContext<T>
  setData: (ctx: string, list: T[]) => void
  fetch: (contextName: string, namespace: string) => Promise<T[]>
  contexts?: string[]
  columns: ColumnDef<T, unknown>[]
  defaultSort?: SortingState
  onRowClick?: (row: T, contextName: string) => void
  // CR views must supply this: their table `kind` is a prefs key
  // (`cr:group/resource`), not a real kind, so the row context menu can't
  // build a working SelectedResource from it. The builder returns the same
  // object the view's onRowClick selects (alias kind, gvr, extras).
  rowResource?: (row: T, contextName: string) => SelectedResource
  // Delta-update pilot: when provided, kube:change deltas for this kind apply
  // incrementally (filtered by the active namespace selection) instead of
  // refetching the whole list. Falls back to a full refetch on reset/gap and on
  // the initial load, which stays the source of truth.
  applyDelta?: (contextName: string, upserts: T[], removed: string[]) => void
}

function identityKey(ctx: string, r: RowIdentity): string {
  return `${ctx}/${r.namespace ?? ''}/${r.name ?? ''}`
}

function columnId<T>(c: ColumnDef<T, unknown>): string {
  if (c.id) return c.id
  const ak = (c as { accessorKey?: string }).accessorKey
  if (ak) return ak
  return ''
}

const EMPTY_SIZING: ColumnSizingState = {}

const SKELETON_WIDTHS = ['70%', '45%', '55%', '40%', '60%', '35%', '50%']

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

type ResourceRowProps<T> = {
  row: Row<Tagged<T>>
  rowIndex: number
  kind: string
  columns: ColumnDef<Tagged<T>, unknown>[]
  columnOrder: string[]
  columnVisibility: VisibilityState
  isSelected: boolean
  flashing: boolean
  clickable: boolean
  onRowClick: (item: Tagged<T>) => void
  rowResource: (item: Tagged<T>) => SelectedResource | undefined
  onToggle: (key: string) => void
  measureRef: (node: Element | null) => void
}

function ResourceRowInner<T>({
  row,
  rowIndex,
  kind,
  isSelected,
  flashing,
  clickable,
  onRowClick,
  rowResource,
  onToggle,
  measureRef,
}: ResourceRowProps<T>) {
  useNowTick()
  const tagged = row.original
  const ctx = tagged[KLUSTR_CTX]
  const identity = tagged as unknown as RowIdentity
  const rowKey = identity.name ? identityKey(ctx, identity) : null
  const canPortForward =
    kind === 'Pod' ? (tagged as { hasPorts?: boolean }).hasPorts === true : false
  const rowEl = (
    <tr
      ref={measureRef}
      data-index={rowIndex}
      className={[
        'border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors',
        clickable ? 'cursor-pointer select-none' : '',
        flashing ? 'bg-emerald-100/60 dark:bg-emerald-400/15' : '',
        isSelected ? 'bg-primary/10' : '',
      ].join(' ')}
      onClick={clickable ? () => onRowClick(tagged) : undefined}
    >
      <td className="px-2 py-1.5 align-middle" onClick={(e) => e.stopPropagation()}>
        {rowKey && (
          <Checkbox
            checked={isSelected}
            onChange={() => onToggle(rowKey)}
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
      kind={kind as ResourceKind}
      contextName={ctx}
      namespace={identity.namespace ?? ''}
      name={identity.name}
      canPortForward={canPortForward}
      resource={rowResource(tagged)}
    >
      {rowEl}
    </RowContextMenu>
  )
}

// Rows bail out by comparing the underlying item reference (kept stable across
// refetches by stableList) plus everything that changes what cells render.
// Function props are intentionally excluded — the parent passes stable
// ref-backed callbacks. Cell output never depends on column sizing (widths
// live on <colgroup>), so columnSizing is excluded too.
const ResourceRow = memo(ResourceRowInner, (prev, next) => {
  return (
    prev.row.original === next.row.original &&
    prev.row.id === next.row.id &&
    prev.rowIndex === next.rowIndex &&
    prev.kind === next.kind &&
    prev.columns === next.columns &&
    prev.columnOrder === next.columnOrder &&
    prev.columnVisibility === next.columnVisibility &&
    prev.isSelected === next.isSelected &&
    prev.flashing === next.flashing &&
    prev.clickable === next.clickable
  )
}) as typeof ResourceRowInner

export function ResourceTable<T>({
  kind,
  noun,
  scope,
  data,
  setData,
  fetch,
  contexts,
  columns,
  defaultSort,
  onRowClick,
  rowResource,
  applyDelta,
}: ResourceTableProps<T>) {
  const activeContexts = useActiveContexts()
  const resourceContexts = resolveResourceContexts(activeContexts, contexts)
  const isAggregated = useIsAggregated()
  const selectedNamespaces = useUIStore((s) => s.selectedNamespaces)
  const readOnly = useUIStore((s) => s.globalReadOnly)
  const selectedResource = useUIStore((s) => s.selectedResource)
  const lastSelectedResource = useUIStore((s) => s.lastSelectedResource)
  // ponytail: key on the selection *content*, not the array ref — the store
  // hands back a fresh array even for an unchanged selection, and a new query
  // object would tear down the fetch effect and refetch every context.
  const nsKey = selectedNamespaces.join(',')
  const query = useMemo(
    () =>
      scope === 'namespaced'
        ? namespaceQuery(selectedNamespaces)
        : { apiNamespace: '', matches: () => true },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nsKey is the content key for selectedNamespaces
    [scope, nsKey],
  )
  const [filter, setFilter] = useState('')
  // The input updates instantly; the value that actually drives the O(rows)
  // row search is debounced so a fast typist on a 5000-row table refilters
  // once per pause instead of once per keystroke. Clearing applies
  // immediately so Escape / "no results" feel snappy.
  const [appliedFilter, setAppliedFilter] = useState('')
  useEffect(() => {
    if (filter === '') {
      setAppliedFilter('')
      return
    }
    const id = window.setTimeout(() => setAppliedFilter(filter), 180)
    return () => window.clearTimeout(id)
  }, [filter])
  const prefs = useTablePrefs((s) => s.byKind[kind])
  const persistedSizing = useMemo<ColumnSizingState>(
    () => prefs?.sizing ?? EMPTY_SIZING,
    [prefs?.sizing],
  )
  const setOrder = useTablePrefs((s) => s.setOrder)
  const setHidden = useTablePrefs((s) => s.setHidden)
  const setSizing = useTablePrefs((s) => s.setSizing)
  const setSortingPref = useTablePrefs((s) => s.setSorting)
  const setPageSize = useTablePrefs((s) => s.setPageSize)
  const resetPrefs = useTablePrefs((s) => s.reset)
  const pageSize = prefs?.pageSize ?? DEFAULT_PAGE_SIZE
  const [pageIndex, setPageIndex] = useState(0)
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
      const startWidth = measured > 0 ? measured : (liveSizingRef.current[colId] ?? 160)
      let last = startWidth
      isResizingRef.current = true
      if (handleEl) handleEl.dataset.resizing = 'true'

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const x =
          'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX
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
        const nextSizing: ColumnSizingState = {
          ...liveSizingRef.current,
          [colId]: last,
        }
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
  const [bulkCordon, setBulkCordon] = useState<'cordon' | 'uncordon' | null>(null)
  const [bulkDrainOpen, setBulkDrainOpen] = useState(false)
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([])
  useEffect(() => {
    setSelectedKeys(new Set())
  }, [resourceContexts, selectedNamespaces, kind])
  useEffect(() => {
    setPageIndex(0)
  }, [resourceContexts, selectedNamespaces, kind, appliedFilter, pageSize])
  const filterRef = useRef<HTMLInputElement>(null)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const [loadedSet, setLoadedSet] = useState<Set<string>>(() => new Set())
  const fetchRef = useRef(fetch)
  fetchRef.current = fetch
  const setDataRef = useRef(setData)
  setDataRef.current = setData
  const dataRef = useRef(data)
  dataRef.current = data
  const applyDeltaRef = useRef(applyDelta)
  applyDeltaRef.current = applyDelta
  // Last applied delta generation per context; cleared on each full fetch so the
  // next delta seeds a fresh baseline, then contiguity is required (gap ⇒ resync).
  const genRef = useRef<Map<string, number>>(new Map())

  const mergedRef = useRef<Tagged<T>[]>([])
  const mergedData = useMemo<Tagged<T>[]>(() => {
    const out: Tagged<T>[] = []
    for (const ctx of resourceContexts) {
      const list = data[ctx]
      if (!list || list.length === 0) continue
      for (const item of list) {
        // Always filter client-side: data[ctx] can still hold the previous
        // scope's rows during the refetch after a namespace switch, and
        // rendering them verbatim flashes wrong-namespace rows.
        if (scope === 'namespaced' && !query.matches((item as RowIdentity).namespace ?? '')) {
          continue
        }
        out.push(tagItem(item, ctx))
      }
    }
    const prev = mergedRef.current
    if (prev.length === out.length && out.every((item, i) => item === prev[i])) {
      return prev
    }
    mergedRef.current = out
    return out
  }, [resourceContexts, data, scope, query])

  useEffect(() => {
    if (selectedResource) return
    if (!lastSelectedResource) return
    const ctx = lastSelectedResource.context ?? resourceContexts[0] ?? ''
    const key = identityKey(ctx, lastSelectedResource)
    setFlashKey(key)
    const id = window.setTimeout(() => setFlashKey(null), 1_200)
    return () => window.clearTimeout(id)
  }, [selectedResource, lastSelectedResource, resourceContexts])

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
    if (resourceContexts.length === 0) {
      setLoadedSet(new Set())
      return
    }
    setLoadedSet(new Set())
    let cancelled = false
    const markLoaded = (ctx: string) =>
      setLoadedSet((prev) => {
        if (prev.has(ctx)) return prev
        const next = new Set(prev)
        next.add(ctx)
        return next
      })
    // One fetch in flight per context; change events arriving meanwhile mark it
    // dirty and a single trailing refetch runs shortly after. This bounds the
    // bridge/render churn on busy clusters to roughly one refetch per fetch
    // latency instead of one per event.
    const inflight = new Map<string, { dirty: boolean }>()
    const reload = (ctx: string): Promise<void> => {
      const st = inflight.get(ctx)
      if (st) {
        st.dirty = true
        return Promise.resolve()
      }
      inflight.set(ctx, { dirty: false })
      const t0 = import.meta.env.DEV ? performance.now() : 0
      return fetchRef
        .current(ctx, query.apiNamespace)
        .then((list) => {
          if (cancelled) return
          const tFetched = import.meta.env.DEV ? performance.now() : 0
          const items = stableList(dataRef.current[ctx], list ?? [])
          setDataRef.current(ctx, items)
          // A full fetch is the source of truth: clear the delta baseline so the
          // next delta is accepted and reseeds it.
          genRef.current.delete(ctx)
          if (import.meta.env.DEV) {
            const n = (list ?? []).length
            // roundtrip = bridge + Go build + JSON parse; apply = stableList diff + setState.
            console.debug(
              `[perf] ${kind} ctx=${ctx} n=${n} ` +
                `roundtrip=${(tFetched - t0).toFixed(1)}ms apply=${(performance.now() - tFetched).toFixed(1)}ms`,
            )
          }
          // An empty list is only trustworthy once the informer cache has synced;
          // before that, treat it as still loading so the skeleton stays up instead
          // of flashing "No X" and then popping in the real rows a moment later.
          if (items.length > 0 || isKindSynced(ctx, kind)) markLoaded(ctx)
        })
        .catch(() => {
          if (cancelled) return
          setDataRef.current(ctx, [])
          genRef.current.delete(ctx)
          markLoaded(ctx)
        })
        .finally(() => {
          const st = inflight.get(ctx)
          inflight.delete(ctx)
          if (!cancelled && st?.dirty) {
            window.setTimeout(() => {
              if (!cancelled) reload(ctx)
            }, 150)
          }
        })
    }
    // Bound the initial fan-out so a large aggregated group doesn't fire N
    // simultaneous bridge round-trips on a context-set/namespace change; the
    // per-context single-flight above handles steady-state kube:change bursts.
    let nextCtx = 0
    const runNext = (): Promise<void> => {
      const i = nextCtx++
      if (cancelled || i >= resourceContexts.length) return Promise.resolve()
      return reload(resourceContexts[i]).then(runNext)
    }
    const initialConcurrency = Math.min(4, resourceContexts.length)
    for (let w = 0; w < initialConcurrency; w++) void runNext()
    const unsub = onKubeChange(kind, (ctx, delta) => {
      if (!resourceContexts.includes(ctx)) return
      const apply = applyDeltaRef.current
      // No delta support for this kind, no payload (e.g. _access fan-out), or an
      // explicit reset ⇒ full refetch (today's behavior).
      if (!apply || !delta || delta.reset) {
        reload(ctx)
        return
      }
      const last = genRef.current.get(ctx)
      if (last !== undefined && delta.gen !== last + 1) {
        // Missed or out-of-order batch ⇒ resync from a full fetch.
        reload(ctx)
        return
      }
      genRef.current.set(ctx, delta.gen)
      // Deltas are whole-kind; apply only upserts in the active namespace
      // selection. Removes are unconditional (removing an absent key is a no-op).
      const ups = delta.upserts as T[]
      const filtered = ups.filter((u) => query.matches((u as RowIdentity).namespace ?? ''))
      apply(ctx, filtered, delta.removed)
    })
    // Fallback for kinds that never emit a sync event. Synced contexts are
    // already marked by the reload path (empty result + isKindSynced), so this
    // only decides when to give up on a context still syncing. Hold the skeleton
    // while the kind is unsynced — a slow initial LIST (e.g. all Secrets behind
    // the Helm view, or 10k pods) must not flash "No X" before the cache lands —
    // and give up after a hard cap so a genuinely never-syncing kind still shows.
    let graceWaited = 0
    let graceTimer = window.setTimeout(function giveUp() {
      if (cancelled) return
      graceWaited += GRACE_STEP_MS
      const stillSyncing =
        graceWaited < GRACE_HARD_CAP_MS && resourceContexts.some((ctx) => !isKindSynced(ctx, kind))
      if (stillSyncing) {
        graceTimer = window.setTimeout(giveUp, GRACE_STEP_MS)
        return
      }
      setLoadedSet(new Set(resourceContexts))
    }, GRACE_STEP_MS)
    return () => {
      cancelled = true
      unsub()
      window.clearTimeout(graceTimer)
    }
  }, [resourceContexts, query, kind])

  const tableColumns = useMemo<ColumnDef<Tagged<T>, unknown>[]>(() => {
    const baseCols = columns as unknown as ColumnDef<Tagged<T>, unknown>[]
    if (!isAggregated) return baseCols
    const ctxCol: ColumnDef<Tagged<T>, unknown> = {
      id: 'klustrContext',
      header: 'Context',
      accessorFn: (row) => row[KLUSTR_CTX],
    }
    return [ctxCol, ...baseCols]
  }, [columns, isAggregated])

  const allColumnIds = useMemo(() => tableColumns.map((c) => columnId(c)), [tableColumns])
  // Search runs over the row data itself (not TanStack's per-column global
  // filter, which silently skips columns whose values aren't plain
  // strings/numbers — array columns like hostnames were unsearchable). Column
  // accessors are kept only so `column:value` terms can scope a match.
  const columnGetters = useMemo(() => {
    const m = new Map<string, (row: Tagged<T>) => unknown>()
    for (const c of tableColumns) {
      const id = columnId(c).toLowerCase()
      if (!id) continue
      const ak = (c as { accessorKey?: string }).accessorKey
      const af = (c as { accessorFn?: (row: Tagged<T>, index: number) => unknown }).accessorFn
      if (ak) m.set(id, (row) => (row as Record<string, unknown>)[ak])
      else if (af) m.set(id, (row) => af(row, 0))
    }
    return m
  }, [tableColumns])
  const searchedData = useMemo(() => {
    const terms = parseSearch(appliedFilter)
    if (terms.length === 0) return mergedData
    const ids = [...columnGetters.keys()]
    return mergedData.filter((row) =>
      rowMatchesSearch(row, terms, ids, (r, id) => columnGetters.get(id)?.(r as Tagged<T>)),
    )
  }, [mergedData, appliedFilter, columnGetters])
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
  // Sort lives in tablePrefs (like order/size/hidden) so it survives leaving and
  // returning to a kind. Absent prefs.sorting → the view's default; entries are
  // filtered to columns that currently exist (e.g. the aggregated Context column).
  const sorting = useMemo<SortingState>(() => {
    const base = prefs?.sorting ?? defaultSort ?? [{ id: 'name', desc: false }]
    return base.filter((s) => allColumnIds.includes(s.id))
  }, [prefs?.sorting, defaultSort, allColumnIds])

  // pageSize 0 is the "All" sentinel — fall back to the full row count so the
  // single page holds everything.
  const effectivePageSize = pageSize === 0 ? Math.max(1, searchedData.length) : pageSize
  const pageCount = resourcePageCount(searchedData.length, effectivePageSize)
  const table = useReactTable({
    data: searchedData,
    columns: tableColumns,
    state: {
      sorting,
      columnOrder,
      columnVisibility,
      columnSizing: liveSizing,
      pagination: { pageIndex, pageSize: effectivePageSize },
    },
    // Live informer updates flow in constantly; the default auto-reset would
    // bounce the user back to page 1 on every delta. We reset deliberately
    // (scope/filter/pageSize change) and clamp out-of-range pages ourselves.
    autoResetPageIndex: false,
    pageCount,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize: effectivePageSize })
          : updater
      setPageIndex(next.pageIndex)
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      setSortingPref(kind, next)
    },
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
    getRowId: (row, index) => {
      const ident = row as unknown as RowIdentity
      return ident.name ? identityKey(row[KLUSTR_CTX], ident) : `#${index}`
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= pageCount) {
      setPageIndex(Math.max(0, pageCount - 1))
    }
  }, [pageIndex, pageCount])

  const visibleRows = table.getRowModel().rows
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [pageIndex])
  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 33,
    overscan: 12,
  })
  // The virtualizer re-renders this component on every scroll frame; both
  // derivations are O(rows), so memoize them on the row model itself.
  const visibleKeys = useMemo(
    () =>
      visibleRows
        .map((r) => {
          const tagged = r.original as Tagged<T>
          const ident = tagged as unknown as RowIdentity
          return ident.name ? identityKey(tagged[KLUSTR_CTX], ident) : null
        })
        .filter((k): k is string => k !== null),
    [visibleRows],
  )
  // Bulk actions and the "N selected" banner act on the full selection across
  // every page (intersected with the current filter), not just the visible
  // page — selectedKeys persists across pagination, so deriving from the
  // post-pagination rows would silently drop off-page selections on a
  // destructive path. getPrePaginationRowModel() is filtered but not paginated.
  const selectableRows = table.getPrePaginationRowModel().rows
  const selectedItems = useMemo(() => {
    const items: BulkItem[] = []
    for (const r of selectableRows) {
      const tagged = r.original as Tagged<T>
      const ctx = tagged[KLUSTR_CTX]
      const ident = tagged as unknown as RowIdentity
      if (!ident.name) continue
      const key = identityKey(ctx, ident)
      if (!selectedKeys.has(key)) continue
      items.push({
        contextName: ctx,
        kind,
        namespace: ident.namespace ?? '',
        name: ident.name,
      })
    }
    return items
  }, [selectableRows, selectedKeys, kind])
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.has(k))
  const toggleRow = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const onRowClickRef = useRef(onRowClick)
  onRowClickRef.current = onRowClick
  const handleRowClick = useCallback((item: Tagged<T>) => {
    onRowClickRef.current?.(item as unknown as T, item[KLUSTR_CTX])
  }, [])
  const rowResourceRef = useRef(rowResource)
  rowResourceRef.current = rowResource
  const handleRowResource = useCallback(
    (item: Tagged<T>) => rowResourceRef.current?.(item as unknown as T, item[KLUSTR_CTX]),
    [],
  )
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

  const allLoaded = resourceContexts.every((c) => loadedSet.has(c))
  const filteredCount = selectableRows.length
  const total = mergedData.length
  const countLabel = !allLoaded
    ? `Loading ${noun.plural}…`
    : appliedFilter
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
  const contextLabel = isAggregated ? ` across ${resourceContexts.length} contexts` : ''

  const canRestart = isRestartable(kind)
  const isNodeKind = kind === 'Node'

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {selectedItems.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs">
          <span className="font-medium text-foreground">{selectedItems.length} selected</span>
          {!readOnly && canRestart && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBulkItems(selectedItems)
                setBulkRestartOpen(true)
              }}
              className="h-7 gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Restart
            </Button>
          )}
          {!readOnly && isNodeKind && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkItems(selectedItems)
                  setBulkCordon('cordon')
                }}
                className="h-7 gap-1.5"
              >
                <Ban className="size-3.5" />
                Cordon
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkItems(selectedItems)
                  setBulkCordon('uncordon')
                }}
                className="h-7 gap-1.5"
              >
                <CircleCheck className="size-3.5" />
                Uncordon
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkItems(selectedItems)
                  setBulkDrainOpen(true)
                }}
                className="h-7 gap-1.5"
              >
                <MoveDownLeft className="size-3.5" />
                Drain
              </Button>
            </>
          )}
          {!readOnly && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBulkItems(selectedItems)
                setBulkDeleteOpen(true)
              }}
              className="h-7 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Delete
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
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (filter) setFilter('')
                else filterRef.current?.blur()
              }
            }}
            placeholder={`Filter ${noun.plural}   ⌨ /`}
            title="Terms are AND-matched against every field of the row, including arrays. Scope a term to a column with column:value, e.g. name:api or host:gateway."
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
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <table
          className="border-collapse text-sm"
          style={{
            width: '100%',
            minWidth: table.getTotalSize(),
            tableLayout: 'fixed',
          }}
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
                          'absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none',
                          'after:absolute after:right-0 after:top-0 after:h-full after:w-0.5 after:bg-border after:opacity-0 after:content-[""]',
                          'group-hover:after:opacity-100',
                          'data-[resizing=true]:after:bg-primary data-[resizing=true]:after:opacity-100',
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
            {visibleRows.length === 0 && !allLoaded ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-border last:border-b-0">
                  <td className="px-2 py-1.5 align-middle">
                    <Skeleton className="size-4 rounded-sm" />
                  </td>
                  {table.getVisibleLeafColumns().map((col, ci) => (
                    <td key={col.id} className="px-3 py-1.5 align-middle">
                      <Skeleton
                        className="h-3.5"
                        style={{
                          width: SKELETON_WIDTHS[ci % SKELETON_WIDTHS.length],
                        }}
                      />
                    </td>
                  ))}
                  <td aria-hidden />
                </tr>
              ))
            ) : visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumns.length + 2}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {appliedFilter
                    ? `No ${noun.plural} matching "${appliedFilter}".`
                    : `No ${noun.plural}${scope === 'namespaced' && selectedNamespaces.length > 0 ? scopeLabel : ''}.`}
                </td>
              </tr>
            ) : (
              (() => {
                const virtualItems = virtualizer.getVirtualItems()
                const padTop = virtualItems.length > 0 ? virtualItems[0].start : 0
                const padBottom =
                  virtualItems.length > 0
                    ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
                    : 0
                const spacerSpan = table.getVisibleLeafColumns().length + 2
                return (
                  <>
                    {padTop > 0 && (
                      <tr aria-hidden>
                        <td colSpan={spacerSpan} style={{ height: padTop, padding: 0 }} />
                      </tr>
                    )}
                    {virtualItems.map((vi) => {
                      const row = visibleRows[vi.index]
                      const tagged = row.original as Tagged<T>
                      const ctx = tagged[KLUSTR_CTX]
                      const identity = tagged as unknown as RowIdentity
                      const rowKey = identity.name ? identityKey(ctx, identity) : null
                      return (
                        <ResourceRow
                          key={row.id}
                          row={row}
                          rowIndex={vi.index}
                          kind={kind}
                          columns={tableColumns}
                          columnOrder={columnOrder}
                          columnVisibility={columnVisibility}
                          isSelected={rowKey !== null && selectedKeys.has(rowKey)}
                          flashing={rowKey !== null && flashKey === rowKey}
                          clickable={!!onRowClick}
                          onRowClick={handleRowClick}
                          rowResource={handleRowResource}
                          onToggle={toggleRow}
                          measureRef={virtualizer.measureElement}
                        />
                      )
                    })}
                    {padBottom > 0 && (
                      <tr aria-hidden>
                        <td colSpan={spacerSpan} style={{ height: padBottom, padding: 0 }} />
                      </tr>
                    )}
                  </>
                )
              })()
            )}
          </tbody>
        </table>
      </div>
      {allLoaded && filteredCount > 0 && (
        <div className="flex min-w-0 items-center gap-3 border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>Rows per page</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                  {pageSize === 0 ? 'All' : pageSize}
                  <ChevronsUpDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-24">
                <DropdownMenuRadioGroup
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(kind, Number(v))}
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <DropdownMenuRadioItem key={opt} value={String(opt)}>
                      {opt === 0 ? 'All' : opt}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {pageCount > 1 && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="tabular-nums">
                {pageIndex * effectivePageSize + 1}–
                {Math.min((pageIndex + 1) * effectivePageSize, filteredCount)} of {filteredCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="tabular-nums">
                Page {pageIndex + 1} of {pageCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                disabled={pageIndex >= pageCount - 1}
                onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
      <BulkDeleteDialog
        items={bulkItems}
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onSuccess={clearSelection}
      />
      <BulkRestartDialog
        items={bulkItems}
        open={bulkRestartOpen}
        onOpenChange={setBulkRestartOpen}
        onSuccess={clearSelection}
      />
      {isNodeKind && (
        <>
          <BulkCordonDialog
            items={bulkItems}
            open={bulkCordon !== null}
            onOpenChange={(next) => setBulkCordon(next ? bulkCordon : null)}
            onSuccess={clearSelection}
            cordon={bulkCordon !== 'uncordon'}
          />
          <BulkDrainDialog
            items={bulkItems}
            open={bulkDrainOpen}
            onOpenChange={setBulkDrainOpen}
            onSuccess={clearSelection}
          />
        </>
      )}
    </div>
  )
}
