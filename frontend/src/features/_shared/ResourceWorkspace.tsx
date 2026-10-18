import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { sameResource, useUIStore } from '@/store/ui'
import { isEditableTarget } from '@/lib/dom'
import { DetailResizeHandle } from './DetailResizeHandle'
import { detailLayout, LIST_WIDTH_MIN } from './detailLayout'
import { ResourceDetailPanel } from './ResourceDetailPanel'
import { useElementWidth } from './useElementWidth'
import {
  ResourceNavigationContext,
  ResourceNavigationDispatchContext,
  type ResourceNavigation,
} from './resourceNavigation'

export function ResourceWorkspace({ children }: { children: ReactNode }) {
  const [navigation, setNavigation] = useState<ResourceNavigation | null>(null)
  return (
    <ResourceNavigationDispatchContext value={setNavigation}>
      <ResourceNavigationContext value={navigation}>
        <Workspace>{children}</Workspace>
      </ResourceNavigationContext>
    </ResourceNavigationDispatchContext>
  )
}

function Workspace({ children }: { children: ReactNode }) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const selectedResource = useUIStore((s) => s.selectedResource)
  const selectedContext = useUIStore((s) => s.selectedContext)
  const preferredWidth = useUIStore((s) => s.detailWidth)
  const expanded = useUIStore((s) => s.detailExpanded)
  const setWidth = useUIStore((s) => s.setDetailWidth)
  const setExpanded = useUIStore((s) => s.setDetailExpanded)
  const close = useUIStore((s) => s.setSelectedResource)
  const navigation = useContext(ResourceNavigationContext)
  const previousResource = useRef(selectedResource)
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const layout = detailLayout(width, dragWidth ?? preferredWidth, expanded)
  const splitLayout = detailLayout(width, dragWidth ?? preferredWidth, false)
  const fullWidth = !!selectedResource && layout.fullWidth

  useEffect(() => {
    const previous = previousResource.current
    previousResource.current = selectedResource
    if (!previous || selectedResource) return
    const list = ref.current?.querySelector<HTMLElement>('[data-resource-list]')
    const key = `${previous.context ?? selectedContext ?? ''}/${previous.namespace}/${previous.name}`
    const row = [...(list?.querySelectorAll<HTMLElement>('[data-resource-row]') ?? [])].find(
      (element) => element.dataset.resourceRow === key,
    )
    ;(row ?? list)?.focus({ preventScroll: true })
  }, [selectedResource, selectedContext, ref])

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
          close(null)
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
        />
      </div>
    </div>
  )
}
