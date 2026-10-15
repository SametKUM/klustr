import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManifestSchemaCache } from './manifestSchemaCache'

afterEach(() => vi.useRealTimers())
describe('manifest schema cache', () => {
  it('coalesces requests, shares parsed v2 documents and isolates contexts', async () => {
    const fetch = vi.fn().mockResolvedValue('{"definitions":{}}')
    const cache = new ManifestSchemaCache(fetch)
    const one = cache.load('a', 'v1')
    expect(cache.load('a', 'v1')).toBe(one)
    const value = await one
    expect(await cache.load('a', 'apps/v1')).toBe(value)
    expect(await cache.load('b', 'v1')).not.toBe(value)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('expires and bounds entries rather than retaining every typed version', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockResolvedValue('{}')
    const cache = new ManifestSchemaCache(fetch)
    await cache.load('a', 'v1')
    vi.advanceTimersByTime(30_001)
    await cache.load('a', 'v1')
    expect(fetch).toHaveBeenCalledTimes(2)
    cache.clear()
    for (let i = 0; i < 33; i++) await cache.load('a', `v${i}`)
    const calls = fetch.mock.calls.length
    await cache.load('a', 'v0')
    expect(fetch).toHaveBeenCalledTimes(calls + 1)
  })
  it('does not resurrect invalidated data from an old in-flight request', async () => {
    let resolve!: (text: string) => void
    const fetch = vi.fn().mockReturnValueOnce(new Promise<string>((done) => { resolve = done })).mockResolvedValue('{}')
    const cache = new ManifestSchemaCache(fetch)
    const old = cache.load('a', 'v1')
    cache.clear()
    resolve('{}'); await old
    await cache.load('a', 'v1')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
