type Entry = { promise: Promise<unknown>; expires: number; context: string }

export class ManifestSchemaCache {
  private entries = new Map<string, Entry>()
  private documents = new Map<string, { text: string; value: unknown }>()

  constructor(private fetch: (context: string, version: string) => Promise<string>) {}

  clear() {
    this.entries.clear()
    this.documents.clear()
  }

  load(context: string, version: string): Promise<unknown> {
    for (const [key, entry] of this.entries) {
      if (entry.expires <= Date.now()) this.entries.delete(key)
    }
    const key = JSON.stringify([context, version])
    const existing = this.entries.get(key)
    if (existing) return existing.promise
    while (this.entries.size >= 32) this.entries.delete(this.entries.keys().next().value!)
    const contexts = new Set([...this.entries.values()].map((entry) => entry.context))
    for (const name of this.documents.keys()) if (!contexts.has(name)) this.documents.delete(name)
    const entry: Entry = { context, expires: Date.now() + 30_000, promise: Promise.resolve(null) }
    entry.promise = Promise.resolve().then(() => this.fetch(context, version)).then((text) => {
      const previous = this.documents.get(context)
      // A v2 response is shared across group-versions, including its parsed
      // object. A stale request must not repopulate an invalidated cache.
      const value: unknown = previous?.text === text ? previous.value : JSON.parse(text)
      if (this.entries.get(key) === entry) this.documents.set(context, { text, value })
      return value
    }).catch(() => null)
    this.entries.set(key, entry)
    return entry.promise
  }
}
