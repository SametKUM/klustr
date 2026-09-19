import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendTLSPolicyDetail } from '@/lib/api'
import { kube } from '@/lib/wails/wailsjs/go/models'
import { BackendTLSPolicyDetailBody } from './BackendTLSPolicyDetailBody'

const { useResourceDetail, openResource } = vi.hoisted(() => ({ useResourceDetail: vi.fn(), openResource: vi.fn() }))
vi.mock('@/features/_shared/useResourceDetail', () => ({ useResourceDetail }))
vi.mock('@/lib/api', () => ({ api: { getBackendTLSPolicy: vi.fn() } }))
vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: { openResource: typeof openResource }) => unknown) => selector({ openResource }),
}))

function policy(): BackendTLSPolicyDetail {
  return kube.BackendTLSPolicyDetail.createFrom({
    name: 'backend', namespace: 'apps', uid: 'policy-uid', createdAt: '2026-09-20T00:00:00Z',
    hostname: 'backend.internal', wellKnownCACertificates: '', labels: {}, annotations: {}, options: {},
    targetRefs: [{ group: '', kind: 'Service', namespace: 'apps', name: 'api', sectionName: 'https', port: 0 }],
    caCertificateRefs: [{ group: '', kind: 'ConfigMap', namespace: 'apps', name: 'trusted-ca', sectionName: '', port: 0 }],
    subjectAltNames: [{ type: 'URI', value: 'spiffe://example.com/api' }],
    ancestors: [{
      ancestor: { group: 'gateway.networking.k8s.io', kind: 'Gateway', namespace: 'infra', name: 'edge', sectionName: '', port: 0 },
      controller: 'example.com/gateway',
      conditions: [{ type: 'Accepted', status: 'False', reason: 'Conflicted', message: 'Another policy targets this Service.' }],
    }],
  })
}

describe('BackendTLSPolicyDetailBody', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    openResource.mockReset()
    useResourceDetail.mockReturnValue({ detail: policy(), error: null })
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('renders TLS validation, URI SANs, named target sections and per-ancestor rejection', () => {
    act(() => root.render(<BackendTLSPolicyDetailBody contextName="staging" namespace="apps" name="backend" />))
    expect(container.textContent).toContain('backend.internal')
    expect(container.textContent).toContain('spiffe://example.com/api')
    expect(container.textContent).toContain('https')
    expect(container.textContent).toContain('example.com/gateway')
    expect(container.textContent).toContain('Conflicted')
    expect(container.textContent).toContain('Another policy targets this Service.')
    const ca = container.querySelector<HTMLButtonElement>('button[title="Open ConfigMap apps/trusted-ca"]')!
    act(() => ca.click())
    expect(openResource).toHaveBeenCalledWith({ kind: 'ConfigMap', namespace: 'apps', name: 'trusted-ca', context: 'staging' })
  })

  it('explains hostname validation and pending ancestor status for system CAs without SANs', () => {
    useResourceDetail.mockReturnValue({
      detail: { ...policy(), wellKnownCACertificates: 'System', subjectAltNames: [], caCertificateRefs: [], ancestors: [] },
      error: null,
    })
    act(() => root.render(<BackendTLSPolicyDetailBody contextName="staging" namespace="apps" name="backend" />))
    expect(container.textContent).toContain('Well-known CA certificatesSystem')
    expect(container.textContent).toContain('The backend certificate must match the validation hostname.')
    expect(container.textContent).toContain('No ancestor status reported yet.')
    expect(container.textContent).not.toContain('CA certificate references')
  })
})
