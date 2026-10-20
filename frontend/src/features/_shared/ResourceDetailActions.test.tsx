import { act, createContext, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { SelectedResource } from '@/store/ui'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})
vi.mock('@/lib/api', () => ({ api: {} }))
vi.mock('./useResourceManagers', () => ({
  useResourceManagers: () => [],
  ResourceManagersContext: createContext([]),
}))
vi.mock('@/features/kyverno/useResourcePolicyReport', () => ({ useResourcePolicyReport: () => null }))
vi.mock('@/features/configmaps/ConfigMapDetailBody', () => ({ ConfigMapDetailBody: () => null }))
vi.mock('./ContextBadge', () => ({ ContextBadge: () => null }))
vi.mock('./Copyable', () => ({ CopyButton: () => null, Copyable: () => null }))
vi.mock('./DeleteResourceButton', () => ({
  DeleteResourceButton: ({ resource }: { resource: SelectedResource }) => {
    const [open, setOpen] = useState(false)
    return <button onClick={() => setOpen(true)}>{open ? `Confirm delete ${resource.name}` : 'Delete'}</button>
  },
}))

const { ResourceDetailPanel } = await import('./ResourceDetailPanel')

it('closes an open header confirmation instead of retargeting it to the next resource', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const configMap = (name: string): SelectedResource =>
    ({ kind: 'ConfigMap', namespace: 'apps', name, context: 'cluster-a' })
  try {
    await act(async () => root.render(<ResourceDetailPanel contextName="cluster-a" resource={configMap('first')} />))
    const remove = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Delete')!
    await act(async () => remove.click())
    expect(container.textContent).toContain('Confirm delete first')
    await act(async () => root.render(<ResourceDetailPanel contextName="cluster-a" resource={configMap('second')} />))
    expect(container.textContent).not.toContain('Confirm delete')
  } finally {
    act(() => root.unmount())
  }
})
