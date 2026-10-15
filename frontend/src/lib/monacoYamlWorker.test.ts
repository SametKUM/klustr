import path from 'node:path'
import { act, createElement, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { CancellationTokenSource, editor, languages, Position, Uri } from 'monaco-editor/editor'
import { stringify } from 'yaml'
import { buildManifestSchema } from '@/features/resource-editor/manifestSchema'
import { parseManifestDraft } from '@/features/resource-editor/manifestModel'
import { useManifestSchemaInputs } from '@/features/resource-editor/useManifestSchemaInputs'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const state = vi.hoisted(() => ({ source: '', workers: [] as { terminate(): unknown }[], services: [] as { dispose(): void }[] }))
vi.mock('monaco-yaml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('monaco-yaml')>()
  return { ...actual, configureMonacoYaml: (...args: Parameters<typeof actual.configureMonacoYaml>) => {
    const service = actual.configureMonacoYaml(...args)
    // monaco-types loses the inherited IDisposable on Monaco 0.57, although
    // monaco-yaml still implements dispose at runtime.
    state.services.push(service as typeof service & { dispose(): void })
    return service
  } }
})
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
  vi.stubGlobal('matchMedia', (media: string) => ({ media, matches: false, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true } }))
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
  state.services.forEach((service) => service.dispose())
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

  it('runs production schema registration, multi-document validation, completion and updates', async () => {
    const completionSpy = vi.spyOn(languages, 'registerCompletionItemProvider')
    const { registerYAMLSchema } = await import('./monaco')
    const completionProvider = completionSpy.mock.calls.find(([language]) => language === 'yaml')![1]
    completionSpy.mockRestore()
    const path = `file:///klustr/resource-editor/${encodeURIComponent('arn:aws:eks:eu-central-1:111122223333:cluster/prod')}/test.yaml`
    const uri = Uri.parse(path)
    const objects = [
      { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'test' }, data: { message: 5 as string | number } },
      { apiVersion: 'example.com/v1', kind: 'Widget', metadata: { name: 'test' }, spec: { count: 'wrong' } },
      { apiVersion: 'apiextensions.k8s.io/v1', kind: 'CustomResourceDefinition', metadata: { name: 'widgets.example.com' }, spec: {
        group: 'example.com', names: { kind: 'Widget' }, versions: [{ name: 'v1', served: true, schema: { openAPIV3Schema: { type: 'object', properties: { spec: { type: 'object', properties: { count: { type: 'integer' } } } } } } }],
      } },
    ]
    const sources = { v1: { components: { schemas: { ConfigMap: {
      type: 'object',
      'x-kubernetes-group-version-kind': [{ group: '', version: 'v1', kind: 'ConfigMap' }],
      properties: { apiVersion: { type: 'string' }, kind: { type: 'string' }, metadata: { type: 'object' }, data: { type: 'object', additionalProperties: { type: 'string' } }, optionalField: { type: 'string' } },
    } } } } }
    const text = () => objects.map((object) => stringify(object).trimEnd()).join('\n\n---\n') + '\n'
    const model = editor.createModel(text(), 'yaml', uri)
    const diagnostics = () => editor.getModelMarkers({ resource: uri })
    const token = new CancellationTokenSource()
    const container = document.createElement('div')
    const root = createRoot(container)
    function Registration({ source }: { source: string }) {
      const draft = useMemo(() => parseManifestDraft(source), [source])
      const inputs = useManifestSchemaInputs(draft, !source.trim())
      const schema = useMemo(() => buildManifestSchema(inputs, sources), [inputs])
      useEffect(() => registerYAMLSchema(path, schema), [schema])
      return null
    }
    const renderSource = async (source: string) => {
      await act(async () => {
        model.setValue(source)
        root.render(createElement(Registration, { source }))
      })
    }
    try {
      await renderSource(text())
      await vi.waitFor(() => expect(diagnostics()).toHaveLength(2), { timeout: 3000 })
      expect(diagnostics()).toEqual(expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('string'), severity: 4 }),
        expect.objectContaining({ message: expect.stringContaining('integer'), severity: 4 }),
      ]))
      const position = new Position(stringify(objects[0]).trimEnd().split('\n').length + 1, 1)
      const completion = await completionProvider.provideCompletionItems(model, position, { triggerKind: 0 }, token.token)
      expect(completion?.suggestions.map((item) => typeof item.label === 'string' ? item.label : item.label.label)).toContain('optionalField')
      const workers = state.workers.length
      await renderSource(text())
      await new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(resolve)))
      expect(state.workers).toHaveLength(workers)
      objects[0].data!.message = 'valid'
      await renderSource(text())
      await vi.waitFor(() => expect(diagnostics()).toHaveLength(1), { timeout: 3000 })
      expect(state.workers).toHaveLength(workers)
      const partial = text().replace('\n\n---\n', '\nopt\n\n---\n')
      expect(parseManifestDraft(partial).error).toMatch(/Invalid YAML/)
      await renderSource(partial)
      await vi.waitFor(() => expect(diagnostics().some((item) => item.severity === 8)).toBe(true), { timeout: 3000 })
      expect(diagnostics().some((item) => item.message.includes('integer'))).toBe(true)
      const incompletePosition = new Position(stringify(objects[0]).trimEnd().split('\n').length + 1, 4)
      const incompleteCompletion = await completionProvider.provideCompletionItems(model, incompletePosition, { triggerKind: 0 }, token.token)
      expect(incompleteCompletion?.suggestions.map((item) => typeof item.label === 'string' ? item.label : item.label.label)).toContain('optionalField')
      expect(state.workers).toHaveLength(workers)
      await renderSource(partial.replace('\nopt\n', '\noptionalField: value\n'))
      await vi.waitFor(() => expect(diagnostics()).toHaveLength(1), { timeout: 3000 })
      expect(state.workers).toHaveLength(workers)
      objects[2].spec!.versions![0].schema.openAPIV3Schema.properties.spec.properties.count.type = 'string'
      await renderSource(text())
      await vi.waitFor(() => expect(diagnostics()).toHaveLength(0), { timeout: 3000 })
    } finally {
      act(() => root.unmount())
      model.dispose()
      token.dispose()
    }
  })
})
