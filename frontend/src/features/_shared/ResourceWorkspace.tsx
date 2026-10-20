import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { sameResource, useUIStore, type SelectedResource } from '@/store/ui'
import { isEditableTarget, isOverlayOpen } from '@/lib/dom'
import { DetailResizeHandle } from './DetailResizeHandle'
import { detailLayout, LIST_WIDTH_MIN } from './detailLayout'
import { ResourceDetailPanel } from './ResourceDetailPanel'
import { useElementWidth } from './useElementWidth'
import { createResourceNavigationStore, HELD_KEY_SETTLE_MS, ResourceNavigationContext } from './resourceNavigation'

function focusResourceRow(workspace: HTMLElement | null, resource: SelectedResource, context: string | null) {
  const list = workspace?.querySelector<HTMLElement>('[data-resource-list]')
  const key = `${resource.context ?? context ?? ''}/${resource.namespace}/${resource.name}`
  const row = [...(list?.querySelectorAll<HTMLElement>('[data-resource-row]') ?? [])].find(
    (element) => element.dataset.resourceRow === key,
  )
  ;(row ?? list)?.focus({ preventScroll: true })
}

export function ResourceWorkspace({ children }: { children: ReactNode }) {
  const [navigation] = useState(createResourceNavigationStore)
  return (
    <ResourceNavigationContext value={navigation}>
      <Workspace>{children}</Workspace>
    </ResourceNavigationContext>
  )
}

