import { describe, expect, it, vi } from 'vitest'
import type { CRDInfo } from '@/lib/api'
import { buildCustomResourceSelection, ensureCustomResourceWatches } from './customResourceModel'

function crd(version: string): CRDInfo {
  return {
    group: 'networking.istio.io',
    version,
    resource: 'virtualservices',
    kind: 'VirtualService',
  } as CRDInfo
}

describe('custom resource multi-context model', () => {
  it('starts every supported watch and preserves partial failures by context', async () => {
    const ensure = vi.fn(async (contextName: string, _crd: CRDInfo) => {
      if (contextName === 'legacy') throw new Error('forbidden')
    })
    const result = await ensureCustomResourceWatches(
      { production: crd('v1'), legacy: crd('v1beta1') },
      ensure,
    )

    expect(ensure).toHaveBeenCalledTimes(2)
    expect(ensure.mock.calls.map(([contextName, value]) => [contextName, value.version])).toEqual([
      ['production', 'v1'],
      ['legacy', 'v1beta1'],
    ])
    expect(result).toEqual({ readyContexts: ['production'], errors: { legacy: 'forbidden' } })
  })

  it('builds selection identity with the row context served version', () => {
    const selection = buildCustomResourceSelection(
      { namespace: 'apps', name: 'shared', suspended: true },
      'legacy',
      { production: crd('v1'), legacy: crd('v1beta1') },
      'IstioVirtualService',
      (row) => row,
      (row) => ({ suspended: row.suspended }),
    )

    expect(selection.context).toBe('legacy')
    expect(selection.gvr?.version).toBe('v1beta1')
    expect(selection.suspended).toBe(true)
  })
})
