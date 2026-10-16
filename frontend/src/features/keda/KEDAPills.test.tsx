import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { KEDAPausedPill } from './KEDAPills'
import type { KEDAPauseFields } from './kedaPause'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const running: KEDAPauseFields = { paused: false, pausedReplicas: '', scaleInPaused: false, scaleOutPaused: false }

it.each([
  [running, '—'],
  [{ ...running, paused: true }, 'Paused'],
  [{ ...running, paused: true, pausedReplicas: '0' }, 'Paused at 0'],
  [{ ...running, scaleInPaused: true }, 'Scale-in paused'],
  [{ ...running, scaleOutPaused: true }, 'Scale-out paused'],
  [{ ...running, scaleInPaused: true, scaleOutPaused: true }, 'Scale-in/out paused'],
  [{ ...running, paused: true, scaleInPaused: true }, 'Paused'],
])('labels %o as %s', (state, label) => {
  act(() => root.render(<KEDAPausedPill state={state} />))
  expect(container.textContent).toBe(label)
})
