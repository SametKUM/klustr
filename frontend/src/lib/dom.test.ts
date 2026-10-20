import { describe, expect, it } from 'vitest'
import { isOverlayOpen, ownsVerticalArrows } from './dom'

function mount(html: string) {
  document.body.innerHTML = html
  return (selector: string) => document.querySelector(selector)
}

describe('isOverlayOpen', () => {
  it('sees open dialogs, confirmations, menus and listboxes but not closed ones', () => {
    for (const role of ['dialog', 'alertdialog', 'menu', 'listbox']) {
      mount(`<div role="${role}" data-state="open"></div>`)
      expect(isOverlayOpen()).toBe(true)
      mount(`<div role="${role}" data-state="closed"></div>`)
      expect(isOverlayOpen()).toBe(false)
    }
  })
})

describe('ownsVerticalArrows', () => {
  it('leaves the arrows to the sidebar from the list region around the rows', () => {
    const find = mount(
      '<div data-resource-list tabindex="-1"><span id="count">3 pods</span>' +
        '<table><tr data-resource-row="ctx/ns/a" tabindex="0"><td><button id="inner">x</button></td></tr></table></div>',
    )
    expect(ownsVerticalArrows(find('[data-resource-list]'))).toBe(false)
    expect(ownsVerticalArrows(find('#count'))).toBe(false)
    expect(ownsVerticalArrows(find('[data-resource-row]'))).toBe(true)
    expect(ownsVerticalArrows(find('#inner'))).toBe(true)
  })

  it('claims the arrows inside the inspector and on the divider', () => {
    const find = mount(
      '<section data-resource-detail tabindex="-1"><button id="tab">Logs</button></section>' +
        '<div role="separator" tabindex="0"></div>',
    )
    expect(ownsVerticalArrows(find('#tab'))).toBe(true)
    expect(ownsVerticalArrows(find('[role="separator"]'))).toBe(true)
    expect(ownsVerticalArrows(window)).toBe(false)
  })
})
