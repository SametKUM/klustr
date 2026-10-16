import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CRDInfo, ResourceManager } from '@/lib/api'
import { useCRDStore } from '@/store/crds'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({ ensure: vi.fn(), open: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { ensureCustomResourceWatch: mocks.ensure } }))
vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: object) => unknown) => selector({ openResource: mocks.open }),
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }))
import { ManagedByChips } from './ManagedByChips'

const argoCRD = { group: 'argoproj.io', resource: 'applications', kind: 'Application', version: 'v1alpha1' } as CRDInfo
const fluxCRD = {
  group: 'kustomize.toolkit.fluxcd.io',
  resource: 'kustomizations',
  kind: 'Kustomization',
  version: 'v1',
} as CRDInfo

function manager(over: Partial<ResourceManager>): ResourceManager {
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

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks()
  mocks.ensure.mockResolvedValue(undefined)
  useCRDStore.setState({ byContext: { devops: [argoCRD], dev: [fluxCRD] } })
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  useCRDStore.setState({ byContext: {} })
})

it('opens an Application in the context that runs Argo CD', async () => {
  await act(async () => root.render(<ManagedByChips contextName="dev" managers={[manager({ revertsDrift: true, revertReason: 'self-heal is on' })]} />))
  const chip = container.querySelector('button')!
  expect(chip.textContent).toContain('shop-api')
  expect(chip.title).toContain('Argo CD Application argocd/shop-api in devops')
  expect(chip.title).toContain('self-heal is on')
  await act(async () => chip.click())
  expect(mocks.ensure).toHaveBeenCalledWith('devops', 'argoproj.io', 'v1alpha1', 'applications')
  expect(mocks.open).toHaveBeenCalledWith({
    kind: 'Application',
    namespace: 'argocd',
    name: 'shop-api',
    context: 'devops',
    gvr: { group: 'argoproj.io', version: 'v1alpha1', resource: 'applications' },
  })
})

it('opens a Flux owner under its Klustr kind with its suspension state', async () => {
  const kustomization = manager({
    tool: 'flux',
    kind: 'Kustomization',
    group: 'kustomize.toolkit.fluxcd.io',
    resource: 'kustomizations',
    context: 'dev',
    namespace: 'flux-system',
    name: 'apps',
    suspended: true,
  })
  await act(async () => root.render(<ManagedByChips contextName="dev" managers={[kustomization]} />))
  await act(async () => container.querySelector('button')!.click())
  expect(mocks.open).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'FluxKustomization', namespace: 'flux-system', suspended: true }),
  )
})

it('opens a Helm release without a CRD', async () => {
  const release = manager({ tool: 'helm', kind: 'HelmRelease', group: '', resource: '', context: 'dev', namespace: 'shop', name: 'api' })
  await act(async () => root.render(<ManagedByChips contextName="dev" managers={[release]} />))
  await act(async () => container.querySelector('button')!.click())
  expect(mocks.ensure).not.toHaveBeenCalled()
  expect(mocks.open).toHaveBeenCalledWith({ kind: 'HelmRelease', namespace: 'shop', name: 'api', context: 'dev' })
})

it('shows an owner it cannot open by name only', async () => {
  // The tracking-id names an Application no watched context holds.
  await act(async () =>
    root.render(<ManagedByChips contextName="dev" managers={[manager({ resolved: false, context: '', namespace: '' })]} />),
  )
  expect(container.querySelector('button')).toBeNull()
  expect(container.textContent).toContain('shop-api')
})

it('drops a pending navigation when the chip unmounts', async () => {
  let finishSync!: () => void
  mocks.ensure.mockReturnValue(new Promise<void>((resolve) => (finishSync = resolve)))
  await act(async () => root.render(<ManagedByChips contextName="dev" managers={[manager({})]} />))
  await act(async () => container.querySelector('button')!.click())
  // The panel moves to another resource while the Application watch syncs.
  await act(async () => root.render(<ManagedByChips contextName="dev" managers={[]} />))
  await act(async () => finishSync())
  expect(mocks.open).not.toHaveBeenCalled()
})

it('renders nothing for an unmanaged resource', async () => {
  await act(async () => root.render(<ManagedByChips contextName="dev" managers={[]} />))
  expect(container.innerHTML).toBe('')
})
