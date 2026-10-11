import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
vi.mock('@/lib/api', () => ({ api: { getKarpenterEC2NodeClass: vi.fn() } }))
vi.mock('@/features/_shared/useResourceDetail', () => ({
  useResourceDetail: () => ({
    detail: {
      name: 'workers',
      ready: 'True',
      status: '',
      amiFamily: 'AL2023',
      role: '',
      instanceProfile: '',
      resolvedInstanceProfile: '',
      createdAt: '2026-10-11T12:00:00Z',
      subnets: [],
      subnetSelectors: [],
      securityGroups: [],
      securityGroupSelectors: [],
      amis: [
        {
          id: 'ami-shared',
          name: 'al2023',
          zone: '',
          requirements: [
            { key: 'karpenter.k8s.aws/instance-cpu', operator: 'In', values: ['2', '4'] },
          ],
        },
        {
          id: 'ami-shared',
          name: 'al2023',
          zone: '',
          requirements: [{ key: 'karpenter.k8s.aws/instance-cpu', operator: 'In', values: ['8'] }],
        },
      ],
      amiSelectors: [],
      conditions: [],
    },
    error: null,
  }),
}))
import { KarpenterEC2NodeClassDetailBody } from './KarpenterEC2NodeClassDetailBody'

it('counts unique AMIs and shows their distinct requirements without duplicate React keys', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () =>
      root.render(<KarpenterEC2NodeClassDetailBody contextName="local" name="workers" />),
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(container.textContent).toContain('AMIs (1)')
    expect(container.textContent).toContain('karpenter.k8s.aws/instance-cpu In [2, 4]')
    expect(container.textContent).toContain('karpenter.k8s.aws/instance-cpu In [8]')
    expect(errors).not.toHaveBeenCalled()
  } finally {
    act(() => root.unmount())
    errors.mockRestore()
  }
})
