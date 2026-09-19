import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TCPRouteDetail } from '@/lib/api'
import { kube } from '@/lib/wails/wailsjs/go/models'
import { L4RouteOverview } from './L4RouteOverview'

const { openResource } = vi.hoisted(() => ({ openResource: vi.fn() }))
vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: { openResource: typeof openResource }) => unknown) => selector({ openResource }),
}))

const parent = {
  group: 'gateway.networking.k8s.io', kind: 'Gateway', namespace: 'infra',
  name: 'edge', sectionName: 'tls', port: 443,
}

function route(): TCPRouteDetail {
  return kube.TCPRouteDetail.createFrom({
    name: 'db', namespace: 'apps', uid: 'route-uid', createdAt: '2026-09-20T00:00:00Z',
    parents: [parent],
    rules: [{ name: 'database', backends: [
      { group: '', kind: 'Service', namespace: 'backend', name: 'db-active', port: 5432, weight: 1 },
      { group: '', kind: 'Service', namespace: '', name: 'db-disabled', port: 5432, weight: 0 },
      { group: 'custom.io', kind: 'Service', namespace: '', name: 'custom', port: 0, weight: 1 },
    ] }],
    status: [{ parent, controller: 'example.com/controller', conditions: [
      { type: 'ResolvedRefs', status: 'False', reason: 'RefNotPermitted', message: 'ReferenceGrant is missing.' },
    ] }],
    labels: {}, annotations: {},
  })
}

describe('L4RouteOverview', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    openResource.mockReset()
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('renders zero weights, unspecified ports, attachment sections and actionable condition messages', () => {
    act(() => root.render(<L4RouteOverview detail={route()} kind="TCPRoute" contextName="staging" />))
    const rows = [...container.querySelectorAll('tr')]
    const disabled = rows.find((row) => row.textContent?.includes('db-disabled'))!
    expect(disabled.lastElementChild?.textContent).toBe('0')
    const custom = rows.find((row) => row.textContent?.includes('custom.io'))!
    expect(custom.children[2].textContent).toBe('—')
    expect(custom.querySelector('button[title^="Open"]')).toBeNull()
    expect(container.textContent).toContain('RefNotPermitted')
    expect(container.textContent).toContain('ReferenceGrant is missing.')
    expect(container.textContent).toContain('example.com/controller')
    expect(container.textContent).toContain('tls')
    expect(container.textContent).not.toContain('SNI hostnames')
  })

  it('opens related resources in their source context and explicit namespace', () => {
    act(() => root.render(<L4RouteOverview detail={route()} kind="TCPRoute" contextName="staging" />))
    const backend = container.querySelector<HTMLButtonElement>('button[title="Open Service backend/db-active"]')!
    act(() => backend.click())
    expect(openResource).toHaveBeenCalledWith({ kind: 'Service', namespace: 'backend', name: 'db-active', context: 'staging' })
    const gateway = container.querySelector<HTMLButtonElement>('button[title="Open Gateway infra/edge"]')!
    act(() => gateway.click())
    expect(openResource).toHaveBeenLastCalledWith({ kind: 'Gateway', namespace: 'infra', name: 'edge', context: 'staging' })
  })

  it('shows TLS SNI hostnames and explicitly reports missing controller status', () => {
    const detail = kube.TLSRouteDetail.createFrom({ ...route(), hostnames: ['*.example.com'], status: [] })
    act(() => root.render(<L4RouteOverview detail={detail} kind="TLSRoute" contextName="staging" />))
    expect(container.textContent).toContain('SNI hostnames')
    expect(container.textContent).toContain('*.example.com')
    expect(container.textContent).toContain('No parent status reported yet.')
  })
})
