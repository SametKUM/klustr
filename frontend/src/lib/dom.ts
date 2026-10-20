export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

// Radix doesn't stop keys bubbling out of its overlays, so app-level shortcuts
// check this before acting behind an open dialog, confirmation or menu.
const OPEN_OVERLAY = ['dialog', 'alertdialog', 'menu', 'listbox']
  .map((role) => `[role="${role}"][data-state="open"]`)
  .join(', ')

export function isOverlayOpen(): boolean {
  return document.querySelector(OPEN_OVERLAY) !== null
}

// The inspector beside a list, found from any element of the same workspace.
export function workspaceInspector(from: Element | null): HTMLElement | null {
  return from?.closest('[data-resource-workspace]')?.querySelector<HTMLElement>('[data-resource-detail]') ?? null
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
