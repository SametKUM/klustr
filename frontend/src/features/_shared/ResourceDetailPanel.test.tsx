import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({
  getHelmRelease: vi.fn().mockResolvedValue({ info: { revision: 1 }, revisions: [], chartName: 'repo/api' }),
  dialog: vi.fn(),
  yaml: vi.fn(),
  deleteButton: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ api: { getHelmRelease: mocks.getHelmRelease } }))
vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: object) => unknown) => selector({
    selectedContext: 'another-cluster', resourceNavStack: [], globalReadOnly: false,
  }),
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('./Copyable', () => ({ CopyButton: () => null, Copyable: () => null }))
vi.mock('./ContextBadge', () => ({ ContextBadge: () => null }))
vi.mock('./ResourceYAMLTab', () => ({
  ResourceYAMLTab: (props: object) => { mocks.yaml(props); return <div>Custom resource YAML</div> },
}))
vi.mock('./DeleteResourceButton', () => ({
  DeleteResourceButton: (props: object) => { mocks.deleteButton(props); return <button>Delete resource</button> },
}))
vi.mock('@/features/helm/HelmReleaseDetailBody', () => ({
  HelmReleaseDetailBody: ({ onRequestUpgrade }: { onRequestUpgrade: () => void }) =>
    <button onClick={onRequestUpgrade}>Upgrade release</button>,
}))
vi.mock('@/features/helm/HelmInstallDialog', () => ({
  HelmInstallDialog: (props: object) => { mocks.dialog(props); return null },
}))
vi.mock('@/features/helm/HelmRollbackPickerDialog', () => ({ HelmRollbackPickerDialog: () => null }))
vi.mock('@/features/helm/HelmUninstallDialog', () => ({ HelmUninstallDialog: () => null }))

import { ResourceDetailPanel } from './ResourceDetailPanel'

beforeEach(() => vi.clearAllMocks())

it.each(['HelmRelease', 'Pod', 'Deployment', 'Node'] as const)('dispatches a custom %s by GVR without Helm or built-in actions', async (kind) => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const gvr = { group: kind === 'HelmRelease' ? 'helm.toolkit.fluxcd.io' : 'example.com', version: 'v2', resource: `${kind.toLowerCase()}s` }
  const resource = { kind, name: 'api', namespace: 'apps', context: 'release-cluster', gvr }
  try {
    await act(async () => root.render(<ResourceDetailPanel contextName="release-cluster" resource={resource} />))
    expect(container.textContent).toContain('Custom resource YAML')
    expect(container.textContent).not.toMatch(/Upgrade release|Scale|Restart|Pause|Cordon|Port.forward|Resize/)
    expect(mocks.getHelmRelease).not.toHaveBeenCalled()
    expect(mocks.yaml).toHaveBeenCalledWith(expect.objectContaining({ contextName: 'release-cluster', kind, gvr }))
    expect(mocks.deleteButton).toHaveBeenCalledWith({ contextName: 'release-cluster', resource })
  } finally {
    act(() => root.unmount())
  }
})

it('passes the release source context through the detail panel into the upgrade dialog', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => root.render(<ResourceDetailPanel contextName="release-cluster"
      resource={{ kind: 'HelmRelease', name: 'api', namespace: 'apps', context: 'release-cluster' }} />))
    expect(mocks.getHelmRelease).toHaveBeenCalledWith('release-cluster', 'apps', 'api')
    await act(async () => container.querySelector('button')!.click())
    expect(mocks.dialog).toHaveBeenLastCalledWith(expect.objectContaining({
      open: true, mode: 'upgrade', contextName: 'release-cluster', initialNamespace: 'apps', initialName: 'api',
    }))
  } finally {
    act(() => root.unmount())
  }
})
