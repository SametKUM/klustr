import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManifestKind } from '@/lib/api'
import { ResourceKindPicker } from './ResourceKindPicker'
import { filterResourceKinds } from './resourceKindSearch'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mapping = (kind: string, resource: string, apiVersion = 'apps/v1'): ManifestKind => ({
  kind, resource, apiVersion, namespaced: true,
})
const deployment = mapping('Deployment', 'deployments')
const catalog = [
  mapping('RolePolicyAttachment', 'rolepolicyattachments', 'iam.aws.m.upbound.io/v1beta1'),
  mapping('CiliumClusterwideNetworkPolicy', 'ciliumclusterwidenetworkpolicies', 'cilium.io/v2'),
  mapping('DeploymentConfig', 'deploymentconfigs', 'apps.openshift.io/v1'),
  deployment,
  { ...deployment },
  mapping('Deployment', 'deployments', 'apps/v1beta1'),
  mapping('ConfigMap', 'configmaps', 'v1'),
]

describe('resource type search', () => {
  it('ranks exact kinds first and excludes unrelated fuzzy matches', () => {
    expect(filterResourceKinds(catalog, 'deployment').map((item) => item.kind)).toEqual([
      'Deployment', 'Deployment', 'DeploymentConfig',
    ])
  })

  it('matches plural names, partial names and combined API/version terms', () => {
    expect(filterResourceKinds(catalog, '  DEPLOYMENTS apps/v1  ')).toEqual([
      deployment, catalog[5],
    ])
    expect(filterResourceKinds(catalog, 'policy')).toEqual(catalog.slice(0, 2))
    expect(filterResourceKinds(catalog, 'deployment v1beta1')).toEqual([catalog[5]])
    expect(filterResourceKinds(catalog, 'no-such-kind')).toEqual([])
  })

  it('deduplicates endpoints while preserving distinct versions, groups and discovery order', () => {
    const otherGroup = mapping('Deployment', 'deployments', 'example.com/v1')
    const otherResource = mapping('Deployment', 'otherdeployments')
    const resources = [...catalog, otherGroup, otherResource]
    expect(filterResourceKinds(resources, '  ')).toEqual([
      ...catalog.slice(0, 4), ...catalog.slice(5), otherGroup, otherResource,
    ])
    expect(resources).toHaveLength(9)
  })
})

describe('resource type picker', () => {
  let container: HTMLDivElement
  let root: Root
  const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  const onSelect = vi.fn()
  const options = () => [...container.querySelectorAll('[role="option"]')]
  async function search(value: string) {
    const input = container.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<ResourceKindPicker resources={catalog} onSelect={onSelect} />))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (scrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoView)
    else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  it('updates results without duplicate rows and selects the exact kind by keyboard', async () => {
    for (const query of ['dep', 'deployment', 'policy', 'deployment']) await search(query)
    expect(options().map((item) => item.textContent)).toEqual([
      'Deploymentapps/v1', 'Deploymentapps/v1beta1', 'DeploymentConfigapps.openshift.io/v1',
    ])
    await act(async () => {
      container.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true,
      }))
    })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(deployment)
  })

  it('shows an empty state and restores the catalog when search is cleared', async () => {
    await search('not-a-real-kind')
    expect(options()).toHaveLength(0)
    expect(container.textContent).toContain('No resource types found.')
    await search('')
    expect(options()).toHaveLength(6)
    expect(container.textContent).not.toContain('No resource types found.')
  })

  it('selects the displayed API version and removes stale types when the catalog changes', async () => {
    await search('deployment v1beta1')
    await act(async () => (options()[0] as HTMLElement).click())
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(catalog[5])
    await act(async () => root.render(<ResourceKindPicker resources={[catalog[6]]} onSelect={onSelect} />))
    expect(options()).toHaveLength(0)
    await search('configmap')
    expect(options()[0].textContent).toBe('ConfigMapv1')
  })
})
