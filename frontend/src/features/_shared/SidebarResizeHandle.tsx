import { useCallback, useRef } from 'react'

type Props = {
  width: number
  onResize: (px: number) => void
}

export function SidebarResizeHandle({ width, onResize }: Props) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = { startX: event.clientX, startWidth: width }
      event.currentTarget.setPointerCapture(event.pointerId)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    },
    [width],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag) return
      onResize(drag.startWidth + (event.clientX - drag.startX))
    },
    [onResize],
  )

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute -right-0.5 top-0 z-20 h-full w-1 cursor-ew-resize bg-transparent transition-colors hover:bg-primary/40"
    />
  )
}
