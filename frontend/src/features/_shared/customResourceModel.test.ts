import { describe, expect, it, vi } from 'vitest'
import type { CRDInfo } from '@/lib/api'
import {
  buildCustomResourceSelection,
  ensureCustomResourceWatches,
  ensureWatchUntilSynced,
} from './customResourceModel'

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

describe('ensureWatchUntilSynced', () => {
  // Wails rejects Go errors with the bare message string.
  const pending = 'taskruns: cache sync still in progress'

  it('retries while the cache sync is pending, then resolves', async () => {
    const ensure = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(pending)
      .mockRejectedValueOnce(pending)
      .mockResolvedValueOnce(undefined)
    await ensureWatchUntilSynced(ensure, () => false)
    expect(ensure).toHaveBeenCalledTimes(3)
  })

  it('fails immediately on any other error', async () => {
    const ensure = vi.fn<() => Promise<void>>().mockRejectedValue('no permission to list taskruns')
    await expect(ensureWatchUntilSynced(ensure, () => false)).rejects.toBe('no permission to list taskruns')
    expect(ensure).toHaveBeenCalledTimes(1)
  })

  it('gives up after the attempt cap or once cancelled', async () => {
    const capped = vi.fn<() => Promise<void>>().mockRejectedValue(pending)
    await expect(ensureWatchUntilSynced(capped, () => false, 3)).rejects.toBe(pending)
    expect(capped).toHaveBeenCalledTimes(3)

    const cancelled = vi.fn<() => Promise<void>>().mockRejectedValue(new Error(pending))
    await expect(ensureWatchUntilSynced(cancelled, () => true)).rejects.toThrow(pending)
    expect(cancelled).toHaveBeenCalledTimes(1)
  })
})
