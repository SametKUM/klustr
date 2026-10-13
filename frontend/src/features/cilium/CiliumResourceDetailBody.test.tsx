import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { kube } from '@/lib/wails/wailsjs/go/models'
import type { KubeDelta } from '@/lib/events'

const { getCiliumResource, handlers } = vi.hoisted(() => ({
  getCiliumResource: vi.fn(),
  handlers: new Map<string, (context: string, delta?: KubeDelta) => void>(),
}))
vi.mock('@/lib/api', () => ({ api: { getCiliumResource } }))
vi.mock('@/lib/events', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/events')>(),
  onKubeChange: (kind: string, callback: (context: string, delta?: KubeDelta) => void) => {
    handlers.set(kind, callback)
    return () => handlers.delete(kind)
  },
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true, configurable: true,
  value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
})
const { useUIStore } = await import('@/store/ui')
const { useCRDStore } = await import('@/store/crds')
const { CiliumResourceDetailBody } = await import('./CiliumResourceDetailBody')

function fixture(state = 'waiting-for-identity') {
  return kube.CiliumResourceDetail.createFrom({
    name: 'web', namespace: 'app', kind: 'CiliumEndpoint', state, primary: '10.0.1.2', secondary: '12345', createdAt: '',
    fields: [{ label: 'Addresses', value: '10.0.1.2' }],
    tables: [{ title: 'Failing controllers', columns: ['Name', 'Last error'], rows: [['identity', 'allocation pending']] }],
    references: [
      { kind: 'Pod', resource: '', namespace: 'app', name: 'web' },
      { kind: 'CiliumIdentity', resource: 'ciliumidentities', namespace: '', name: '12345' },
      { kind: 'CiliumBGPClusterConfig', resource: 'ciliumbgpclusterconfigs', namespace: '', name: 'missing' },
    ],
  })
}

describe('Cilium CRD detail', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    handlers.clear()
    getCiliumResource.mockReset().mockResolvedValue(fixture())
    useCRDStore.getState().reset()
    useCRDStore.getState().setCRDs('row-context', [kube.CRDInfo.createFrom({ group: 'cilium.io', resource: 'ciliumidentities', kind: 'CiliumIdentity', version: 'v2alpha1' })])
    useCRDStore.getState().setCRDs('other-context', [kube.CRDInfo.createFrom({ group: 'cilium.io', resource: 'ciliumidentities', kind: 'CiliumIdentity', version: 'v2' })])
    useUIStore.setState({
      selectedContext: 'other-context', resourceNavStack: [],
      selectedResource: { kind: 'CiliumEndpoint', namespace: 'app', name: 'web', context: 'row-context', gvr: { group: 'cilium.io', version: 'v2', resource: 'ciliumendpoints' } },
    })
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })
  const render = async (root: Root) => {
    await act(async () => root.render(<CiliumResourceDetailBody contextName="row-context" resource="ciliumendpoints" namespace="app" name="web" />))
  }

  it('renders reported CRD data and opens references in the row context and served version', async () => {
    await render(root)
    expect(getCiliumResource).toHaveBeenCalledWith('row-context', 'ciliumendpoints', 'app', 'web')
    expect(container.textContent).toContain('waiting-for-identity')
    expect(container.textContent).toContain('allocation pending')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)

    const buttons = Array.from(container.querySelectorAll('button'))
    expect(buttons.some((b) => b.textContent?.includes('missing'))).toBe(false)
    act(() => buttons.find((b) => b.textContent === 'CiliumIdentity/12345')!.click())
    expect(useUIStore.getState().selectedResource).toEqual({
      kind: 'CiliumIdentity', namespace: '', name: '12345', context: 'row-context',
      gvr: { group: 'cilium.io', version: 'v2alpha1', resource: 'ciliumidentities' },
    })
    act(() => buttons.find((b) => b.textContent === 'Pod/app/web')!.click())
    expect(useUIStore.getState().selectedResource).toEqual({ kind: 'Pod', namespace: 'app', name: 'web', context: 'row-context' })
  })

  it('refreshes on its own CR watch events and ignores other contexts and objects', async () => {
    await render(root)
    const notify = handlers.get('cr:cilium.io/ciliumendpoints')!
    expect(notify).toBeTypeOf('function')
    await act(async () => {
      notify('other-context')
      notify('row-context', { gen: 1, upserts: [{ namespace: 'app', name: 'other' }], removed: [] })
    })
    expect(getCiliumResource).toHaveBeenCalledTimes(1)
    getCiliumResource.mockResolvedValue(fixture('ready'))
    await act(async () => notify('row-context', { gen: 2, upserts: [{ namespace: 'app', name: 'web' }], removed: [] }))
    expect(getCiliumResource).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('ready')
    expect(container.textContent).not.toContain('waiting-for-identity')
  })

  it('shows access errors without retaining a stale detail', async () => {
    await render(root)
    getCiliumResource.mockRejectedValue(new Error('forbidden'))
    await act(async () => handlers.get('cr:cilium.io/ciliumendpoints')!('row-context'))
    expect(container.textContent).toContain('forbidden')
    expect(container.textContent).not.toContain('10.0.1.2')
  })
})
