import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CRDInfo } from '@/lib/api'
import { useCRDStore } from '@/store/crds'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({ ensure: vi.fn(), open: vi.fn(), openFromList: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { ensureCustomResourceWatch: mocks.ensure } }))
vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: object) => unknown) =>
    selector({ openResource: mocks.open, openResourceFromList: mocks.openFromList }),
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }))
import { CustomResourceReference } from './CustomResourceReference'

const group = 'image.toolkit.fluxcd.io'
const crd = {
  group,
  resource: 'imagerepositories',
  kind: 'ImageRepository',
  version: 'v1beta2',
} as CRDInfo
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks()
  mocks.ensure.mockResolvedValue(undefined)
  useCRDStore.setState({
    byContext: { source: [crd], another: [{ ...crd, version: 'v1' } as CRDInfo] },
  })
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  useCRDStore.setState({ byContext: {} })
})

function reference(
  contextName = 'source',
  loadSuspended?: (
    contextName: string,
    namespace: string,
    name: string,
  ) => Promise<{ suspended: boolean }>,
) {
  return (
    <CustomResourceReference
      contextName={contextName}
      group={group}
      resource="imagerepositories"
      kind="FluxImageRepository"
      namespace="shared"
      name="images"
      loadSuspended={loadSuspended}
    />
  )
}

it('opens the target in its source context and explicit namespace after the served watch syncs', async () => {
  const rowClick = vi.fn()
  await act(async () => root.render(<div onClick={rowClick}>{reference()}</div>))
  await act(async () => container.querySelector('button')!.click())
  expect(rowClick).not.toHaveBeenCalled()
  expect(mocks.ensure).toHaveBeenCalledWith('source', group, 'v1beta2', 'imagerepositories')
  expect(mocks.open).toHaveBeenCalledWith({
    kind: 'FluxImageRepository',
    context: 'source',
    namespace: 'shared',
    name: 'images',
    gvr: { group, version: 'v1beta2', resource: 'imagerepositories' },
  })
})

it('opens from a list cell without recording Back history', async () => {
  await act(async () => root.render(<div data-resource-list>{reference()}</div>))
  await act(async () => container.querySelector('button')!.click())
  expect(mocks.openFromList).toHaveBeenCalledWith(expect.objectContaining({ name: 'images', context: 'source' }))
  expect(mocks.open).not.toHaveBeenCalled()
})

it('leaves an unavailable target unlinked without switching contexts', async () => {
  await act(async () => root.render(reference('missing')))
  expect(container.querySelector('button')).toBeNull()
  expect(mocks.ensure).not.toHaveBeenCalled()
})

it('does not navigate when watch permission is denied', async () => {
  mocks.ensure.mockRejectedValue(new Error('forbidden'))
  await act(async () => root.render(reference()))
  await act(async () => container.querySelector('button')!.click())
  expect(mocks.open).not.toHaveBeenCalled()
  expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('forbidden'))
})

it('loads the target suspension state before opening its action controls', async () => {
  const loadSuspended = vi.fn().mockResolvedValue({ suspended: true })
  await act(async () => root.render(reference('source', loadSuspended)))
  await act(async () => container.querySelector('button')!.click())
  expect(loadSuspended).toHaveBeenCalledWith('source', 'shared', 'images')
  expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ suspended: true }))
})

it('does not open a stale reference after its context changes during watch startup', async () => {
  let resolve: () => void = () => {}
  mocks.ensure.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done
    }),
  )
  await act(async () => root.render(reference()))
  await act(async () => container.querySelector('button')!.click())
  await act(async () => root.render(reference('another')))
  expect(container.querySelector('button')!.disabled).toBe(false)
  await act(async () => resolve())
  expect(mocks.open).not.toHaveBeenCalled()
})
