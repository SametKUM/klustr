import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

type ChangeHandler = (
  contextName: string,
  delta?: {
    upserts: unknown[]
    removed: string[]
    gen: number
    reset?: boolean
  },
) => void

const mocks = vi.hoisted(() => {
  const eventState: { handler: ChangeHandler | null } = { handler: null }
  return {
    setDetailDirty: vi.fn(),
    storeState: { detailDiscardRequest: 0 },
    eventState,
    getResourceYAML: vi.fn(),
    getCustomResourceYAML: vi.fn(),
    onKubeChange: vi.fn((_kind: string, handler: ChangeHandler) => {
      eventState.handler = handler
      return vi.fn()
    }),
  }
})

vi.mock('@/lib/api', () => ({
  api: {
    getResourceYAML: mocks.getResourceYAML,
    getCustomResourceYAML: mocks.getCustomResourceYAML,
    dryRunApplyResourceYAML: vi.fn(),
    applyResourceYAML: vi.fn(),
  },
}))

vi.mock('@/lib/events', () => ({
  deltaTouches: vi.fn(() => true),
  onKubeChange: mocks.onKubeChange,
}))

vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: object) => unknown) =>
    selector({ globalReadOnly: false, setDetailDirty: mocks.setDetailDirty, ...mocks.storeState }),
}))

vi.mock('@/lib/monaco', () => ({
  Editor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <button data-testid="editor" onClick={() => onChange(`${value}# edited\n`)}>{value}</button>,
  DiffEditor: () => null,
}))

vi.mock('./Copyable', () => ({
  CopyButton: ({ value }: { value: string }) => <output data-testid="copy-value">{value}</output>,
}))

vi.mock('./useThemeMode', () => ({
  useThemeMode: () => 'light',
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

import { ResourceYAMLTab } from './ResourceYAMLTab'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  )
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return match
}

describe('ResourceYAMLTab', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.eventState.handler = null
    mocks.getResourceYAML.mockReset()
    mocks.getCustomResourceYAML.mockReset()
    mocks.onKubeChange.mockClear()
    mocks.setDetailDirty.mockClear()
    mocks.storeState.detailDiscardRequest = 0
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('warns about a live change and refreshes the displayed YAML on demand', async () => {
    const refresh = deferred<string>()
    mocks.getResourceYAML
      .mockResolvedValueOnce('metadata:\n  resourceVersion: "1"\n')
      .mockReturnValueOnce(refresh.promise)

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ResourceYAMLTab
            contextName="test-context"
            kind="Pod"
            namespace="default"
            name="api-pod"
          />
        </QueryClientProvider>,
      )
    })

    expect(container.querySelector('[data-testid="copy-value"]')?.textContent).toContain(
      'resourceVersion: "1"',
    )
    expect(mocks.onKubeChange).toHaveBeenCalledWith('Pod', expect.any(Function))

    act(() => {
      mocks.eventState.handler?.('test-context', {
        upserts: [{ namespace: 'default', name: 'api-pod' }],
        removed: [],
        gen: 2,
      })
    })

    expect(container.textContent).toContain('Resource changed in the cluster.')
    expect(button(container, 'Edit').disabled).toBe(true)

    act(() => button(container, 'Refresh').click())
    expect(container.textContent).toContain('Refreshing…')

    await act(async () => {
      refresh.resolve('metadata:\n  resourceVersion: "2"\n')
      await refresh.promise
    })

    expect(container.querySelector('[data-testid="copy-value"]')?.textContent).toContain(
      'resourceVersion: "2"',
    )
    expect(container.textContent).not.toContain('Resource changed in the cluster.')
    expect(button(container, 'Edit').disabled).toBe(false)
  })

  it('keeps the loaded YAML visible when a refresh fails', async () => {
    mocks.getResourceYAML
      .mockResolvedValueOnce('metadata:\n  resourceVersion: "1"\n')
      .mockRejectedValueOnce(new Error('temporary failure'))

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ResourceYAMLTab
            contextName="test-context"
            kind="Pod"
            namespace="default"
            name="api-pod"
          />
        </QueryClientProvider>,
      )
    })

    await act(async () => {
      button(container, 'Refresh').click()
    })

    expect(container.textContent).toContain('Refresh failed: Error: temporary failure')
    expect(container.querySelector('[data-testid="copy-value"]')?.textContent).toContain(
      'resourceVersion: "1"',
    )
  })

  it('guards edited drafts and clears the guard when editing is cancelled', async () => {
    mocks.getResourceYAML.mockResolvedValue('kind: Pod\n')
    const queryClient = new QueryClient()
    await act(async () => root.render(<QueryClientProvider client={queryClient}>
      <ResourceYAMLTab contextName="test-context" kind="Pod" namespace="default" name="api" />
    </QueryClientProvider>))
    await act(async () => button(container, 'Edit').click())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="editor"]')!.click())
    expect(mocks.setDetailDirty).toHaveBeenLastCalledWith(true)
    await act(async () => button(container, 'Cancel').click())
    expect(mocks.setDetailDirty).toHaveBeenLastCalledWith(false)
  })

  it('drops the draft on a confirmed discard even when it stays mounted', async () => {
    mocks.getResourceYAML.mockResolvedValue('kind: Pod\n')
    const queryClient = new QueryClient()
    const tab = () => <QueryClientProvider client={queryClient}>
      <ResourceYAMLTab contextName="test-context" kind="Pod" namespace="default" name="api" />
    </QueryClientProvider>
    await act(async () => root.render(tab()))
    await act(async () => button(container, 'Edit').click())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="editor"]')!.click())
    expect(mocks.setDetailDirty).toHaveBeenLastCalledWith(true)
    mocks.storeState.detailDiscardRequest = 1
    await act(async () => root.render(tab()))
    expect(mocks.setDetailDirty).toHaveBeenLastCalledWith(false)
    expect(container.textContent).not.toContain('# edited')
    expect(button(container, 'Edit')).toBeTruthy()
  })
})
