import { act, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({
  installHelmRelease: vi.fn(),
  upgradeHelmRelease: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    installHelmRelease: mocks.installHelmRelease,
    upgradeHelmRelease: mocks.upgradeHelmRelease,
  },
}))

vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: { selectedContext: string }) => unknown) =>
    selector({ selectedContext: 'test-context' }),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@monaco-editor/react', () => ({
  Editor: ({ value }: { value: string }) => <pre data-testid="values-editor">{value}</pre>,
}))

vi.mock('@/features/_shared/Copyable', () => ({
  CopyButton: ({ value, ariaLabel }: { value: string; ariaLabel: string }) => (
    <button type="button" aria-label={ariaLabel} data-copy-value={value}>
      Copy
    </button>
  ),
}))

vi.mock('@/features/_shared/useThemeMode', () => ({
  useThemeMode: () => 'light',
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
  },
}))

import { HelmInstallDialog } from './HelmInstallDialog'

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  )
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return match
}

describe('HelmInstallDialog', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.installHelmRelease.mockReset()
    mocks.upgradeHelmRelease.mockReset()
    mocks.toastError.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('keeps a dry-run failure visible with a summary, full response, and copy action', async () => {
    const message =
      'validation failed: {"kind":"Deployment","metadata":{"name":"api"}} replicas are invalid'
    mocks.installHelmRelease.mockRejectedValueOnce(new Error(message))
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HelmInstallDialog
            open
            onOpenChange={vi.fn()}
            mode="install"
            initialName="api"
            initialChartRef="example/api"
          />
        </QueryClientProvider>,
      )
    })

    await act(async () => {
      button(container, 'Dry-run').click()
    })

    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Dry-run failed')
    expect(alert?.textContent).toContain('validation failed: {…} replicas are invalid')
    expect(alert?.textContent).toContain(message)
    expect(container.querySelector('summary')?.textContent).toBe('Full server response')
    expect(container.querySelector('[aria-label="Copy Helm error"]')?.getAttribute('data-copy-value')).toBe(
      `Error: ${message}`,
    )
  })

  it('clears the previous inline error when a new attempt starts', async () => {
    let finishRetry!: (result: { manifest: string; notes: string }) => void
    const retry = new Promise<{ manifest: string; notes: string }>((resolve) => {
      finishRetry = resolve
    })
    mocks.installHelmRelease
      .mockRejectedValueOnce(new Error('first failure'))
      .mockReturnValueOnce(retry)
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HelmInstallDialog
            open
            onOpenChange={vi.fn()}
            mode="install"
            initialName="api"
            initialChartRef="example/api"
          />
        </QueryClientProvider>,
      )
    })

    await act(async () => {
      button(container, 'Dry-run').click()
    })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()

    act(() => button(container, 'Dry-run').click())

    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('Rendering…')
    await act(async () => {
      finishRetry({ manifest: 'kind: Deployment\n', notes: '' })
      await retry
    })
  })
})
