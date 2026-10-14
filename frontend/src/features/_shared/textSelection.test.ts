import { afterEach, describe, expect, it } from 'vitest'
import { selectsTextWithin } from './textSelection'

function select(node: Node, start: number, end: number) {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('selectsTextWithin', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges()
    document.body.innerHTML = ''
  })

  it('is true for a selection inside the element', () => {
    document.body.innerHTML = '<table><tbody><tr id="row"><td>invalid capacity 0</td></tr></tbody></table>'
    const row = document.getElementById('row')!
    select(row.querySelector('td')!.firstChild!, 0, 7)
    expect(selectsTextWithin(row)).toBe(true)
  })

  it('is false for a collapsed selection, as a plain click leaves', () => {
    document.body.innerHTML = '<div id="row">message</div>'
    const row = document.getElementById('row')!
    select(row.firstChild!, 3, 3)
    expect(selectsTextWithin(row)).toBe(false)
  })

  it('is false when the selection sits outside the element', () => {
    document.body.innerHTML = '<p id="other">other text</p><div id="row">message</div>'
    select(document.getElementById('other')!.firstChild!, 0, 5)
    expect(selectsTextWithin(document.getElementById('row')!)).toBe(false)
  })

  it('is false without any selection', () => {
    document.body.innerHTML = '<div id="row">message</div>'
    expect(selectsTextWithin(document.getElementById('row')!)).toBe(false)
  })
})
