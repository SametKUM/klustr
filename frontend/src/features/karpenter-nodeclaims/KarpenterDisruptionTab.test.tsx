import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { KarpenterDisruption } from '@/lib/api'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { getKarpenterDisruption: mocks.get } }))
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
})
const { KarpenterDisruptionTab } = await import('./KarpenterDisruptionTab')

function report(over: Partial<KarpenterDisruption>): KarpenterDisruption {
  return {
    nodeName: 'ip-10-0-1-5',
    nodeClaim: 'general-x7k2p',
    nodePool: 'general',
    managed: true,
    capacityType: 'spot',
    consolidationPolicy: 'WhenEmptyOrUnderutilized',
    consolidateAfter: '1m',
    expireAfter: '720h',
    lastPodEventTime: '',
    disrupting: false,
    disruptionReason: '',
    blockers: [],
    budgets: [{ nodes: '10%', reasons: [], schedule: '', duration: '', active: true, allowed: 1, error: '' }],
    conditions: [],
    events: [],
    pods: [],
    ...over,
  } as KarpenterDisruption
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(() => act(() => root.unmount()))

async function render(nodeName = 'ip-10-0-1-5', nodeClaimName = '') {
  await act(async () =>
    root.render(<KarpenterDisruptionTab contextName="dev" nodeName={nodeName} nodeClaimName={nodeClaimName} />),
  )
}

it('lists what blocks the node and the budget state', async () => {
  mocks.get.mockResolvedValue(
    report({
      blockers: [
        { kind: 'pdb', message: 'PDB shop/db allows no disruptions, so pod db-0 cannot be evicted.', objectKind: 'PodDisruptionBudget', namespace: 'shop', name: 'db' },
      ],
      budgets: [{ nodes: '0', reasons: ['Drifted'], schedule: '0 9 * * mon-fri', duration: '8h', active: true, allowed: 0, error: '' }],
    }),
  )
  await render()
  expect(mocks.get).toHaveBeenCalledWith('dev', 'ip-10-0-1-5', '')
  expect(container.textContent).toContain('Karpenter will not voluntarily disrupt this node.')
  expect(container.textContent).toContain('PDB shop/db allows no disruptions')
  expect(container.textContent).toContain('Active, allows 0')
})

it('says when nothing blocks the node', async () => {
  mocks.get.mockResolvedValue(report({}))
  await render('', 'general-x7k2p')
  expect(mocks.get).toHaveBeenCalledWith('dev', '', 'general-x7k2p')
  expect(container.textContent).toContain('Nothing blocks Karpenter from disrupting this node.')
})

it('says when Karpenter is already disrupting the node', async () => {
  mocks.get.mockResolvedValue(report({ disrupting: true, disruptionReason: 'Underutilized' }))
  await render()
  expect(container.textContent).toContain('Karpenter is disrupting this node (Underutilized).')
})

it('explains a node Karpenter does not manage', async () => {
  mocks.get.mockResolvedValue(report({ managed: false }))
  await render()
  expect(container.textContent).toContain('This node is not managed by Karpenter.')
})
