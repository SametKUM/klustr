import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CRDInfo } from '@/lib/api'
import { useCRDStore } from '@/store/crds'
import { useResourcePolicyReport } from './useResourcePolicyReport'

const { policyReportForResource } = vi.hoisted(() => ({ policyReportForResource: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { policyReportForResource } }))

function Probe({ namespace }: { namespace: string }) {
  const report = useResourcePolicyReport('dev', 'Deployment', namespace, 'storefront-web')
  return <div>{report ? `fail=${report.fail}` : 'none'}</div>
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useResourcePolicyReport', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    policyReportForResource.mockReset()
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    useCRDStore.setState({ byContext: {} })
  })

  it('makes no call when the context does not serve policy reports', async () => {
    useCRDStore.setState({ byContext: { dev: [] } })
    act(() => root.render(<Probe namespace="demo-storefront" />))
    await flush()
    expect(policyReportForResource).not.toHaveBeenCalled()
    expect(container.textContent).toBe('none')
  })

  it('returns the report for a namespaced resource when PolicyReports are served', async () => {
    useCRDStore.setState({
      byContext: { dev: [{ group: 'wgpolicyk8s.io', resource: 'policyreports' } as CRDInfo] },
    })
    policyReportForResource.mockResolvedValue({ fail: 4 })
    act(() => root.render(<Probe namespace="demo-storefront" />))
    await flush()
    expect(policyReportForResource).toHaveBeenCalledWith('dev', 'Deployment', 'demo-storefront', 'storefront-web')
    expect(container.textContent).toBe('fail=4')
  })

  it('treats a failed lookup and a missing report as none', async () => {
    useCRDStore.setState({
      byContext: { dev: [{ group: 'wgpolicyk8s.io', resource: 'policyreports' } as CRDInfo] },
    })
    policyReportForResource.mockRejectedValue('forbidden')
    act(() => root.render(<Probe namespace="demo-storefront" />))
    await flush()
    expect(container.textContent).toBe('none')

    policyReportForResource.mockResolvedValue(null)
    act(() => root.render(<Probe namespace="other" />))
    await flush()
    expect(container.textContent).toBe('none')
  })
})
