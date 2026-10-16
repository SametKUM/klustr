import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({
  getSO: vi.fn(),
  getSJ: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  setJobPaused: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  api: {
    getKEDAScaledObject: mocks.getSO,
    getKEDAScaledJob: mocks.getSJ,
    pauseKEDAScaledObject: mocks.pause,
    resumeKEDAScaledObject: mocks.resume,
    setKEDAScaledJobPaused: mocks.setJobPaused,
  },
}))
vi.mock('@/lib/events', () => ({ onKubeChange: () => () => {}, deltaTouches: () => true }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
})
const { KEDAPauseButton } = await import('./KEDAPauseButton')

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of [mocks.pause, mocks.resume, mocks.setJobPaused]) fn.mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(kind: 'ScaledObject' | 'ScaledJob') {
  const client = new QueryClient()
  return act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <KEDAPauseButton contextName="dev" kind={kind} namespace="shop" name="orders" />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  )
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
  if (!found) throw new Error(`no ${label} button`)
  return found as HTMLButtonElement
}

it('resumes a ScaledObject that carries a pause annotation', async () => {
  mocks.getSO.mockResolvedValue({ paused: true, annotated: true, minReplicas: 1 })
  await render('ScaledObject')
  await act(async () => button('Resume').click())
  expect(mocks.resume).toHaveBeenCalledWith('dev', 'shop', 'orders')
})

it('resumes a ScaledObject paused in one direction only', async () => {
  mocks.getSO.mockResolvedValue({ paused: false, scaleInPaused: false, scaleOutPaused: true, annotated: false, minReplicas: 1 })
  await render('ScaledObject')
  await act(async () => button('Resume').click())
  expect(mocks.resume).toHaveBeenCalledWith('dev', 'shop', 'orders')
})

it('pauses a ScaledObject at its current replica count by default', async () => {
  mocks.getSO.mockResolvedValue({ paused: false, annotated: false, minReplicas: 2 })
  await render('ScaledObject')
  await act(async () => button('Pause').click())
  const confirm = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Pause')!
  await act(async () => (confirm as HTMLButtonElement).click())
  expect(mocks.pause).toHaveBeenCalledWith('dev', 'shop', 'orders', -1)
})

it('pauses a ScaledObject at a chosen replica count', async () => {
  mocks.getSO.mockResolvedValue({ paused: false, annotated: false, minReplicas: 2 })
  await render('ScaledObject')
  await act(async () => button('Pause').click())
  const radios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]')
  await act(async () => radios[1].click())
  const confirm = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Pause')!
  await act(async () => (confirm as HTMLButtonElement).click())
  expect(mocks.pause).toHaveBeenCalledWith('dev', 'shop', 'orders', 2)
})

it('pauses a ScaledJob without asking for replicas', async () => {
  mocks.getSJ.mockResolvedValue({ paused: false, annotated: false, minReplicas: 0 })
  await render('ScaledJob')
  await act(async () => button('Pause').click())
  expect(mocks.setJobPaused).toHaveBeenCalledWith('dev', 'shop', 'orders', true)
})
