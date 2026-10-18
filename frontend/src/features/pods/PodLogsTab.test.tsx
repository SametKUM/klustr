import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
  const view = {
    append: vi.fn(),
    appendMarker: vi.fn(),
    reset: vi.fn(),
    refit: vi.fn(),
    setPaused: vi.fn(),
    filteredText: () => [],
    paused: false,
    pending: 0,
    wrap: true,
  }
  return { view, startPodLogs: vi.fn(), stopPodLogs: vi.fn() }
})

vi.mock('@/lib/api', () => ({
  api: { startPodLogs: mocks.startPodLogs, stopPodLogs: mocks.stopPodLogs, saveTextFile: vi.fn() },
}))
vi.mock('@/lib/wails/wailsjs/runtime/runtime', () => ({ EventsOn: () => () => {}, EventsOff: vi.fn() }))
vi.mock('@/features/_shared/useLogTerminal', () => ({ useLogTerminal: () => mocks.view }))
vi.mock('@/features/_shared/LogViewport', () => ({ LogViewport: () => null }))
// Radix menus don't open under jsdom; a native select drives the same onChange.
vi.mock('@/features/_shared/InlinePicker', () => ({
  InlinePicker: ({
    value,
    options,
    onChange,
    ariaLabel,
  }: {
    value: string
    options: ReadonlyArray<string | { value: string; label?: string }>
    onChange: (value: string) => void
    ariaLabel: string
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o } : o
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label ?? opt.value}
          </option>
        )
      })}
    </select>
  ),
}))

import type { PodDetail } from '@/lib/api'
import { PodLogsTab } from './PodLogsTab'

const detail = {
  name: 'api-0',
  namespace: 'default',
  containers: [{ name: 'app', restartCount: 1 }],
  initContainers: [],
} as unknown as PodDetail

describe('PodLogsTab tail', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    let n = 0
    mocks.startPodLogs.mockImplementation(async () => `log-${++n}`)
    mocks.stopPodLogs.mockResolvedValue(undefined)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const pick = (label: string, value: string) =>
    act(async () => {
      const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

  it('starts from the last 200 lines', async () => {
    await act(async () => root.render(<PodLogsTab detail={detail} contextName="cluster-a" active />))
    expect(mocks.startPodLogs).toHaveBeenCalledWith('cluster-a', 'default', 'api-0', 'app', true, false, 200)
    expect(mocks.view.reset).toHaveBeenLastCalledWith(expect.stringContaining('# streaming app (last 200 lines)'))
  })

  it('restarts the stream from the whole log when Whole log is picked', async () => {
    await act(async () => root.render(<PodLogsTab detail={detail} contextName="cluster-a" active />))
    await pick('Select how many lines to load', '0')

    expect(mocks.stopPodLogs).toHaveBeenCalledWith('log-1')
    expect(mocks.startPodLogs).toHaveBeenLastCalledWith('cluster-a', 'default', 'api-0', 'app', true, false, 0)
    expect(mocks.view.reset).toHaveBeenLastCalledWith(expect.stringContaining('# streaming app (whole log)'))
  })

  it('applies the tail to the previous instance too', async () => {
    await act(async () => root.render(<PodLogsTab detail={detail} contextName="cluster-a" active />))
    await pick('Select how many lines to load', '1000')
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Show previous container logs"]')!.click()
    })

    expect(mocks.startPodLogs).toHaveBeenLastCalledWith('cluster-a', 'default', 'api-0', 'app', false, true, 1000)
    expect(mocks.view.reset).toHaveBeenLastCalledWith(
      expect.stringContaining('# previous instance of app (last 1000 lines before termination)'),
    )
    expect(container.querySelector('[role="status"]')?.textContent).toBe('previous')

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Show previous container logs"]')!.click()
    })
    expect(mocks.startPodLogs).toHaveBeenLastCalledWith('cluster-a', 'default', 'api-0', 'app', true, false, 1000)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('live')
  })

  it('leaves previous mode when the selected container has never restarted', async () => {
    const multi = { ...detail, containers: [...detail.containers, { name: 'sidecar', restartCount: 0 }] } as PodDetail
    await act(async () => root.render(<PodLogsTab detail={multi} contextName="cluster-a" active />))
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Show previous container logs"]')!.click()
    })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('previous')

    await pick('Select container', 'sidecar')
    const previous = container.querySelector<HTMLButtonElement>('button[aria-label="Show previous container logs"]')!
    expect(previous.disabled).toBe(true)
    expect(previous.getAttribute('aria-pressed')).toBe('false')
    expect(previous.parentElement?.title).toContain('has not restarted')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('live')
    expect(mocks.startPodLogs).toHaveBeenLastCalledWith('cluster-a', 'default', 'api-0', 'sidecar', true, false, 200)
  })

  it('follows a new container link in the same mounted inspector without losing the tail selection', async () => {
    const multi = { ...detail, containers: [...detail.containers, { name: 'sidecar', restartCount: 0 }] } as PodDetail
    await act(async () => root.render(<PodLogsTab detail={multi} contextName="cluster-a" initialContainer="app" active />))
    await pick('Select how many lines to load', '1000')
    await act(async () => root.render(<PodLogsTab detail={multi} contextName="cluster-a" initialContainer="sidecar" active />))

    expect(mocks.startPodLogs).toHaveBeenLastCalledWith('cluster-a', 'default', 'api-0', 'sidecar', true, false, 1000)
    expect(mocks.stopPodLogs).toHaveBeenCalledWith('log-2')

    await pick('Select container', 'app')
    const starts = mocks.startPodLogs.mock.calls.length
    await act(async () => root.render(<PodLogsTab detail={{ ...multi } as PodDetail} contextName="cluster-a" initialContainer="sidecar" active={false} />))
    expect(mocks.startPodLogs).toHaveBeenCalledTimes(starts)
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Select container"]')?.value).toBe('app')
  })

  it('honors a repeated explicit container request after a manual selection but ignores passive refreshes', async () => {
    const multi = { ...detail, containers: [...detail.containers, { name: 'sidecar', restartCount: 0 }] } as PodDetail
    const render = (requestId?: number) => root.render(
      <PodLogsTab detail={{ ...multi } as PodDetail} contextName="cluster-a" initialContainer="app" containerRequestId={requestId} active />,
    )
    await act(async () => render(1))
    await pick('Select how many lines to load', '1000')
    await pick('Select container', 'sidecar')
    const starts = mocks.startPodLogs.mock.calls.length
    await act(async () => render(1))
    expect(mocks.startPodLogs).toHaveBeenCalledTimes(starts)
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Select container"]')?.value).toBe('sidecar')
    await act(async () => render())
    expect(mocks.startPodLogs).toHaveBeenCalledTimes(starts)
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Select container"]')?.value).toBe('sidecar')
    await act(async () => render(2))
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Select container"]')?.value).toBe('app')
    expect(mocks.startPodLogs).toHaveBeenCalledTimes(starts + 1)
    expect(mocks.startPodLogs).toHaveBeenLastCalledWith('cluster-a', 'default', 'api-0', 'app', true, false, 1000)
    await act(async () => render(3))
    expect(mocks.startPodLogs).toHaveBeenCalledTimes(starts + 1)
  })
})
