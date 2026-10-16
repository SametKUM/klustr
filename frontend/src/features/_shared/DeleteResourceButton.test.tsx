import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SelectedResource } from '@/store/ui'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({ del: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { deleteResource: mocks.del } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
})
const { DeleteResourceDialog } = await import('./DeleteResourceButton')

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks()
  mocks.del.mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function confirmDelete(resource: SelectedResource) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <DeleteResourceDialog contextName="dev" resource={resource} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    ),
  )
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!
  await act(async () => button.click())
}

it('deletes a CR by group and resource, not by a kind a built-in shares', async () => {
  await confirmDelete({
    kind: 'Gateway',
    namespace: 'istio-system',
    name: 'public',
    gvr: { group: 'networking.istio.io', version: 'v1', resource: 'gateways' },
  })
  expect(mocks.del).toHaveBeenCalledWith('dev', 'cr:networking.istio.io/gateways', 'istio-system', 'public')
})

it('deletes a built-in by kind', async () => {
  await confirmDelete({ kind: 'ConfigMap', namespace: 'shop', name: 'settings' })
  expect(mocks.del).toHaveBeenCalledWith('dev', 'ConfigMap', 'shop', 'settings')
})
