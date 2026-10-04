import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { kube } from '@/lib/wails/wailsjs/go/models'
import { PolicyReportDetailBody } from './PolicyReportDetailBody'

const { useResourceDetail, openKyverno, openTarget } = vi.hoisted(() => ({
  useResourceDetail: vi.fn(),
  openKyverno: vi.fn(),
  openTarget: vi.fn(),
}))
vi.mock('@/features/_shared/useResourceDetail', () => ({ useResourceDetail }))
vi.mock('@/lib/api', () => ({ api: { getPolicyReport: vi.fn(), getClusterPolicyReport: vi.fn() } }))
vi.mock('./useOpenKyvernoResource', () => ({
  useOpenKyvernoResource: () => ({
    canOpenKyverno: (kind: string) => kind !== 'ValidatingPolicy',
    openKyverno,
    openTarget,
  }),
}))

function result(policy: string, result: string, source = 'kyverno') {
  return { policy, rule: 'r', result, message: `${policy} ${result}`, severity: '', category: '', source, timestamp: '', resources: [] }
}

function report() {
  return kube.PolicyReportDetail.createFrom({
    name: 'f9291ae4',
    namespace: 'demo-storefront',
    scopeApiVersion: 'apps/v1',
    scopeKind: 'Deployment',
    scopeNamespace: 'demo-storefront',
    scopeName: 'storefront-web',
    pass: 1,
    fail: 2,
    warn: 0,
    error: 0,
    skip: 0,
    source: 'kyverno',
    createdAt: '2026-10-04T10:47:20Z',
    results: [
      result('demo-storefront/require-team-label', 'fail'),
      result('disallow-latest-tag', 'fail'),
      result('require-labels', 'pass', 'KyvernoValidatingPolicy'),
    ],
  })
}

describe('PolicyReportDetailBody', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    openKyverno.mockReset()
    openTarget.mockReset()
    useResourceDetail.mockReturnValue({ detail: report(), error: null })
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows the tally and results, and opens the subject and the policies', () => {
    act(() =>
      root.render(<PolicyReportDetailBody contextName="dev" namespace="demo-storefront" name="f9291ae4" cluster={false} />),
    )
    expect(container.textContent).toContain('2 fail')
    expect(container.textContent).toContain('1 pass')

    const buttons = Array.from(container.querySelectorAll('button'))
    act(() => buttons.find((b) => b.textContent?.includes('storefront-web'))!.click())
    expect(openTarget).toHaveBeenCalledWith({
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      namespace: 'demo-storefront',
      name: 'storefront-web',
    })

    act(() => buttons.find((b) => b.textContent === 'demo-storefront/require-team-label')!.click())
    expect(openKyverno).toHaveBeenCalledWith('Policy', 'demo-storefront', 'require-team-label')

    // A policy whose kind the context does not serve is plain text.
    expect(buttons.some((b) => b.textContent === 'require-labels')).toBe(false)
    expect(container.textContent).toContain('require-labels')
  })
})
