import { useCallback, useRef, useState } from 'react'

// Attach with `ref={attach}` and read the element from `ref`. A callback ref
// observes an element that mounts or is replaced after the first render, such
// as a table's scroll area once its empty state gives way to rows. Widths
// above `max` report as `max`, so a caller that needs the exact width only
// below a threshold doesn't re-render on every resize frame above it.
export function useElementWidth<T extends HTMLElement>(max = Infinity) {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  const attach = useCallback((element: T | null) => {
    ref.current = element
    if (!element || typeof ResizeObserver === 'undefined') return
    let frame = 0
    let last = -1
    const observer = new ResizeObserver(([entry]) => {
      // Keep the list's compact layout while it is hidden by expanded details.
      if (entry.contentRect.width <= 0) return
      const next = Math.min(max, Math.round(entry.contentRect.width))
      // React can render once more even for an unchanged state value.
      if (next === last) return
      last = next
      cancelAnimationFrame(frame)
      // Layout changes can resize the observed element again in the same frame.
      frame = requestAnimationFrame(() => setWidth(next))
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      ref.current = null
    }
  }, [max])
  return { ref, attach, width }
}
