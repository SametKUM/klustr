import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { CellContext } from '@tanstack/react-table'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CRDInfo, FluxImageUpdateAutomationInfo } from '@/lib/api'
import { useCRDStore } from '@/store/crds'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({
  ensure: vi.fn(),
  getSource: vi.fn(),
  open: vi.fn(),
  detail: {
    name: 'updates',
    namespace: 'apps',
    sourceName: 'fleet',
    sourceKind: 'GitRepository',
    sourceNamespace: 'flux-system',
    ready: 'True',
    suspended: false,
    status: '',
    interval: '1m',
    createdAt: '2026-10-11T12:00:00Z',
    conditions: [],
  },
}))
vi.mock('@/lib/api', () => ({
  api: { ensureCustomResourceWatch: mocks.ensure, getFluxGitRepository: mocks.getSource },
}))
vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (state: object) => unknown) => selector({ openResource: mocks.open }),
}))
vi.mock('@/features/_shared/useResourceDetail', () => ({
  useResourceDetail: () => ({ detail: mocks.detail, error: null }),
}))
vi.mock('@/features/_shared/CustomResourceTable', () => ({
  CustomResourceTable: ({
    columns,
  }: {
    columns: {
      accessorKey?: string
      cell?: (context: CellContext<FluxImageUpdateAutomationInfo, unknown>) => ReactNode
    }[]
  }) => {
    const source = columns.find((column) => column.accessorKey === 'sourceName')!
    return source.cell!({
      row: { original: { ...mocks.detail, __klustrCtx: 'source-context' } },
      getValue: () => mocks.detail.sourceName,
    } as unknown as CellContext<FluxImageUpdateAutomationInfo, unknown>)
  },
}))
import { FluxImageUpdateAutomationDetailBody } from './FluxImageDetailBodies'
import { FluxImageUpdateAutomationsView } from './FluxImageViews'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks()
  mocks.ensure.mockResolvedValue(undefined)
  mocks.getSource.mockResolvedValue({ suspended: true })
  useCRDStore.setState({
    byContext: {
      'source-context': [
        {
          group: 'source.toolkit.fluxcd.io',
          resource: 'gitrepositories',
          kind: 'GitRepository',
          version: 'v1',
        } as CRDInfo,
      ],
    },
  })
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  useCRDStore.setState({ byContext: {} })
})

it.each(['list', 'detail'])(
  'opens a cross-namespace Git source from the automation %s',
  async (surface) => {
    await act(async () =>
      root.render(
        surface === 'list' ? (
          <FluxImageUpdateAutomationsView />
        ) : (
          <FluxImageUpdateAutomationDetailBody
            contextName="source-context"
            namespace="apps"
            name="updates"
          />
        ),
      ),
    )
    expect(container.textContent).toContain('flux-system')
    await act(async () => container.querySelector('button')!.click())
    expect(mocks.getSource).toHaveBeenCalledWith('source-context', 'flux-system', 'fleet')
    expect(mocks.open).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'FluxGitRepository',
        context: 'source-context',
        namespace: 'flux-system',
        name: 'fleet',
        suspended: true,
      }),
    )
  },
)
