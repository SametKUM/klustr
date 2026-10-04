import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TektonTaskRunLogsTab } from './TektonTaskRunLogsTab'

const { useResourceDetail, getPod } = vi.hoisted(() => ({
  useResourceDetail: vi.fn(),
  getPod: vi.fn(),
}))
vi.mock('@/features/_shared/useResourceDetail', () => ({ useResourceDetail }))
vi.mock('@/lib/api', () => ({ api: { getTektonTaskRun: vi.fn(), getPod } }))
vi.mock('@/features/pods/PodLogsTab', () => ({
  PodLogsTab: ({ initialContainer }: { initialContainer?: string }) => (
    <div data-testid="logs">logs:{initialContainer}</div>
  ),
}))

function taskRun(podName: string) {
  return {
    podName,
    steps: [
      { name: 'clone', container: 'step-clone', state: 'terminated', exitCode: 0 },
      { name: 'build', container: 'step-build', state: 'terminated', exitCode: 1 },
    ],
  }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('TektonTaskRunLogsTab', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    getPod.mockReset()
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('streams the pod with the failed step preselected', async () => {
    useResourceDetail.mockReturnValue({ detail: taskRun('build-pod'), error: null })
    getPod.mockResolvedValue({ name: 'build-pod', containers: [], initContainers: [] })
    act(() => root.render(<TektonTaskRunLogsTab contextName="ci" namespace="ci" name="build" />))
    await flush()
    expect(getPod).toHaveBeenCalledWith('ci', 'ci', 'build-pod')
    expect(container.textContent).toBe('logs:step-build')
  })

  it('explains a pruned pod instead of showing an error', async () => {
    useResourceDetail.mockReturnValue({ detail: taskRun('old-pod'), error: null })
    getPod.mockRejectedValue('pods "old-pod" not found')
    act(() => root.render(<TektonTaskRunLogsTab contextName="ci" namespace="ci" name="build" />))
    await flush()
    expect(container.textContent).toContain('old-pod no longer exists')
  })

  it('waits for a pod the TaskRun has not created yet', () => {
    useResourceDetail.mockReturnValue({ detail: taskRun(''), error: null })
    act(() => root.render(<TektonTaskRunLogsTab contextName="ci" namespace="ci" name="build" />))
    expect(getPod).not.toHaveBeenCalled()
    expect(container.textContent).toContain('This TaskRun has no pod yet.')
  })
})
