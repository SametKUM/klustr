import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManifestOperation } from '@/lib/api'
import { kube } from '@/lib/wails/wailsjs/go/models'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({
  readOnly: false,
  contexts: ['ctx'] as string[],
  events: null as null | ((operation: ManifestOperation) => void),
  getManifestCatalog: vi.fn(),
  getManifestSchema: vi.fn(),
  reviewManifest: vi.fn(),
  reviewRemainingManifest: vi.fn(),
  createManifest: vi.fn(),
  getManifestPreview: vi.fn(),
  getManifestOperation: vi.fn(),
  getRemainingManifest: vi.fn(),
  releaseManifest: vi.fn(),
  cancelManifest: vi.fn(),
  saveTextFile: vi.fn(),
  openResource: vi.fn(),
  yamlPane: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ api: mocks }))
vi.mock('@/lib/events', () => ({ onKubeChange: () => () => {} }))
vi.mock('@/lib/wails/wailsjs/runtime/runtime', () => ({
  EventsOn: (_event: string, callback: (operation: ManifestOperation) => void) => {
    mocks.events = callback
    return () => {
      mocks.events = null
    }
  },
}))
vi.mock('@/store/ui', () => ({
  useActiveContexts: () => mocks.contexts,
  useUIStore: (selector: (state: unknown) => unknown) =>
    selector({
      selectedNamespaces: [],
      globalReadOnly: mocks.readOnly,
      openResource: mocks.openResource,
    }),
}))
vi.mock('@/store/resources', () => ({
  useResources: (selector: (state: unknown) => unknown) => selector({ namespaces: {
    ctx: [{ name: 'default' }, { name: 'staging' }],
    other: [{ name: 'other-only' }],
  } }),
}))
vi.mock('./ManifestYAMLPane', () => ({
  default: ({ path, source, schema, onChange }: { path: string; source: string; schema: unknown; onChange: (value: string) => void }) => {
    mocks.yamlPane(schema)
    return (
    <div className="monaco-editor" data-model-path={path}>
    <textarea
      aria-label="Manifest YAML"
      value={source}
      onChange={(event) => onChange(event.target.value)}
    />
    </div>
  )},
  ManifestDiffPane: ({ before, after }: { before: string; after: string }) => (
    <div data-testid="diff">
      {before}|{after}
    </div>
  ),
}))

import ResourceEditor from './ResourceEditor'
import type { ResourceEditorRequest } from './resourceEditorContext'

const source = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: example\n'
const reviewed = (): ManifestOperation =>
  new kube.ManifestOperation({
    id: 'preview',
    revision: 1,
    contextName: 'ctx',
    phase: 'review',
    warnings: [],
    resources: [
      {
        index: 0,
        document: 1,
        line: 1,
        apiVersion: 'v1',
        kind: 'ConfigMap',
        resource: 'configmaps',
        namespace: 'default',
        name: 'example',
        generateName: '',
        status: 'ready',
        error: '',
        reason: '',
        dependencies: [],
        sensitive: false,
        warnings: [],
      },
    ],
  })

function button(label: string): HTMLButtonElement {
  const element = [...document.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === label,
  )
  if (!(element instanceof HTMLButtonElement)) throw new Error(`Button missing: ${label}`)
  return element
}
async function edit(value: string) {
  const input = document.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}
