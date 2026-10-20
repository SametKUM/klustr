import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PolicyReportDetail } from '@/lib/api'
import type { DetailTab, SelectedResource } from '@/store/ui'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mocks = vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
  return {
    reports: {} as Record<string, PolicyReportDetail | null>,
    reportListeners: new Set<() => void>(),
    logsMounted: vi.fn(), logsStopped: vi.fn(), execMounted: vi.fn(), execStopped: vi.fn(),
    logRequests: vi.fn(),
    getHelmRelease: vi.fn().mockResolvedValue({ info: { revision: 1 }, revisions: [], chartName: 'repo/api' }),
  }
})

vi.mock('@/lib/api', () => ({ api: { getHelmRelease: mocks.getHelmRelease } }))
vi.mock('./useResourceManagers', async (importOriginal) => ({
  ...await importOriginal<typeof import('./useResourceManagers')>(),
  useResourceManagers: () => [],
}))
vi.mock('./useResourceDetail', () => ({
  useResourceDetail: () => ({ detail: { containers: [{ name: 'app' }], initContainers: [] }, error: null, loading: false }),
}))
// Like the real hook, a report that arrives later re-renders its subscriber.
vi.mock('@/features/kyverno/useResourcePolicyReport', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useResourcePolicyReport: (_context: string, _kind: string, _namespace: string, name: string) =>
      useSyncExternalStore(
        (listener) => {
          mocks.reportListeners.add(listener)
          return () => mocks.reportListeners.delete(listener)
        },
        () => mocks.reports[name] ?? null,
      ),
  }
})
vi.mock('@/features/kyverno/ResourcePolicyTab', () => ({
  PolicyTabLabel: () => <>Policy</>, ResourcePolicyTab: () => <div>Policy report</div>,
}))
vi.mock('@/features/pods/PodOverviewBody', () => ({ PodOverviewBody: () => <div>Pod overview</div> }))
vi.mock('@/features/configmaps/ConfigMapDetailBody', () => ({ ConfigMapDetailBody: () => <div>ConfigMap overview</div> }))
vi.mock('@/features/argocd/ApplicationResourcesTab', () => ({ ApplicationResourcesTab: () => <div>Application resources</div> }))
vi.mock('./ResourceYAMLTab', () => ({ ResourceYAMLTab: () => <div>YAML editor</div> }))
vi.mock('./EventsTab', () => ({ EventsTab: () => <div>Resource events</div> }))
vi.mock('@/features/portforward/PortForwardButton', () => ({ PortForwardButton: () => null }))
vi.mock('@/features/helm/HelmInstallDialog', () => ({ HelmInstallDialog: () => null }))
vi.mock('@/features/helm/HelmRollbackPickerDialog', () => ({ HelmRollbackPickerDialog: () => null }))
vi.mock('@/features/helm/HelmRollbackDialog', () => ({ HelmRollbackDialog: () => null }))
vi.mock('@/features/helm/HelmUninstallDialog', () => ({ HelmUninstallDialog: () => null }))
vi.mock('@/features/pods/PodLogsTab', () => ({
  PodLogsTab: (props: object) => <Session kind="logs" request={props} />,
}))
vi.mock('@/features/pods/PodExecTab', () => ({ PodExecTab: () => <Session kind="exec" /> }))

function Session({ kind, request }: { kind: 'logs' | 'exec'; request?: object }) {
  if (kind === 'logs') mocks.logRequests(request)
  useEffect(() => {
    mocks[kind === 'logs' ? 'logsMounted' : 'execMounted']()
    return mocks[kind === 'logs' ? 'logsStopped' : 'execStopped']
  }, [kind])
  return <div>{kind} session</div>
}

const { useUIStore } = await import('@/store/ui')
const { ResourceDetailPanel } = await import('./ResourceDetailPanel')
const snapshot = useUIStore.getState()
const pod = { kind: 'Pod', context: 'cluster-a', namespace: 'apps', name: 'api' }

function Inspector() {
  const resource = useUIStore((s) => s.selectedResource)
  return <ResourceDetailPanel contextName="cluster-a" resource={resource} />
}

