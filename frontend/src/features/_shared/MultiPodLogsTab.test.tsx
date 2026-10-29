import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
  return {
    view: {
      append: vi.fn(),
      appendMarker: vi.fn(),
      reset: vi.fn(),
      setPaused: vi.fn(),
      filteredText: () => [],
      paused: false,
      pending: 0,
      wrap: true,
    },
    podLogTargets: vi.fn(),
    startPodLogs: vi.fn(),
    stopPodLogs: vi.fn(),
    eventsOn: vi.fn(),
    eventsOff: vi.fn(),
  }
})

vi.mock('@/lib/api', () => ({
  api: {
    podLogTargets: mocks.podLogTargets,
    startPodLogs: mocks.startPodLogs,
    stopPodLogs: mocks.stopPodLogs,
    saveTextFile: vi.fn(),
  },
}))
vi.mock('@/lib/wails/wailsjs/runtime/runtime', () => ({
  EventsOn: mocks.eventsOn,
  EventsOff: mocks.eventsOff,
}))
vi.mock('@/features/_shared/useLogTerminal', () => ({ useLogTerminal: () => mocks.view }))
vi.mock('@/features/_shared/LogViewport', () => ({ LogViewport: () => null }))
// Use the same picker callback without depending on Radix layout in jsdom.
vi.mock('@/features/_shared/InlinePicker', () => ({
  InlinePicker: ({ value, options, onChange, ariaLabel }: {
    value: string
    options: ReadonlyArray<{ value: string; label: string }>
    onChange: (value: string) => void
    ariaLabel: string
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

import { MultiPodLogsTab } from './MultiPodLogsTab'

const targets = [
  { pod: 'api-0', containers: ['app', 'sidecar'] },
  { pod: 'api-1', containers: ['app'] },
]
const selector = { app: 'api' }
const pickerLabel = 'Select how many lines to load per container'

describe('MultiPodLogsTab tail', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.podLogTargets.mockResolvedValue(targets)
    let n = 0
    mocks.startPodLogs.mockImplementation(async () => `log-${++n}`)
    mocks.stopPodLogs.mockResolvedValue(undefined)
    mocks.eventsOn.mockImplementation(() => vi.fn())
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const render = () => act(async () => {
    root.render(<MultiPodLogsTab contextName="cluster-a" namespace="default" selector={selector} title="api" />)
  })

  const pick = (value: string) => act(async () => {
    const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${pickerLabel}"]`)!
    expect(select).not.toBeNull()
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })

  it('keeps the 50-line default and offers only the bounded workload histories', async () => {
    await render()
    const picker = container.querySelector<HTMLSelectElement>(`select[aria-label="${pickerLabel}"]`)
    expect(picker?.value).toBe('50')
    expect(Array.from(picker?.options ?? [], (option) => [option.value, option.textContent])).toEqual([
      ['50', '50 lines'],
      ['200', '200 lines'],
      ['1000', '1,000 lines'],
    ])
    expect(mocks.startPodLogs.mock.calls).toEqual([
      ['cluster-a', 'default', 'api-0', 'app', true, false, 50],
      ['cluster-a', 'default', 'api-0', 'sidecar', true, false, 50],
      ['cluster-a', 'default', 'api-1', 'app', true, false, 50],
    ])
    expect(mocks.view.reset).toHaveBeenCalledWith(
      '\x1b[2m# tailing api: 2 pods (last 50 lines per container)\x1b[0m',
    )
  })

  it.each([200, 1000])('restarts every container stream with a tail of %i', async (tail) => {
    await render()
    const unsubscribes = mocks.eventsOn.mock.results.map((result) => result.value)
    await pick(String(tail))

    expect(mocks.podLogTargets).toHaveBeenCalledTimes(1)
    expect(mocks.stopPodLogs.mock.calls).toEqual([['log-1'], ['log-2'], ['log-3']])
    unsubscribes.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalledOnce())
    expect(mocks.eventsOff.mock.calls).toEqual([
      ['pod:logs:line:log-1', 'pod:logs:close:log-1'],
      ['pod:logs:line:log-2', 'pod:logs:close:log-2'],
      ['pod:logs:line:log-3', 'pod:logs:close:log-3'],
    ])
    expect(mocks.startPodLogs.mock.calls.slice(3)).toEqual([
      ['cluster-a', 'default', 'api-0', 'app', true, false, tail],
      ['cluster-a', 'default', 'api-0', 'sidecar', true, false, tail],
      ['cluster-a', 'default', 'api-1', 'app', true, false, tail],
    ])
    expect(mocks.view.reset).toHaveBeenCalledTimes(2)
    expect(mocks.view.reset).toHaveBeenLastCalledWith(
      `\x1b[2m# tailing api: 2 pods (last ${tail} lines per container)\x1b[0m`,
    )
  })

  it('can return to 50 lines after loading a longer history', async () => {
    await render()
    await pick('1000')
    await pick('50')

    expect(mocks.stopPodLogs.mock.calls.slice(3)).toEqual([['log-4'], ['log-5'], ['log-6']])
    expect(mocks.startPodLogs.mock.calls.slice(6).map((call) => call[6])).toEqual([50, 50, 50])
    expect(mocks.view.reset).toHaveBeenLastCalledWith(
      '\x1b[2m# tailing api: 2 pods (last 50 lines per container)\x1b[0m',
    )
  })

  it('closes stale streams that finish starting after the tail changes', async () => {
    let resolveOld!: (id: string) => void
    mocks.startPodLogs.mockImplementationOnce(() => new Promise<string>((resolve) => { resolveOld = resolve }))
    await render()
    await pick('200')
    const listenerCount = mocks.eventsOn.mock.calls.length

    await act(async () => { resolveOld('late-log') })

    expect(mocks.stopPodLogs).toHaveBeenCalledWith('late-log')
    expect(mocks.eventsOn).toHaveBeenCalledTimes(listenerCount)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('live')
  })

  it('ignores a start failure from the old history after the limit changes', async () => {
    let rejectOld!: (reason: Error) => void
    mocks.startPodLogs.mockImplementationOnce(() => new Promise<string>((_, reject) => { rejectOld = reject }))
    await render()
    await pick('1000')

    await act(async () => { rejectOld(new Error('old stream failed')) })

    expect(mocks.view.appendMarker).not.toHaveBeenCalled()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('live')
  })

  it('keeps the chosen history when the pod list is reloaded', async () => {
    await render()
    await pick('1000')
    mocks.podLogTargets.mockResolvedValue(targets.map((target) => ({ ...target })))
    const starts = mocks.startPodLogs.mock.calls.length

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Reload pod list"]')!.click()
    })

    expect(mocks.podLogTargets).toHaveBeenCalledTimes(2)
    expect(mocks.startPodLogs.mock.calls.slice(starts).map((call) => call[6])).toEqual([1000, 1000, 1000])
    expect(container.querySelector<HTMLSelectElement>(`select[aria-label="${pickerLabel}"]`)?.value).toBe('1000')
  })
})
