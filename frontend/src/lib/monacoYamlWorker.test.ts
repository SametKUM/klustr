import path from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { editor, Uri } from 'monaco-editor/editor'

const state = vi.hoisted(() => ({ source: '', workers: [] as { terminate(): unknown }[] }))
// Exercise the bundled worker and Monaco's real model/RPC transport headlessly.
// Node supplies the worker thread; this bridge only replaces browser messaging.
vi.mock('./yaml.worker?worker', async () => {
  const { Worker } = await import('node:worker_threads')
  return {
    default: class extends EventTarget {
      readonly thread: InstanceType<typeof Worker>
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: ErrorEvent) => void) | null = null
      constructor() {
        super()
        this.thread = new Worker(state.source, { eval: true })
        state.workers.push(this)
        this.thread.on('message', (data) => {
          const event = new MessageEvent('message', { data })
          this.onmessage?.(event)
          this.dispatchEvent(event)
        })
        this.thread.on('error', (error) => {
          const event = new ErrorEvent('error', { error, message: String(error) })
          this.onerror?.(event)
          this.dispatchEvent(event)
        })
      }
      postMessage(data: unknown) { this.thread.postMessage(data) }
      terminate() { return this.thread.terminate() }
    },
  }
})

import { createYAMLWebWorker } from './monacoYamlWorker'
import YamlWorker from './yaml.worker?worker'

interface YAMLProxy {
  doValidation(uri: string): Promise<{ message: string }[]>
  doComplete(uri: string, position: { line: number; character: number }): Promise<{
    items: { label: string }[]
  }>
}

beforeAll(async () => {
  vi.stubGlobal('Worker', YamlWorker)
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: {
      'monaco-editor/esm/vs/editor/editor.worker.js': 'monaco-editor/editor/editor.worker',
    } },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: path.resolve('src/lib/yaml.worker.ts'),
        formats: ['iife'],
        name: 'YAMLWorker',
      },
    },
  })
  const output = Array.isArray(result) ? result[0] : result
  if (!('output' in output)) throw new Error('Expected a worker bundle')
  const chunk = output.output.find((item) => item.type === 'chunk')
  if (!chunk) throw new Error('Worker bundle is empty')
  state.source = `
    const { parentPort } = require('node:worker_threads');
    globalThis.self = globalThis;
    globalThis.postMessage = data => parentPort.postMessage(data);
    const events = new EventTarget();
    globalThis.addEventListener = events.addEventListener.bind(events);
    globalThis.removeEventListener = events.removeEventListener.bind(events);
    parentPort.on('message', data => {
      const event = Object.assign(new Event('message'), { data });
      globalThis.onmessage?.(event);
      events.dispatchEvent(event);
    });
    ${chunk.code}
  `
})
afterAll(async () => {
  await Promise.all(state.workers.map((worker) => worker.terminate()))
  vi.unstubAllGlobals()
})

describe('YAML worker compatibility', () => {
  it('validates synchronized models and completes fields using its configured schema', async () => {
    const uri = Uri.parse('inmemory://yaml-worker-test/manifest.yaml')
    const model = editor.createModel('replicas: wrong\n', 'yaml', uri)
    const worker = createYAMLWebWorker<YAMLProxy>({ createData: {
      enableSchemaRequest: false,
      validate: true,
      completion: true,
      schemas: [{
        uri: 'inmemory://yaml-worker-test/schema.json',
        fileMatch: [uri.toString()],
        schema: { type: 'object', properties: { replicas: { type: 'integer' }, image: { type: 'string' } } },
      }],
    } })
    try {
      const proxy = await worker.withSyncedResources([uri])
      expect(await proxy.doValidation(uri.toString())).toEqual([
        expect.objectContaining({ message: expect.stringContaining('integer') }),
      ])
      model.setValue('replicas: 2\n')
      await worker.withSyncedResources([uri])
      expect(await proxy.doValidation(uri.toString())).toEqual([])
      const completion = await proxy.doComplete(uri.toString(), { line: 1, character: 0 })
      expect(completion.items.map((item) => item.label)).toContain('image')
    } finally {
      worker.dispose()
      model.dispose()
    }
  })
})
