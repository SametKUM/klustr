import { useEffect, useRef, useState } from 'react'

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const observer = new ResizeObserver(([entry]) => {
      // Keep the list's compact layout while it is hidden by expanded details.
      if (entry.contentRect.width <= 0) return
      const next = Math.round(entry.contentRect.width)
      cancelAnimationFrame(frame)
      // Layout changes can resize the observed element again in the same frame.
      frame = requestAnimationFrame(() => setWidth(next))
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  return { ref, width }
}
