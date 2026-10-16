import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({ get: vi.fn(), open: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { getIstioVirtualService: mocks.get } }))
vi.mock('@/lib/events', () => ({ onKubeChange: () => () => {}, deltaTouches: () => true }))
vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: object) => unknown) => selector({ openResource: mocks.open, selectedResource: null }),
}))
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
})
const { IstioVirtualServiceDetailBody } = await import('./IstioVirtualServiceDetailBody')

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(() => act(() => root.unmount()))

it('links hosts and destinations to the Services they resolve to', async () => {
  mocks.get.mockResolvedValue({
    name: 'reviews',
    namespace: 'shop',
    hosts: ['reviews', 'reviews.example.com'],
    gateways: ['mesh'],
    httpCount: 1,
    tlsCount: 0,
    tcpCount: 0,
    createdAt: '',
    hostServices: [
      { host: 'reviews', namespace: 'shop', name: 'reviews' },
      { host: 'reviews.example.com', namespace: '', name: '' },
    ],
    gatewayRefs: [],
    httpRoutes: [
      {
        match: 'any',
        destinations: [
          { host: 'ratings.prod.svc.cluster.local', subset: 'v1', port: 0, weight: 100, serviceNamespace: 'prod', serviceName: 'ratings' },
        ],
      },
    ],
    tlsRoutes: [],
    tcpRoutes: [],
  })
  await act(async () => root.render(<IstioVirtualServiceDetailBody contextName="dev" namespace="shop" name="reviews" />))
  expect(container.textContent).toContain('mesh (sidecars)')
  const buttons = [...container.querySelectorAll('button')]
  const ratings = buttons.find((b) => b.textContent === 'ratings')!
  await act(async () => ratings.click())
  expect(mocks.open).toHaveBeenCalledWith({ kind: 'Service', namespace: 'prod', name: 'ratings', context: 'dev' })
  // An external host is not a Service: it is shown, not linked.
  expect(buttons.some((b) => b.textContent === 'reviews.example.com')).toBe(false)
  expect(container.textContent).toContain('reviews.example.com')
})
