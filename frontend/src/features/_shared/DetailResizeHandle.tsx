import { useEffect, useRef } from 'react'
import { DETAIL_WIDTH_DEFAULT, DETAIL_WIDTH_MIN } from '@/store/ui.types'

const DRAG_THRESHOLD = 3

type Props = {
  width: number
  maxWidth: number
  onResize: (width: number) => void
  onCommit: (width: number) => void
}

export function DetailResizeHandle({ width, maxWidth, onResize, onCommit }: Props) {
  const drag = useRef<{
    x: number
    width: number
    current: number
    moved: boolean
    cursor: string
    select: string
  } | null>(null)
  const clamp = (value: number) => Math.max(DETAIL_WIDTH_MIN, Math.min(maxWidth, value))
  // `width` is already fitted to the window. Committing it without a real
  // drag would overwrite the saved preference with the narrow-window value.
  const finishDrag = () => {
    if (!drag.current) return
    if (drag.current.moved) onCommit(drag.current.current)
    document.body.style.cursor = drag.current.cursor
    document.body.style.userSelect = drag.current.select
    drag.current = null
  }
  useEffect(
    () => () => {
      if (!drag.current) return
      document.body.style.cursor = drag.current.cursor
      document.body.style.userSelect = drag.current.select
    },
    [],
  )

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label="Resize resource details"
      aria-orientation="vertical"
      aria-controls="resource-detail-panel"
      aria-valuemin={DETAIL_WIDTH_MIN}
      aria-valuemax={maxWidth}
      aria-valuenow={Math.round(width)}
      title="Drag to resize. Double-click or press Enter to reset."
      onDoubleClick={() => onCommit(DETAIL_WIDTH_DEFAULT)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 64 : 16
        const next =
          event.key === 'ArrowLeft'
            ? width + step
            : event.key === 'ArrowRight'
              ? width - step
              : event.key === 'Home'
                ? DETAIL_WIDTH_MIN
                : event.key === 'End'
                  ? maxWidth
                  : event.key === 'Enter'
                    ? DETAIL_WIDTH_DEFAULT
                    : null
        if (next === null) return
        event.preventDefault()
        event.stopPropagation()
        // Reset stores the default itself; the layout fits it to the window.
        onCommit(event.key === 'Enter' ? next : clamp(next))
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = {
          x: event.clientX,
          width,
          current: width,
          moved: false,
          cursor: document.body.style.cursor,
          select: document.body.style.userSelect,
        }
        document.body.style.cursor = 'ew-resize'
        document.body.style.userSelect = 'none'
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        // A few pixels of jitter during a click or double-click is not a resize.
        if (!drag.current.moved && Math.abs(event.clientX - drag.current.x) < DRAG_THRESHOLD) return
        const next = clamp(drag.current.width + drag.current.x - event.clientX)
        drag.current.moved = true
        drag.current.current = next
        onResize(next)
      }}
      onPointerUp={(event) => {
        if (!drag.current) return
        finishDrag()
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onLostPointerCapture={finishDrag}
      // The hit area extends into the inspector only: the list's vertical
      // scrollbar sits directly left of the divider.
      className="relative z-10 w-px shrink-0 cursor-ew-resize touch-none bg-border before:absolute before:inset-y-0 before:left-0 before:w-2 hover:bg-primary focus-visible:outline-2 focus-visible:outline-ring"
    />
  )
}
