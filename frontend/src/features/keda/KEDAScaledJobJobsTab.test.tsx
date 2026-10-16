import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { listKEDAScaledJobJobs: mocks.list } }))
vi.mock('@/lib/events', () => ({ onKubeChange: () => () => {} }))
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
})
const { KEDAScaledJobJobsTab } = await import('./KEDAScaledJobJobsTab')

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function durationCells(): string[] {
  const headers = [...container.querySelectorAll('th')].map((th) => th.textContent)
  const col = headers.indexOf('Duration')
  return [...container.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[col].textContent ?? '')
}

it('shows elapsed time for a running Job and the recorded duration for a finished one', async () => {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  mocks.list.mockResolvedValue([
    { name: 'renderer-b', status: 'Running', completions: '0/1', duration: '', startTime: ago(5), createdAt: ago(5) },
    { name: 'renderer-a', status: 'Complete', completions: '1/1', duration: '42s', startTime: ago(30), createdAt: ago(30) },
  ])
  await act(async () => root.render(<KEDAScaledJobJobsTab contextName="dev" namespace="shop" name="invoice-renderer" />))
  expect(durationCells()).toEqual(['5m', '42s'])
})
