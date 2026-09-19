import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { kube } from '@/lib/wails/wailsjs/go/models'
import { ListenerSetDetailBody } from './ListenerSetDetailBody'

const { useResourceDetail, openResource } = vi.hoisted(() => ({ useResourceDetail: vi.fn(), openResource: vi.fn() }))
vi.mock('@/features/_shared/useResourceDetail', () => ({ useResourceDetail }))
vi.mock('@/lib/api', () => ({ api: { getListenerSet: vi.fn() } }))
vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: { openResource: typeof openResource }) => unknown) => selector({ openResource }),
}))

const detail = kube.ListenerSetDetail.createFrom({
  name: 'frontend', namespace: 'apps', uid: 'listeners-uid', createdAt: '2026-09-20T00:00:00Z',
  parent: { group: 'gateway.networking.k8s.io', kind: 'Gateway', namespace: 'infra', name: 'edge', sectionName: '', port: 0 },
  conditions: [], labels: {}, annotations: {},
  listeners: [{
    name: 'https', hostname: '*.example.com', protocol: 'HTTPS', port: 8443,
    allowedNamespaces: 'Selector', namespaceSelector: 'team=frontend',
    tlsMode: 'Terminate', attachedRoutes: 0,
    allowedKinds: ['gateway.networking.k8s.io/HTTPRoute'], supportedKinds: [],
    certificateRefs: [{ group: '', kind: 'Secret', namespace: 'certs', name: 'frontend-tls', sectionName: '', port: 0 }],
    conditions: [{ type: 'Programmed', status: 'Unknown', reason: 'Pending', message: 'Observed generation 1 is older than current generation 2.' }],
  }],
})

describe('ListenerSetDetailBody', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    openResource.mockReset()
    useResourceDetail.mockReturnValue({ detail, error: null })
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows listener TLS, namespace selection, allowed kinds and stale status independently', () => {
    act(() => root.render(<ListenerSetDetailBody contextName="staging" namespace="apps" name="frontend" />))
    expect(container.textContent).toContain('HTTPS / 8443')
    expect(container.textContent).toContain('team=frontend')
    expect(container.textContent).toContain('gateway.networking.k8s.io/HTTPRoute')
    expect(container.textContent).toContain('Supported route kindsNot reported')
    expect(container.textContent).toContain('TLS modeTerminate')
    expect(container.textContent).toContain('Attached routes0')
    expect(container.textContent).toContain('No conditions reported yet.')
    expect(container.textContent).toContain('Observed generation 1 is older than current generation 2.')
  })

  it('links a certificate reference to its explicit namespace and source context', () => {
    act(() => root.render(<ListenerSetDetailBody contextName="staging" namespace="apps" name="frontend" />))
    const certificate = container.querySelector<HTMLButtonElement>('button[title="Open Secret certs/frontend-tls"]')!
    act(() => certificate.click())
    expect(openResource).toHaveBeenCalledWith({ kind: 'Secret', namespace: 'certs', name: 'frontend-tls', context: 'staging' })
  })
})
