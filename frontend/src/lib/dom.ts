export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

// Rows, the inspector and the divider use the vertical arrows themselves. The
// list region around the rows does not: a click on its padding, count or
// pager focuses it, and the arrows still move the sidebar from there.
export function ownsVerticalArrows(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[data-resource-row], [data-resource-detail], [role="separator"]') !== null
  )
}
