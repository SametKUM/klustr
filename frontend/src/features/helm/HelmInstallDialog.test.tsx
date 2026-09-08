import { act, useState, type ReactNode } from 'react'
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
            contextName="test-context"
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

  it.each(['install', 'upgrade'] as const)(
    'targets the explicit context for %s dry-run and apply when another context is selected',
    async (mode) => {
      const operation = mode === 'install' ? mocks.installHelmRelease : mocks.upgradeHelmRelease
      operation.mockResolvedValue({ manifest: 'kind: Deployment\n', notes: '' })
      const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
      })

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <HelmInstallDialog
              contextName="release-context"
              open
              onOpenChange={vi.fn()}
              mode={mode}
              initialName="api"
              initialNamespace="apps"
              initialChartRef="example/api"
            />
          </QueryClientProvider>,
        )
      })

      await act(async () => button(container, 'Dry-run').click())
      expect(operation).toHaveBeenNthCalledWith(1, expect.objectContaining({
        contextName: 'release-context',
        namespace: 'apps',
        releaseName: 'api',
        dryRun: true,
      }))

      await act(async () => button(container, mode === 'install' ? 'Install' : 'Upgrade').click())
      expect(operation).toHaveBeenNthCalledWith(2, expect.objectContaining({
        contextName: 'release-context',
        namespace: 'apps',
        releaseName: 'api',
        dryRun: false,
      }))
    },
  )

  it.each(['install', 'upgrade'] as const)(
    'disables %s without a target context instead of using the selected context',
    async (mode) => {
      const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
      })

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <HelmInstallDialog
              contextName={null}
              open
              onOpenChange={vi.fn()}
              mode={mode}
              initialName="api"
              initialChartRef="example/api"
            />
          </QueryClientProvider>,
        )
      })

      const dryRunButton = button(container, 'Dry-run')
      const applyButton = button(container, mode === 'install' ? 'Install' : 'Upgrade')
      expect(dryRunButton.disabled).toBe(true)
      expect(applyButton.disabled).toBe(true)
      await act(async () => {
        dryRunButton.click()
        applyButton.click()
      })
      expect(mocks.installHelmRelease).not.toHaveBeenCalled()
      expect(mocks.upgradeHelmRelease).not.toHaveBeenCalled()
    },
  )

  it('requires an explicit install target in aggregated mode and discards the old preview when it changes', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    function Install() {
      const [context, setContext] = useState<string | null>(null)
      return <HelmInstallDialog contextName={context} availableContexts={['cluster-a', 'cluster-b']}
        onContextChange={setContext} open onOpenChange={vi.fn()} mode="install"
        initialName="api" initialChartRef="example/api" />
    }
    await act(async () => root.render(<QueryClientProvider client={queryClient}><Install /></QueryClientProvider>))
    expect(button(container, 'Install').disabled).toBe(true)
    expect(container.textContent).toContain('Select a target context to continue.')
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Target context"]')!
    await act(async () => {
      select.value = 'cluster-b'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    let finish!: (result: { manifest: string; notes: string }) => void
    mocks.installHelmRelease.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    await act(async () => {
      button(container, 'Dry-run').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(select.disabled).toBe(true)
    expect(mocks.installHelmRelease).toHaveBeenLastCalledWith(expect.objectContaining({ contextName: 'cluster-b', dryRun: true }))
    await act(async () => finish({ manifest: 'preview-for-cluster-b', notes: '' }))
    expect(container.textContent).toContain('preview-for-cluster-b')
    await act(async () => {
      select.value = 'cluster-a'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.textContent).not.toContain('preview-for-cluster-b')
    expect(container.textContent).toContain('No preview yet')
    mocks.installHelmRelease.mockResolvedValueOnce(undefined)
    await act(async () => button(container, 'Install').click())
    expect(mocks.installHelmRelease).toHaveBeenLastCalledWith(expect.objectContaining({ contextName: 'cluster-a', dryRun: false }))
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
            contextName="test-context"
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
