import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { sameResource, useUIStore, type SelectedResource } from '@/store/ui'
import { isEditableTarget } from '@/lib/dom'
import { DetailResizeHandle } from './DetailResizeHandle'
import { detailLayout, LIST_WIDTH_MIN } from './detailLayout'
import { ResourceDetailPanel } from './ResourceDetailPanel'
import { useElementWidth } from './useElementWidth'
import { createResourceNavigationStore, ResourceNavigationContext } from './resourceNavigation'

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
  const { ref, width } = useElementWidth<HTMLDivElement>()
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
  const layout = detailLayout(width, dragWidth ?? preferredWidth, expanded)
  const splitLayout = detailLayout(width, dragWidth ?? preferredWidth, false)
  const fullWidth = !!selectedResource && layout.fullWidth

  const closeInspector = () => {
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
  }

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
    if (
      fullWidth &&
      selectedResource &&
      !ref.current?.querySelector('[data-resource-detail]')?.contains(document.activeElement)
    ) {
      ref.current
        ?.querySelector<HTMLElement>('[data-resource-detail]')
        ?.focus({ preventScroll: true })
    }
  }, [fullWidth, selectedResource, ref])

  return (
    <div
      ref={ref}
      data-resource-workspace
      className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden"
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          document.querySelector(
            '[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]',
          )
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
          (event.target as HTMLElement).closest('[data-resource-detail]')
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
          onToggleExpanded={() => setExpanded(!expanded)}
          onClose={closeInspector}
        />
      </div>
    </div>
  )
}
