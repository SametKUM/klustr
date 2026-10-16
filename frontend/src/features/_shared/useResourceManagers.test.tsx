import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CRDInfo, ResourceManager } from '@/lib/api'
import type { KubeDelta } from '@/lib/events'
import { useCRDStore } from '@/store/crds'
import type { SelectedResource } from '@/store/ui'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
type Handler = (contextName: string, delta?: KubeDelta) => void
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  ensure: vi.fn(),
  handlers: new Map<string, Set<(contextName: string, delta?: unknown) => void>>(),
}))
vi.mock('@/lib/api', () => ({
  api: { getResourceManagers: mocks.get, ensureCustomResourceWatch: mocks.ensure },
}))
vi.mock('@/lib/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/events')>()),
  onKubeChange: (kind: string, handler: Handler) => {
    const set = mocks.handlers.get(kind) ?? new Set()
    mocks.handlers.set(kind, set)
    set.add(handler as (contextName: string, delta?: unknown) => void)
    return () => set.delete(handler as (contextName: string, delta?: unknown) => void)
  },
}))
import { MANAGERS_RELOAD_DELAY_MS, useResourceManagers } from './useResourceManagers'

const argoCRD = { group: 'argoproj.io', resource: 'applications', kind: 'Application', version: 'v1alpha1' } as CRDInfo
const deployment: SelectedResource = { kind: 'Deployment', namespace: 'shop', name: 'api', context: 'dev' }

function application(over: Partial<ResourceManager> = {}): ResourceManager {
  return {
    tool: 'argocd',
    kind: 'Application',
    group: 'argoproj.io',
    resource: 'applications',
    context: 'devops',
    namespace: 'argocd',
    name: 'shop-api',
    resolved: true,
    suspended: false,
    revertsDrift: false,
    revertReason: '',
    ignoredFields: [],
    ...over,
  } as ResourceManager
}

function emit(kind: string, contextName: string, delta?: KubeDelta) {
  mocks.handlers.get(kind)?.forEach((h) => h(contextName, delta))
}

function touching(namespace: string, name: string): KubeDelta {
  return { upserts: [{ namespace, name }], removed: [], gen: 1 }
}

let container: HTMLDivElement
let root: Root
const seen: { managers: ResourceManager[] } = { managers: [] }

function Harness({ resource }: { resource: SelectedResource }) {
  const managers = useResourceManagers('dev', resource)
  useEffect(() => {
    seen.managers = managers
  })
  return null
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.handlers.clear()
  mocks.ensure.mockResolvedValue(undefined)
  useCRDStore.setState({ byContext: { dev: [], devops: [argoCRD] } })
  container = document.createElement('div')
  root = createRoot(container)
  seen.managers = []
})

afterEach(() => {
  act(() => root.unmount())
  useCRDStore.setState({ byContext: {} })
  vi.useRealTimers()
})

it('reloads the owners when the open resource changes', async () => {
  mocks.get.mockResolvedValueOnce([]).mockResolvedValueOnce([application()])
  await act(async () => root.render(<Harness resource={deployment} />))
  await settle()
  expect(seen.managers).toEqual([])
  expect(mocks.get).toHaveBeenCalledTimes(1)

  emit('Deployment', 'dev', touching('shop', 'web'))
  emit('Deployment', 'prod', touching('shop', 'api'))
  await settle(MANAGERS_RELOAD_DELAY_MS)
  expect(mocks.get).toHaveBeenCalledTimes(1)

  // A burst of changes is one lookup.
  emit('Deployment', 'dev', touching('shop', 'api'))
  emit('Deployment', 'dev', touching('shop', 'api'))
  await settle(MANAGERS_RELOAD_DELAY_MS)
  expect(mocks.get).toHaveBeenCalledTimes(2)
  expect(seen.managers).toEqual([application()])
})

it('follows an owner CR in its own context', async () => {
  mocks.get
    .mockResolvedValueOnce([application()])
    .mockResolvedValueOnce([application({ revertsDrift: true, revertReason: 'self-heal is on' })])
  await act(async () => root.render(<Harness resource={deployment} />))
  await settle()
  // Without its watch the Application emits no change events.
  expect(mocks.ensure).toHaveBeenCalledWith('devops', 'argoproj.io', 'v1alpha1', 'applications')

  emit('cr:argoproj.io/applications', 'dev', touching('argocd', 'shop-api'))
  emit('cr:argoproj.io/applications', 'devops', touching('argocd', 'other'))
  await settle(MANAGERS_RELOAD_DELAY_MS)
  expect(mocks.get).toHaveBeenCalledTimes(1)

  emit('cr:argoproj.io/applications', 'devops', touching('argocd', 'shop-api'))
  await settle(MANAGERS_RELOAD_DELAY_MS)
  expect(mocks.get).toHaveBeenCalledTimes(2)
  expect(seen.managers[0]?.revertsDrift).toBe(true)
})

it('looks the owners up again once the context reports its CRDs', async () => {
  mocks.get.mockResolvedValue([])
  useCRDStore.setState({ byContext: {} })
  await act(async () => root.render(<Harness resource={deployment} />))
  await settle()
  expect(mocks.get).toHaveBeenCalledTimes(1)

  await act(async () => useCRDStore.setState({ byContext: { dev: [argoCRD] } }))
  await settle()
  expect(mocks.get).toHaveBeenCalledTimes(2)
})

it('stops following changes after the panel closes', async () => {
  mocks.get.mockResolvedValue([application()])
  await act(async () => root.render(<Harness resource={deployment} />))
  await settle()
  emit('Deployment', 'dev', touching('shop', 'api'))
  act(() => root.unmount())
  root = createRoot(container)
  await settle(MANAGERS_RELOAD_DELAY_MS)
  expect(mocks.get).toHaveBeenCalledTimes(1)
  expect([...mocks.handlers.values()].every((set) => set.size === 0)).toBe(true)
})
