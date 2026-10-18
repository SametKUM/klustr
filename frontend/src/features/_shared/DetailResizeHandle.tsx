import { useEffect, useRef } from 'react'
import { DETAIL_WIDTH_MIN } from '@/store/ui.types'

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
    cursor: string
    select: string
  } | null>(null)
  const clamp = (value: number) => Math.max(DETAIL_WIDTH_MIN, Math.min(maxWidth, value))
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
                  : null
        if (next === null) return
        event.preventDefault()
        event.stopPropagation()
        onCommit(clamp(next))
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
          cursor: document.body.style.cursor,
          select: document.body.style.userSelect,
        }
        document.body.style.cursor = 'ew-resize'
        document.body.style.userSelect = 'none'
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const next = clamp(drag.current.width + drag.current.x - event.clientX)
        drag.current.current = next
        onResize(next)
      }}
      onPointerUp={(event) => {
        if (!drag.current) return
        onCommit(drag.current.current)
        document.body.style.cursor = drag.current.cursor
        document.body.style.userSelect = drag.current.select
        drag.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onLostPointerCapture={() => {
        if (!drag.current) return
        onCommit(drag.current.current)
        document.body.style.cursor = drag.current.cursor
        document.body.style.userSelect = drag.current.select
        drag.current = null
      }}
      className="relative z-10 w-px shrink-0 cursor-ew-resize touch-none bg-border before:absolute before:inset-y-0 before:-left-3 before:w-6 hover:bg-primary focus-visible:outline-2 focus-visible:outline-ring"
    />
  )
}
