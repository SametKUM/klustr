import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CRDInfo, TektonPipelineDetail, TektonWorkspaceSpec } from '@/lib/api'
import { useCRDStore } from '@/store/crds'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  ensure: vi.fn(),
  start: vi.fn(),
  open: vi.fn(),
  listeners: [] as ((ctx: string) => void)[],
}))
vi.mock('@/lib/api', () => ({
  api: { getTektonPipeline: mocks.get, ensureCustomResourceWatch: mocks.ensure, startTektonPipeline: mocks.start },
}))
vi.mock('@/lib/events', () => ({
  onKubeChange: (_kind: string, fn: (ctx: string) => void) => {
    mocks.listeners.push(fn)
    return () => {}
  },
  deltaTouches: () => true,
}))
vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: object) => unknown) =>
    selector({
      openResource: mocks.open,
      selectedResource: { gvr: { group: 'tekton.dev', version: 'v1', resource: 'pipelines' } },
    }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const { StartTektonPipelineButton } = await import('./StartTektonPipelineButton')

const runsCRD = { group: 'tekton.dev', version: 'v1', resource: 'pipelineruns', kind: 'PipelineRun' } as CRDInfo

function pipeline(workspaces: string[]): TektonPipelineDetail {
  return {
    name: 'build',
    namespace: 'ci',
    params: [],
    workspaces: workspaces.map((name) => ({ name, description: '', optional: false }) as TektonWorkspaceSpec),
  } as unknown as TektonPipelineDetail
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let mounted: boolean
beforeEach(() => {
  vi.clearAllMocks()
  mocks.listeners.length = 0
  mocks.start.mockResolvedValue('build-run-x7k2p')
  useCRDStore.setState({ byContext: { dev: [runsCRD] } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mounted = true
})
afterEach(() => {
  if (mounted) act(() => root.unmount())
  container.remove()
  useCRDStore.setState({ byContext: {} })
})

async function openDialog() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <StartTektonPipelineButton contextName="dev" namespace="ci" name="build" />
      </QueryClientProvider>,
    ),
  )
  await act(async () => startButton(false).click())
}

function startButton(inDialog: boolean): HTMLButtonElement {
  const scope = inDialog ? '[role="dialog"] button' : 'button'
  const found = [...document.querySelectorAll<HTMLButtonElement>(scope)].find((b) => b.textContent?.trim() === 'Start')
  if (!found) throw new Error('no Start button')
  return found
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

it('opens the new run only after its PipelineRun watch has synced', async () => {
  mocks.get.mockResolvedValue(pipeline([]))
  const sync = deferred()
  mocks.ensure.mockReturnValue(sync.promise)
  await openDialog()
  await act(async () => startButton(true).click())
  expect(mocks.start).toHaveBeenCalledWith('dev', 'ci', 'build', expect.anything())
  expect(mocks.ensure).toHaveBeenCalledWith('dev', 'tekton.dev', 'v1', 'pipelineruns')
  expect(mocks.open).not.toHaveBeenCalled()
  await act(async () => sync.resolve())
  expect(mocks.open).toHaveBeenCalledWith({
    kind: 'PipelineRun',
    namespace: 'ci',
    name: 'build-run-x7k2p',
    context: 'dev',
    gvr: { group: 'tekton.dev', version: 'v1', resource: 'pipelineruns' },
  })
})

it('does not open the run once the dialog is gone', async () => {
  mocks.get.mockResolvedValue(pipeline([]))
  const sync = deferred()
  mocks.ensure.mockReturnValue(sync.promise)
  await openDialog()
  await act(async () => startButton(true).click())
  act(() => root.unmount())
  mounted = false
  await act(async () => sync.resolve())
  expect(mocks.open).not.toHaveBeenCalled()
})

it('keeps the form working when the Pipeline gains a workspace while it is open', async () => {
  mocks.get.mockResolvedValue(pipeline(['source']))
  await openDialog()
  const source = document.querySelector<HTMLSelectElement>('select[aria-label="Workspace source source"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(source, 'emptyDir')
    source.dispatchEvent(new Event('change', { bubbles: true }))
  })

  mocks.get.mockResolvedValue(pipeline(['source', 'output']))
  await act(async () => mocks.listeners.forEach((fn) => fn('dev')))

  const output = document.querySelector<HTMLSelectElement>('select[aria-label="Workspace output source"]')
  expect(output?.value).toBe('volumeClaimTemplate')
  expect(document.querySelector<HTMLSelectElement>('select[aria-label="Workspace source source"]')!.value).toBe(
    'emptyDir',
  )
  mocks.ensure.mockResolvedValue(undefined)
  await act(async () => startButton(true).click())
  const opts = mocks.start.mock.calls[0][3]
  expect(opts.workspaces.map((w: { name: string; kind: string }) => [w.name, w.kind])).toEqual([
    ['source', 'emptyDir'],
    ['output', 'volumeClaimTemplate'],
  ])
})
