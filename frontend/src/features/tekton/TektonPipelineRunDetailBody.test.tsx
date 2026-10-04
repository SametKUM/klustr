import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TektonPipelineRunDetail } from '@/lib/api'
import { kube } from '@/lib/wails/wailsjs/go/models'
import { TektonPipelineRunDetailBody } from './TektonPipelineRunDetailBody'

const { useResourceDetail, openTekton } = vi.hoisted(() => ({
  useResourceDetail: vi.fn(),
  openTekton: vi.fn(),
}))
vi.mock('@/features/_shared/useResourceDetail', () => ({ useResourceDetail }))
vi.mock('@/lib/api', () => ({ api: { getTektonPipelineRun: vi.fn() } }))
vi.mock('@/lib/nowTick', () => ({ useNowTick: vi.fn() }))
vi.mock('./useOpenTektonResource', () => ({ useOpenTektonResource: () => openTekton }))

function task(partial: Partial<kube.TektonPipelineRunTask>) {
  return {
    name: '',
    displayName: '',
    taskRef: '',
    runAfter: [],
    finally: false,
    taskRunName: '',
    state: '',
    reason: '',
    message: '',
    startTime: '',
    completionTime: '',
    duration: '',
    ...partial,
  }
}

function run(): TektonPipelineRunDetail {
  return kube.TektonPipelineRunDetail.createFrom({
    name: 'build-x7k2p',
    namespace: 'ci',
    pipeline: 'release',
    pipelineRefName: 'release',
    state: 'failed',
    reason: 'Failed',
    message: 'Tasks Completed: 3 (Failed: 1, Cancelled 0), Skipped: 1',
    tasks: { known: true, completed: 3, failed: 1, cancelled: 0, incomplete: 0, skipped: 1 },
    startTime: '2026-10-02T16:30:08Z',
    completionTime: '2026-10-02T16:33:02Z',
    duration: '2m54s',
    createdAt: '2026-10-02T16:30:08Z',
    params: [{ name: 'branch', value: 'main' }],
    workspaces: [{ name: 'creds', source: 'Secret git-credentials' }],
    results: [],
    pipelineTasks: [
      task({ name: 'clone', taskRef: 'git-clone', taskRunName: 'build-x7k2p-clone', state: 'succeeded', reason: 'Succeeded', duration: '17s' }),
      task({ name: 'build', taskRef: 'kaniko', runAfter: ['clone'], taskRunName: 'build-x7k2p-build', state: 'failed', reason: 'Failed', duration: '1m2s' }),
      task({ name: 'lint', taskRef: '(inline)', state: 'skipped', reason: 'When Expressions evaluated to false' }),
      task({ name: 'notify', taskRef: 'slack', finally: true, taskRunName: 'build-x7k2p-notify', state: 'succeeded', reason: 'Succeeded' }),
    ],
    serviceAccount: 'builder',
    timeout: '1h0m0s',
    specStatus: '',
  })
}

describe('TektonPipelineRunDetailBody', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    openTekton.mockReset()
    useResourceDetail.mockReturnValue({ detail: run(), error: null })
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('renders the run, its task table with skips and finally tasks, params and workspaces', () => {
    act(() => root.render(<TektonPipelineRunDetailBody contextName="ci" namespace="ci" name="build-x7k2p" />))
    const text = container.textContent ?? ''
    expect(text).toContain('Tasks (3)')
    expect(text).toContain('Finally (1)')
    expect(text).toContain('3 done, 1 failed, 1 skipped')
    expect(text).toContain('When Expressions evaluated to false')
    expect(text).toContain('Secret git-credentials')
    expect(text).toContain('2m54s')
  })

  it('opens the TaskRun of a task row and the referenced Pipeline', () => {
    act(() => root.render(<TektonPipelineRunDetailBody contextName="ci" namespace="ci" name="build-x7k2p" />))
    const buildRow = container.querySelector<HTMLTableRowElement>('tr[title="Open TaskRun build-x7k2p-build"]')!
    act(() => buildRow.click())
    expect(openTekton).toHaveBeenCalledWith('TaskRun', 'ci', 'build-x7k2p-build')

    // A skipped task has no TaskRun to open.
    const rows = Array.from(container.querySelectorAll('tr'))
    expect(rows.find((r) => r.textContent?.startsWith('lint'))?.title).toBe('')

    const pipeline = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'release')!
    act(() => pipeline.click())
    expect(openTekton).toHaveBeenCalledWith('Pipeline', 'ci', 'release')
  })
})
