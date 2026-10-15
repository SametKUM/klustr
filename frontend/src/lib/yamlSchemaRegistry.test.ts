import { describe, expect, it, vi } from 'vitest'
import { createYAMLSchemaRegistry } from './yamlSchemaRegistry'

const tick = () => new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(resolve)))
describe('YAML schema registration', () => {
  it('batches replacement and ignores schemas with unchanged content', async () => {
    const apply = vi.fn().mockResolvedValue(undefined)
    const register = createYAMLSchemaRegistry(String, apply, vi.fn())
    const remove = register('draft.yaml', { type: 'object' })
    await tick()
    remove()
    const removeNext = register('draft.yaml', { type: 'object' })
    await tick()
    expect(apply).toHaveBeenCalledTimes(1)
    remove() // A stale cleanup must not remove the current registration.
    await tick()
    expect(apply).toHaveBeenCalledTimes(1)
    removeNext(); await tick()
    expect(apply).toHaveBeenLastCalledWith([])
  })
  it('canonicalizes URIs and updates all active models without overwriting them', async () => {
    const apply = vi.fn().mockResolvedValue(undefined)
    const register = createYAMLSchemaRegistry((path) => path.replace('%2F', '/'), apply, vi.fn())
    const remove = register('context%2Fname.yaml', { type: 'object' })
    register('second.yaml', { type: 'string' })
    await tick()
    expect(apply.mock.calls[0][0].map((entry: { fileMatch: string[] }) => entry.fileMatch)).toEqual([['context/name.yaml'], ['second.yaml']])
    remove(); await tick()
    expect(apply.mock.lastCall![0]).toHaveLength(1)
  })
  it('serializes updates while accepting new registrations during validation', async () => {
    let resolve!: () => void
    const apply = vi.fn().mockReturnValueOnce(new Promise<void>((done) => { resolve = done })).mockResolvedValue(undefined)
    const register = createYAMLSchemaRegistry(String, apply, vi.fn())
    register('first.yaml', { type: 'object' }); await tick()
    register('second.yaml', { type: 'string' }); await tick()
    expect(apply).toHaveBeenCalledTimes(1)
    resolve(); await tick()
    expect(apply).toHaveBeenCalledTimes(2)
    expect(apply.mock.lastCall![0]).toHaveLength(2)
  })
})
