// A drag that selects text inside a clickable row still ends in a click on
// that row. Rows check this first and skip their action, so the selection
// survives to be copied; a selection elsewhere doesn't block the click.
export function selectsTextWithin(el: Element): boolean {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return false
  return el.contains(selection.anchorNode)
}
