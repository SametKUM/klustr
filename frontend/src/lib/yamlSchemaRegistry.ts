import type { JSONSchema, MonacoYamlOptions } from 'monaco-yaml'

type Registration = { schema: JSONSchema; content: string; token: object }

export function createYAMLSchemaRegistry(
  canonicalURI: (path: string) => string,
  apply: (schemas: NonNullable<MonacoYamlOptions['schemas']>) => Promise<unknown>,
  onError: () => void,
) {
  const registrations = new Map<string, Registration>()
  let queued = false
  let dirty = false
  let applied = '[]'
  const flush = async () => {
    try {
      while (dirty) {
        dirty = false
        const entries = [...registrations].sort(([a], [b]) => a.localeCompare(b))
        const content = JSON.stringify(entries.map(([path, entry]) => [path, entry.content]))
        if (content === applied || (entries.length === 0 && applied === '[]')) continue
        await apply(entries.map(([path, entry]) => ({ uri: `${path}.schema.json`, fileMatch: [path], schema: entry.schema })))
        applied = content
      }
    } catch {
      onError()
    } finally {
      queued = false
      if (dirty) schedule()
    }
  }
  const schedule = () => {
    dirty = true
    if (queued) return
    queued = true
    // React cleans up the old effect before registering the new schema. Batch
    // both changes, and serialize updates so a worker is never reset mid-update.
    queueMicrotask(() => { void flush() })
  }
  return (path: string, schema: JSONSchema) => {
    const uri = canonicalURI(path)
    const entry = { schema, content: JSON.stringify(schema), token: {} }
    registrations.set(uri, entry)
    schedule()
    return () => {
      if (registrations.get(uri)?.token !== entry.token) return
      registrations.delete(uri)
      schedule()
    }
  }
}
