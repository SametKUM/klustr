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
    blocked: [],
    incomplete: [],
    budgets: [{ nodes: '10%', reasons: [], schedule: '', duration: '', active: true, allowed: 1, remaining: 1, error: '' }],
    poolDisrupting: 0,
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

const ALL = ['Empty', 'Underutilized', 'Drifted']

function blocker(message: string, reasons: string[], until = ''): KarpenterDisruption['blockers'][number] {
  return { kind: 'state', message, reasons, until, objectKind: '', namespace: '', name: '' }
}

it('lists what blocks the node and the budget state', async () => {
  mocks.get.mockResolvedValue(
    report({
      blockers: [
        {
          kind: 'pdb',
          message: 'PDB shop/db allows no disruptions, so pod db-0 cannot be evicted.',
          reasons: ALL,
          until: '',
          objectKind: 'PodDisruptionBudget',
          namespace: 'shop',
          name: 'db',
        },
      ],
      blocked: ALL,
      budgets: [
        { nodes: '0', reasons: ['Drifted'], schedule: '0 9 * * mon-fri', duration: '8h', active: true, allowed: 0, remaining: 0, error: '' },
        { nodes: '2', reasons: [], schedule: '', duration: '', active: true, allowed: 2, remaining: 1, error: '' },
      ],
      poolDisrupting: 1,
    }),
  )
  await render()
  expect(mocks.get).toHaveBeenCalledWith('dev', 'ip-10-0-1-5', '')
  expect(container.textContent).toContain('Karpenter will not voluntarily disrupt this node.')
  expect(container.textContent).toContain('PDB shop/db allows no disruptions')
  expect(container.textContent).toContain('Active, allows 0')
  expect(container.textContent).toContain('Active, allows 2, 1 left')
  expect(container.textContent).toContain("1 of the pool's nodes are NotReady or already being disrupted")
})

it('scopes the verdict to consolidation when drift is still possible', async () => {
  mocks.get.mockResolvedValue(
    report({
      blockers: [
        blocker(
          'consolidateAfter (10m) has not passed since pods last changed on the node, so Karpenter does not consolidate the node yet.',
          ['Empty', 'Underutilized'],
          new Date(Date.now() + 5 * 60_000).toISOString(),
        ),
      ],
      blocked: ['Empty', 'Underutilized'],
    }),
  )
  await render()
  expect(container.textContent).toContain(
    'Karpenter will not consolidate this node. It can still replace it when it drifts.',
  )
  expect(container.textContent).not.toContain('voluntarily')
  expect(container.textContent).toMatch(/Blocks consolidation, lifts in [45]m\./)
})

it('scopes the verdict to drift when consolidation is still possible', async () => {
  mocks.get.mockResolvedValue(
    report({
      blockers: [blocker('A disruption budget (nodes: 0) is active and allows no disruptions for Drifted.', ['Drifted'])],
      blocked: ['Drifted'],
    }),
  )
  await render()
  expect(container.textContent).toContain(
    'Karpenter will not replace this node when it drifts. It can still consolidate it.',
  )
  expect(container.textContent).toContain('Blocks drift.')
})

it('does not claim nothing blocks when it cannot see everything', async () => {
  const gap = 'PodDisruptionBudgets are not readable cluster-wide, so PDBs that block eviction can be missing.'
  mocks.get.mockResolvedValue(report({ incomplete: [gap] }))
  await render()
  expect(container.textContent).not.toContain('Nothing blocks')
  expect(container.textContent).toContain('Klustr cannot see everything that could block this node')
  expect(container.textContent).toContain(gap)
})

it('leaves out what is still possible when it cannot see everything', async () => {
  mocks.get.mockResolvedValue(
    report({
      blockers: [blocker('The NodePool sets consolidateAfter: Never.', ['Empty', 'Underutilized'])],
      blocked: ['Empty', 'Underutilized'],
      incomplete: ['Pods are not readable cluster-wide.'],
    }),
  )
  await render()
  expect(container.textContent).toContain('Karpenter will not consolidate this node.')
  expect(container.textContent).not.toContain('It can still')
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
