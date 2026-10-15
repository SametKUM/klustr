import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({ deleteResource: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks }))
vi.mock('@/store/ui', () => ({
  useUIStore: Object.assign((selector: (state: object) => unknown) => selector({ setSelectedResource: vi.fn() }), {
    getState: () => ({ selectedResource: null }),
  }),
  sameResource: vi.fn(),
}))
vi.mock('./ContextBadge', () => ({ ContextBadge: () => null }))
import { DeleteResourceDialog } from './DeleteResourceButton'

beforeEach(() => mocks.deleteResource.mockReset().mockResolvedValue(undefined))

it.each([
  ['HelmRelease', { group: 'helm.toolkit.fluxcd.io', version: 'v2', resource: 'helmreleases' }, 'cr:helm.toolkit.fluxcd.io/helmreleases'],
  ['Service', { group: 'serving.knative.dev', version: 'v1', resource: 'services' }, 'cr:serving.knative.dev/services'],
  ['Service', undefined, 'Service'],
] as const)('deletes %s using its exact API group and resource identity', async (kind, gvr, expectedKind) => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  try {
    await act(async () => root.render(
      <QueryClientProvider client={client}>
        <DeleteResourceDialog contextName="row-context" resource={{ kind, namespace: 'apps', name: 'api', gvr }} open onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    ))
    const input = document.querySelector('input')
    if (input) await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'DELETE')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent === 'Delete')!
    await act(async () => button.click())
    expect(mocks.deleteResource).toHaveBeenCalledExactlyOnceWith('row-context', expectedKind, 'apps', 'api')
  } finally {
    act(() => root.unmount())
    client.clear()
    container.remove()
  }
})