async function chooseNamespace(name: string) {
  await act(async () => (document.querySelector('[aria-label="Namespace"]') as HTMLButtonElement).click())
  await flush()
  const row = [...document.querySelectorAll('[role="option"]')].find((item) => item.textContent === name) as HTMLElement
  if (!row) throw new Error(`Namespace missing: ${name}`)
  await act(async () => row.click())
}
async function addNamespace(name: string) {
  await act(async () => (document.querySelector('[aria-label="Namespace"]') as HTMLButtonElement).click())
  await act(async () => button('New namespace…').click())
  const input = document.querySelector('form[aria-label="New namespace"] input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => button('Add namespace').click())
}

describe('resource editor workflow', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient
  const close = vi.fn()
  const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  const render = async (open = true, request: { serial: number; target: ResourceEditorRequest } = { serial: 1, target: {} }) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ResourceEditor open={open} onOpenChange={close} request={request} />
        </QueryClientProvider>,
      )
    })
    await flush()
  }
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.clearAllMocks()
    close.mockClear()
    mocks.readOnly = false
    mocks.contexts = ['ctx']
    mocks.events = null
    mocks.getManifestCatalog.mockResolvedValue({
      resources: [],
      defaultNamespace: 'default',
      warnings: [],
    })
    mocks.getManifestSchema.mockRejectedValue(new Error('unavailable'))
    mocks.reviewManifest.mockResolvedValue(reviewed())
    mocks.getManifestPreview.mockResolvedValue({ before: source, after: source })
    mocks.getManifestOperation.mockResolvedValue(reviewed())
    mocks.releaseManifest.mockResolvedValue(undefined)
    mocks.createManifest.mockResolvedValue({ ...reviewed(), revision: 2, phase: 'creating' })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  })
  afterEach(() => {
    act(() => root.unmount())
    queryClient.clear()
    container.remove()
    document
      .querySelectorAll('[data-radix-popper-content-wrapper]')
      .forEach((element) => element.remove())
    vi.unstubAllGlobals()
    if (scrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoView)
    else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  it('allows wheel and touch scrolling in the resource picker while locking the background', async () => {
    mocks.getManifestCatalog.mockResolvedValue({
      resources: Array.from({ length: 100 }, (_, index) => ({
        apiVersion: 'example.com/v1', kind: `Widget${index}`, resource: `widgets${index}`, namespaced: true,
      })),
      defaultNamespace: 'default', warnings: [],
    })
    await render()
    await act(async () => button('Add resource').click()); await flush()
    const list = document.querySelector('[data-slot="command-list"]') as HTMLElement
    const row = list.querySelector('[role="option"]')!
    // jsdom has no layout; supply the overflowing viewport that the browser renders.
    Object.defineProperties(list, { scrollHeight: { value: 3200 }, clientHeight: { value: 288 } })
    list.style.overflowY = 'auto'
    const wheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
    row.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(false)

    const touch = (type: string, clientY: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        touches: { value: [{ clientX: 0, clientY }] },
        changedTouches: { value: [{ clientX: 0, clientY }] },
      })
      row.dispatchEvent(event)
      return event
    }
    touch('touchstart', 200)
    expect(touch('touchmove', 100).defaultPrevented).toBe(false)
    const backgroundWheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
    document.body.dispatchEvent(backgroundWheel)
    expect(backgroundWheel.defaultPrevented).toBe(true)
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(100)

    await act(async () => row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(close).not.toHaveBeenCalled()
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('requires an explicit review and a separate create action', async () => {
    await render()
    await edit(source)
    await act(async () => button('Review resources').click())
    await flush()
    expect(mocks.reviewManifest).toHaveBeenCalledWith('ctx', 'default', source)
    expect(mocks.createManifest).not.toHaveBeenCalled()
    await act(async () => button('Create 1 resource').click())
    expect(mocks.createManifest).toHaveBeenCalledWith('preview')
  })

  it('invalidates a reviewed snapshot before accepting edited YAML', async () => {
    await render()
    await edit(source)
    await act(async () => button('Review resources').click())
    await flush()
    await act(async () => button('Edit manifest').click())
    await edit(source.replace('example', 'changed'))
    expect(mocks.releaseManifest).toHaveBeenCalledWith('preview')
    expect(document.body.textContent).not.toContain('Create 1 resource')
    expect(mocks.createManifest).not.toHaveBeenCalled()
  })

  it('does not choose a context automatically in aggregated mode', async () => {
    mocks.contexts = ['cluster-a', 'cluster-b']
    await render()
    await edit(source)
    expect(button('Review resources').disabled).toBe(true)
    expect(mocks.getManifestCatalog).not.toHaveBeenCalled()
  })

  it('disables creation if read-only mode changes after review', async () => {
    await render()
    await edit(source)
    await act(async () => button('Review resources').click())
    await flush()
    mocks.readOnly = true
    await render()
    expect(button('Create 1 resource').disabled).toBe(true)
  })

  it('keeps a draft when the dialog is closed and reopened', async () => {
    await render()
    await edit(source)
    await render(false)
    await render(true)
    expect(document.querySelector('textarea')!.value).toBe(source)
  })

  it('clears the source and closes its confirmation dialog', async () => {
    await render(); await edit(source)
    await act(async () => button('Clear').click()); await flush()
    expect(document.body.textContent).toContain('Clear this draft?')
    await act(async () => button('Clear draft').click()); await flush()
    expect(document.querySelector('textarea')!.value).toBe('')
    expect(document.body.textContent).not.toContain('Clear this draft?')
  })

  it('does not replace final results with an older progress event', async () => {
    await render()
    await edit(source)
    await act(async () => button('Review resources').click())
    await flush()
    await act(async () => button('Create 1 resource').click())
    await flush()
    const done = reviewed()
    done.phase = 'results'
    done.revision = 5
    done.resources[0].status = 'created'
    await act(async () => {
      mocks.events?.(done)
    })
    await flush()
    await act(async () => {
      mocks.events?.(Object.assign(reviewed(), { phase: 'creating', revision: 3 }))
    })
    expect(document.body.textContent).toContain('All resources were created.')
    expect(document.body.textContent).not.toContain('Creating reviewed resources')
  })

  it('shows prerequisite blocking without claiming server validation succeeded', async () => {
    const operation = reviewed()
    operation.resources[0].status = 'blocked'
    operation.resources[0].dependencies = [1]
    operation.resources.push({
      ...operation.resources[0],
      index: 1,
      kind: 'Namespace',
      name: 'team',
      namespace: '',
      status: 'ready',
      dependencies: [],
    })
    mocks.reviewManifest.mockResolvedValue(operation)
    mocks.getManifestOperation.mockResolvedValue(operation)
    await render()
    await edit(source)
    await act(async () => button('Review resources').click())
    await flush()
    expect(document.body.textContent).toContain('Awaiting prerequisite')
    expect(document.body.textContent).toContain('Create the prerequisites first: Namespace/team')
    expect(button('Create 1 resource').disabled).toBe(false)
  })

  it('keeps the reviewed target when another entry point opens during validation', async () => {
    mocks.contexts = ['ctx', 'other']
    let resolve!: (operation: ManifestOperation) => void
    mocks.reviewManifest.mockReturnValue(new Promise<ManifestOperation>((done) => { resolve = done }))
    await render(true, { serial: 1, target: { contextName: 'ctx' } })
    await edit(source)
    await act(async () => button('Review resources').click())
    await render(true, { serial: 2, target: { contextName: 'other' } })
    expect((document.querySelector('[aria-label="Target context"]') as HTMLSelectElement).value).toBe('ctx')
    await act(async () => resolve(reviewed()))
    await flush()
    expect(button('Create 1 resource').disabled).toBe(false)
  })

  it('does not overwrite typed YAML when template discovery finishes later', async () => {
    let resolve!: (catalog: unknown) => void
    mocks.getManifestCatalog.mockReturnValue(new Promise((done) => { resolve = done }))
    await render(true, { serial: 1, target: { contextName: 'ctx', kind: 'ConfigMap' } })
    await edit(source.replace('example', 'my-draft'))
    await act(async () => resolve({ defaultNamespace: 'default', warnings: [], resources: [{ apiVersion: 'v1', kind: 'ConfigMap', resource: 'configmaps', namespaced: true }] }))
    expect(document.querySelector('textarea')!.value).toContain('my-draft')
  })

  it('edits only the remainder after partial success', async () => {
    await render(); await edit(source)
    await act(async () => button('Review resources').click()); await flush()
    const result = reviewed(); result.phase = 'results'; result.revision = 4; result.resources[0].status = 'created'
    result.resources.push({ ...result.resources[0], index: 1, name: 'second', status: 'failed' })
    await act(async () => { mocks.events?.(result) })
    mocks.getRemainingManifest.mockResolvedValue(source.replace('example', 'second'))
    await act(async () => button('Edit remaining').click()); await flush()
    expect(document.querySelector('textarea')!.value).toContain('second')
    expect(document.querySelector('textarea')!.value).not.toContain('example')
  })

  it('does not restore a discarded review from a late operation snapshot', async () => {
    let resolve!: (operation: ManifestOperation) => void
    mocks.getManifestOperation.mockReturnValue(new Promise<ManifestOperation>((done) => { resolve = done }))
    await render(); await edit(source)
    await act(async () => button('Review resources').click()); await flush()
    await act(async () => button('Edit manifest').click())
    await edit(source.replace('example', 'changed'))
    await act(async () => resolve(reviewed()))
    expect(document.querySelector('textarea')!.value).toContain('changed')
    expect(document.body.textContent).not.toContain('Create 1 resource')
  })

  it('cannot reuse a preview after the default namespace changes', async () => {
    await render(); await edit(source)
    await act(async () => button('Review resources').click()); await flush()
    await chooseNamespace('staging')
    expect(mocks.releaseManifest).toHaveBeenCalledWith('preview')
    expect(document.body.textContent).not.toContain('Create 1 resource')
    expect(document.querySelector('textarea')!.value).toBe(source)
    await act(async () => button('Review resources').click()); await flush()
    expect(mocks.reviewManifest).toHaveBeenLastCalledWith('ctx', 'staging', source)
  })

  it('lists namespaces only from the chosen target context', async () => {
    mocks.contexts = ['ctx', 'other']
    await render(true, { serial: 1, target: { contextName: 'ctx' } })
    await act(async () => (document.querySelector('[aria-label="Namespace"]') as HTMLButtonElement).click())
    expect([...document.querySelectorAll('[role="option"]')].map((item) => item.textContent)).toEqual(['default', 'staging'])
    await act(async () => document.querySelector('input[aria-label="Filter target namespaces"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    const context = document.querySelector('[aria-label="Target context"]') as HTMLSelectElement
    await act(async () => { context.value = 'other'; context.dispatchEvent(new Event('change', { bubbles: true })) })
    await flush()
    await act(async () => (document.querySelector('[aria-label="Namespace"]') as HTMLButtonElement).click())
    expect([...document.querySelectorAll('[role="option"]')].map((item) => item.textContent)).toEqual(['default', 'other-only'])
  })

  it('stages a new namespace and reviews it with its dependent resources before creation', async () => {
    const operation = reviewed()
    const configMap = { ...operation.resources[0], index: 1, namespace: 'new-project', status: 'blocked', dependencies: [0] }
    operation.resources = [
      { ...operation.resources[0], kind: 'Namespace', resource: 'namespaces', name: 'new-project', namespace: '' },
      configMap,
    ]
    mocks.reviewManifest.mockResolvedValue(operation)
    mocks.getManifestOperation.mockResolvedValue(operation)
    await render(); await edit(source)
    expect(document.body.textContent).not.toContain('Default namespace')
    await addNamespace('new-project')
    const next = document.querySelector('textarea')!.value
    expect(next).toContain('kind: Namespace\nmetadata:\n  name: "new-project"')
    expect(next.endsWith(source)).toBe(true)
    expect(document.querySelector('[aria-label="Namespace"]')!.textContent).toBe('new-project')
    expect(mocks.reviewManifest).not.toHaveBeenCalled()
    expect(mocks.createManifest).not.toHaveBeenCalled()
    await act(async () => button('Review resources').click()); await flush()
    expect(mocks.reviewManifest).toHaveBeenCalledExactlyOnceWith('ctx', 'new-project', next)
    expect(document.body.textContent).toContain('Awaiting prerequisite')
    expect(button('Create 1 resource').disabled).toBe(false)
    expect(mocks.createManifest).not.toHaveBeenCalled()
  })

  it('preserves an invalid draft and its target when namespace staging fails', async () => {
    await render(); await edit('data: [private-value')
    await addNamespace('new-project')
    expect(document.querySelector('textarea')!.value).toBe('data: [private-value')
    expect(document.querySelector('[aria-label="Namespace"]')!.textContent).toBe('default')
    expect(document.querySelector('form[aria-label="New namespace"]')).not.toBeNull()
    expect(document.body.textContent).toContain('Fix manifest errors or resource limits')
    expect(mocks.reviewManifest).not.toHaveBeenCalled()
    expect(mocks.createManifest).not.toHaveBeenCalled()
  })

  it('can add the selected new namespace again after clearing the draft', async () => {
    await render(); await addNamespace('new-project')
    await act(async () => button('Clear').click())
    await act(async () => button('Clear draft').click())
    expect(document.querySelector('textarea')!.value).toBe('')
    await addNamespace('new-project')
    expect(document.querySelector('textarea')!.value).toContain('kind: Namespace\nmetadata:\n  name: "new-project"')
    expect(mocks.createManifest).not.toHaveBeenCalled()
  })

  it.each(['created', 'unknown'])('preserves %s results when another entry point requests a different target', async (status) => {
    mocks.contexts = ['ctx', 'other']
    await render(true, { serial: 1, target: { contextName: 'ctx' } })
    await edit(source)
    await act(async () => button('Review resources').click()); await flush()
    const result = reviewed()
    result.phase = 'results'; result.revision = 5
    result.resources[0].status = status
    result.resources[0].generateName = 'example-'
    result.resources.push({ ...result.resources[0], index: 1, name: 'remaining', status: 'pending' })
    await act(async () => { mocks.events?.(result) })
    await render(true, { serial: 2, target: { contextName: 'other' } })
    const target = document.querySelector('[aria-label="Target context"]') as HTMLSelectElement
    const namespace = document.querySelector('[aria-label="Namespace"]') as HTMLButtonElement
    expect(target.disabled).toBe(true)
    expect(namespace.disabled).toBe(true)
    expect(target.value).toBe('ctx')
    await act(async () => namespace.click())
    expect(document.querySelector('[aria-label="Filter target namespaces"]')).toBeNull()
    expect(mocks.releaseManifest).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).toBeNull()
    if (status === 'unknown') expect(button('Edit manifest').disabled).toBe(true)
    else {
      mocks.getRemainingManifest.mockResolvedValue(source.replace('example', 'remaining'))
      await act(async () => button('Edit remaining').click()); await flush()
      expect(target.disabled).toBe(false)
      expect(document.querySelector('textarea')!.value).not.toContain('name: example')
    }
  })

  it('keeps one model and submits the visible draft after switching context and back', async () => {
    mocks.contexts = ['ctx', 'other']
    await render(true, { serial: 1, target: { contextName: 'ctx' } })
    const modelPath = document.querySelector('[data-model-path]')!.getAttribute('data-model-path')
    const select = document.querySelector('[aria-label="Target context"]') as HTMLSelectElement
    const changeContext = async (value: string) => {
      await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) })
      await flush()
    }
    await edit(source)
    await changeContext('other')
    await edit(source.replace('example', 'edited-in-other'))
    await changeContext('ctx')
    expect(document.querySelector('[data-model-path]')!.getAttribute('data-model-path')).toBe(modelPath)
    expect(document.querySelector('textarea')!.value).toContain('edited-in-other')
    await act(async () => button('Review resources').click()); await flush()
    expect(mocks.reviewManifest).toHaveBeenCalledWith('ctx', 'default', source.replace('example', 'edited-in-other'))
  })

  it('keeps schemas stable for value edits and does not fetch unserved draft API versions', async () => {
    mocks.getManifestCatalog.mockResolvedValue({ resources: [{ apiVersion: 'v1', kind: 'ConfigMap', resource: 'configmaps', namespaced: true }], warnings: [], defaultNamespace: 'default' })
    mocks.getManifestSchema.mockResolvedValue('{"components":{"schemas":{}}}')
    await render(); await edit(source)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
    const schema = mocks.yamlPane.mock.lastCall![0]
    await edit(source.replace('example', 'changed'))
    expect(mocks.yamlPane.mock.lastCall![0]).toBe(schema)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
    expect(mocks.getManifestSchema).toHaveBeenCalledExactlyOnceWith('ctx', 'v1')
    await edit(source.replace('v1', 'example.com/v99'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
    expect(mocks.getManifestSchema).toHaveBeenCalledTimes(1)
  })

  it('does not restore a discarded result from a late snapshot after a remaining-review error', async () => {
    await render(); await edit(source)
    await act(async () => button('Review resources').click()); await flush()
    const result = reviewed(); result.phase = 'results'; result.revision = 5
    result.resources[0].status = 'created'
    result.resources.push({ ...result.resources[0], index: 1, name: 'remaining', status: 'blocked' })
    await act(async () => { mocks.events?.(result) })
    let resolve!: (value: ManifestOperation) => void
    mocks.getManifestOperation.mockReturnValue(new Promise<ManifestOperation>((done) => { resolve = done }))
    mocks.reviewRemainingManifest.mockRejectedValueOnce(new Error('disconnected'))
    await act(async () => button('Review remaining').click()); await flush()
    mocks.getRemainingManifest.mockResolvedValue(source.replace('example', 'remaining'))
    await act(async () => button('Edit remaining').click()); await flush()
    await act(async () => resolve(new kube.ManifestOperation({ ...result, revision: 7 })))
    expect(document.querySelector('textarea')!.value).toContain('remaining')
    expect(document.body.textContent).not.toContain('Open resource')
  })

  it('leaves Escape to Monaco while allowing Escape to close from other controls', async () => {
    await render()
    await act(async () => {
      document.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    expect(close).not.toHaveBeenCalled()
    await act(async () => button('Close').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(close).toHaveBeenCalledWith(false)
  })

  it.each([
    ['ConfigMap', 'v1', 'configmaps', undefined],
    ['Secret', 'v1', 'secrets', undefined],
    ['Deployment', 'apps/v1', 'deployments', undefined],
    ['Service', 'serving.knative.dev/v1', 'services', { group: 'serving.knative.dev', version: 'v1', resource: 'services' }],
    ['Widget', 'example.com/v2', 'widgets', { group: 'example.com', version: 'v2', resource: 'widgets' }],
    ['HelmRelease', 'helm.toolkit.fluxcd.io/v2', 'helmreleases', { group: 'helm.toolkit.fluxcd.io', version: 'v2', resource: 'helmreleases' }],
  ])('opens %s (%s) with its correct resource identity', async (kind, apiVersion, resource, gvr) => {
    await render(); await edit(source)
    await act(async () => button('Review resources').click()); await flush()
    const result = reviewed(); result.phase = 'results'; result.revision = 4
    Object.assign(result.resources[0], { kind, apiVersion, resource, status: 'created' })
    await act(async () => { mocks.events?.(result) }); await flush()
    await act(async () => button('Open resource').click())
    const target = { context: 'ctx', namespace: 'default', name: 'example', kind }
    if (gvr) expect(mocks.openResource).toHaveBeenCalledWith({ ...target, gvr }, 'yaml')
    else expect(mocks.openResource).toHaveBeenCalledWith(target)
  })
})
