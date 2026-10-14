import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConditionsSection, ConditionsTable } from './ConditionsTable'
import { ReadyPill } from './ReadyPill'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

function condition(type: string, lastTransitionTime = '') {
  return { type, status: 'True', reason: 'Succeeded', message: '', lastTransitionTime }
}

describe('shared condition UI', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const headers = () => [...container.querySelectorAll('th')].map((th) => th.textContent)

  it('shows the Age column only when a condition records a transition time', () => {
    act(() => root.render(<ConditionsTable conditions={[condition('Ready')]} />))
    expect(headers()).toEqual(['Type', 'Status', 'Reason', 'Message'])
    act(() => root.render(<ConditionsTable conditions={[condition('Ready', '2026-10-01T09:00:00Z')]} />))
    expect(headers()).toEqual(['Type', 'Status', 'Reason', 'Age', 'Message'])
  })

  it('renders the empty message, or nothing when asked to hide', () => {
    act(() => root.render(<ConditionsSection conditions={[]} emptyMessage="Not reconciled yet." />))
    expect(container.textContent).toContain('Not reconciled yet.')
    act(() => root.render(<ConditionsSection conditions={[]} hideWhenEmpty />))
    expect(container.textContent).toBe('')
  })

  it('labels the Ready condition the same way for every integration', () => {
    const label = (status: string, suspended = false) => {
      act(() => root.render(<ReadyPill status={status} suspended={suspended} />))
      return container.textContent
    }
    expect(label('True')).toBe('Ready')
    expect(label('False')).toBe('Not ready')
    expect(label('Unknown')).toBe('Unknown')
    expect(label('')).toBe('—')
    expect(label('True', true)).toBe('Suspended')
  })
})