describe('inspector tab requests', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.reports = {}
    useUIStore.setState({ ...snapshot, selectedContext: 'cluster-a', globalReadOnly: true })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const open = (resource: SelectedResource, tab?: DetailTab) => act(async () => {
    useUIStore.getState().openResource(resource, tab)
    root.render(<Inspector />)
  })
  const select = (label: string) => act(async () => {
    const tab = [...container.querySelectorAll('[role="tab"]')].find((el) => el.textContent === label)!
    tab.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
  })
  const active = () => container.querySelector('[role="tab"][aria-selected="true"]')?.textContent
  const report = (name: string, value: PolicyReportDetail | null) => act(async () => {
    mocks.reports[name] = value
    for (const listener of mocks.reportListeners) listener()
  })

  it.each(['logs', 'events', 'yaml'] as const)('honors another Pod %s request after a manual Overview selection', async (tab) => {
    await open(pod, tab)
    await select('Overview')
    expect(active()).toBe('Overview')
    await open({ ...pod }, tab)
    expect(active()).toBe(tab === 'yaml' ? 'YAML' : tab[0].toUpperCase() + tab.slice(1))
  })

  it.each([
    [{ ...pod, kind: 'ConfigMap' }, 'yaml', 'Overview', 'YAML'],
    [{ ...pod, kind: 'Application', gvr: { group: 'argoproj.io', version: 'v1alpha1', resource: 'applications' } }, 'yaml', 'Resources', 'YAML'],
    [{ ...pod, kind: 'HelmRelease' }, 'history', 'Overview', 'History'],
  ] as const)('honors repeated %s detail requests', async (resource, tab, manual, expected) => {
    await open(resource, tab)
    await select(manual)
    expect(active()).toBe(manual)
    await open({ ...resource }, tab)
    expect(active()).toBe(expected)
  })

  it('keeps visited log and exec sessions mounted during explicit navigation', async () => {
    await open(pod, 'logs')
    await open(pod, 'exec')
    await open(pod, 'events')
    await open(pod, 'logs')
    expect(active()).toBe('Logs')
    expect(mocks.logsMounted).toHaveBeenCalledOnce()
    expect(mocks.execMounted).toHaveBeenCalledOnce()
    expect(mocks.logsStopped).not.toHaveBeenCalled()
    expect(mocks.execStopped).not.toHaveBeenCalled()
  })

  it('forwards repeated same-container requests while preserving identity on passive row updates', async () => {
    const target = { ...pod, logContainer: 'app' }
    await open(target, 'logs')
    const request = mocks.logRequests.mock.lastCall![0].containerRequestId
    await open({ ...target }, 'logs')
    expect(mocks.logRequests.mock.lastCall![0]).toMatchObject({ initialContainer: 'app', containerRequestId: request + 1 })
    await act(async () => useUIStore.getState().setSelectedResource({ ...target }))
    expect(mocks.logRequests.mock.lastCall![0].containerRequestId).toBe(request + 1)
  })

  it('shows Overview when the next pod has no policy report and follows a delayed report', async () => {
    mocks.reports.api = {} as PolicyReportDetail
    await open(pod, 'policy')
    expect(active()).toBe('Policy')
    await act(async () => useUIStore.getState().setSelectedResource({ ...pod, name: 'no-report' }))
    expect(active()).toBe('Overview')
    expect(container.textContent).toContain('Pod overview')
    await report('no-report', {} as PolicyReportDetail)
    expect(active()).toBe('Policy')
    await report('no-report', null)
    expect(active()).toBe('Overview')
    await select('Logs')
    await report('no-report', {} as PolicyReportDetail)
    expect(active()).toBe('Logs')
  })

  it('keeps a retained Policy tab pending for other kinds until the report loads', async () => {
    const configMap = { ...pod, kind: 'ConfigMap', name: 'settings' }
    mocks.reports.settings = {} as PolicyReportDetail
    await open(configMap, 'policy')
    expect(active()).toBe('Policy')
    await act(async () => useUIStore.getState().setSelectedResource({ ...configMap, name: 'later' }))
    expect(active()).toBe('Overview')
    expect(container.textContent).toContain('ConfigMap overview')
    await report('later', {} as PolicyReportDetail)
    expect(active()).toBe('Policy')
    await select('YAML')
    await report('later', null)
    await report('later', {} as PolicyReportDetail)
    expect(active()).toBe('YAML')
  })

  it.each([pod, { ...pod, kind: 'ConfigMap' }])('keeps a $kind Policy tab pending across resources until a report arrives', async (resource) => {
    mocks.reports.api = {} as PolicyReportDetail
    await open(resource, 'policy')
    await act(async () => useUIStore.getState().setSelectedResource({ ...resource, name: 'b' }))
    expect(active()).toBe('Overview')
    await act(async () => useUIStore.getState().setSelectedResource({ ...resource, name: 'c' }))
    await report('c', {} as PolicyReportDetail)
    expect(active()).toBe('Policy')
  })

  it.each([pod, { ...pod, kind: 'ConfigMap' }])('lets a $kind Overview click replace a pending Policy tab', async (resource) => {
    mocks.reports.api = {} as PolicyReportDetail
    await open(resource, 'policy')
    await act(async () => useUIStore.getState().setSelectedResource({ ...resource, name: 'later' }))
    expect(active()).toBe('Overview')
    await act(async () =>
      [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find((el) => el.textContent === 'Overview')!.click(),
    )
    await report('later', {} as PolicyReportDetail)
    expect(active()).toBe('Overview')
  })
})
