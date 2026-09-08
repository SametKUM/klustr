import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => ({
  getHelmRelease: vi.fn().mockResolvedValue({ info: { revision: 1 }, revisions: [], chartName: 'repo/api' }),
  dialog: vi.fn(),
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