function Workspace({ children }: { children: ReactNode }) {
  const { ref, attach, width } = useElementWidth<HTMLDivElement>()
  const selectedResource = useUIStore((s) => s.selectedResource)
  const selectedContext = useUIStore((s) => s.selectedContext)
  const selectedView = useUIStore((s) => s.selectedView)
  const selectedCRDKey = useUIStore((s) => s.selectedCRDKey)
  const contexts = useUIStore((s) => s.aggregatedContexts)
  const preferredWidth = useUIStore((s) => s.detailWidth)
  const expanded = useUIStore((s) => s.detailExpanded)
  const setWidth = useUIStore((s) => s.setDetailWidth)
  const setExpanded = useUIStore((s) => s.setDetailExpanded)
  const close = useUIStore((s) => s.setSelectedResource)
  const requestNavigation = useUIStore((s) => s.requestDetailNavigation)
  const navigationStore = useContext(ResourceNavigationContext)
  const scope = `${selectedContext}\u0000${contexts.join('\u0000')}\u0000${selectedView}\u0000${selectedCRDKey}`
  const previousSelection = useRef({ resource: selectedResource, scope })
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const lastMove = useRef(0)
  const layout = detailLayout(width, dragWidth ?? preferredWidth, expanded)
  const splitLayout = detailLayout(width, dragWidth ?? preferredWidth, false)
  const fullWidth = !!selectedResource && layout.fullWidth
  // The divider can unmount mid-drag (the window narrows, the inspector
  // closes) without committing; drop its preview so the saved width applies.
  if (dragWidth !== null && (!selectedResource || fullWidth)) setDragWidth(null)

  // Stable callbacks let the memoized inspector skip the re-render that every
  // divider drag frame and window resize causes here.
  const closeInspector = useCallback(() => {
    if (!selectedResource) return
    requestNavigation(() => {
      close(null)
      // Wait for the pane and any draft dialog to release their focus traps.
      requestAnimationFrame(() => {
        const current = useUIStore.getState()
        if (current.selectedResource || current.selectedContext !== selectedContext ||
          current.selectedView !== selectedView || current.selectedCRDKey !== selectedCRDKey ||
          current.aggregatedContexts !== contexts) return
        focusResourceRow(ref.current, selectedResource, selectedContext)
      })
    })
  }, [selectedResource, requestNavigation, close, selectedContext, selectedView, selectedCRDKey, contexts, ref])
  const toggleExpanded = useCallback(() => setExpanded(!expanded), [setExpanded, expanded])

  useEffect(() => {
    const previous = previousSelection.current
    previousSelection.current = { resource: selectedResource, scope }
    if (!previous.resource || selectedResource || previous.scope !== scope) return
    // Only closing this inspector returns focus to its list. Sidebar and
    // context navigation own their focus even when they also clear selection.
    const focused = document.activeElement
    if (focused && focused !== document.body && !ref.current?.contains(focused)) return
    focusResourceRow(ref.current, previous.resource, selectedContext)
  }, [selectedResource, selectedContext, scope, ref])

  useEffect(() => {
    // The list hides behind a full-width inspector, so focus in it moves to
    // the inspector. Focus elsewhere (the terminal drawer, the sidebar) stays.
    const focused = document.activeElement
    if (focused && focused !== document.body && !ref.current?.contains(focused)) return
    if (
      fullWidth &&
      selectedResource &&
      !ref.current?.querySelector('[data-resource-detail]')?.contains(focused)
    ) {
      ref.current
        ?.querySelector<HTMLElement>('[data-resource-detail]')
        ?.focus({ preventScroll: true })
    }
  }, [fullWidth, selectedResource, ref])

  return (
    <div
      ref={attach}
      data-resource-workspace
      className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden"
      onKeyDown={(event) => {
        // Keys from portaled content (a delete confirmation, a menu) bubble
        // here through React, but they belong to that overlay.
        if (
          event.defaultPrevented ||
          !event.currentTarget.contains(event.target as Node) ||
          isOverlayOpen()
        )
          return
        const inEditor =
          isEditableTarget(event.target) ||
          (event.target instanceof Element && !!event.target.closest('.monaco-editor, .xterm'))
        const navigation = navigationStore?.get()
        if (
          event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !inEditor &&
          selectedResource &&
          navigation &&
          sameResource(navigation.resource, selectedResource) &&
          (event.key === 'ArrowUp' || event.key === 'ArrowDown')
        ) {
          event.preventDefault()
          event.stopPropagation()
          // ponytail: throttled, so a held key still opens one resource per
          // interval; accumulate the offset if that ever proves too slow.
          if (event.repeat && event.timeStamp - lastMove.current < HELD_KEY_SETTLE_MS) return
          lastMove.current = event.timeStamp
          if (event.key === 'ArrowUp') navigation.previous?.()
          else navigation.next?.()
          return
        }
        if (
          event.key === 'F6' &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          selectedResource
        ) {
          event.preventDefault()
          const inDetail = (event.target as HTMLElement).closest('[data-resource-detail]')
          const list = ref.current?.querySelector<HTMLElement>('[data-resource-list]')
          const target =
            inDetail && !fullWidth
              ? (list?.querySelector<HTMLElement>('[aria-current="true"]') ?? list)
              : ref.current?.querySelector<HTMLElement>('[data-resource-detail]')
          target?.focus({ preventScroll: true })
        } else if (
          event.key === 'Escape' &&
          selectedResource &&
          !isEditableTarget(event.target) &&
          // A row click leaves focus in the list, so Esc closes from there too.
          (event.target as HTMLElement).closest('[data-resource-detail], [data-resource-list]')
        ) {
          event.preventDefault()
          event.stopPropagation()
          closeInspector()
        }
      }}
    >
      <div
        data-resource-list
        role="region"
        aria-label="Resource list"
        tabIndex={-1}
        inert={fullWidth}
        aria-hidden={fullWidth || undefined}
        style={{
          width: selectedResource
            ? layout.canSplit
              ? width - splitLayout.width - 1
              : LIST_WIDTH_MIN
            : undefined,
          flex: selectedResource ? 'none' : undefined,
          visibility: fullWidth ? 'hidden' : undefined,
        }}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {children}
      </div>
      {selectedResource && !fullWidth && (
        <DetailResizeHandle
          width={layout.width}
          maxWidth={layout.maxWidth}
          onResize={setDragWidth}
          onCommit={(next) => {
            setWidth(next)
            setDragWidth(null)
          }}
        />
      )}
      <div
        className={`${selectedResource ? 'flex' : 'hidden'} ${fullWidth ? 'absolute inset-0' : ''} min-h-0 min-w-0 shrink-0 overflow-hidden`}
        style={{ width: fullWidth ? '100%' : layout.width }}
      >
        <ResourceDetailPanel
          contextName={selectedResource?.context ?? selectedContext}
          resource={selectedResource}
          expanded={fullWidth}
          canSplit={layout.canSplit}
          onToggleExpanded={toggleExpanded}
          onClose={closeInspector}
        />
      </div>
    </div>
  )
}
