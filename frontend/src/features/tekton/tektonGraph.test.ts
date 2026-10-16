import { expect, it } from 'vitest'
import { layoutTaskGraph, mergeTaskState, NODE_WIDTH, type GraphTask } from './tektonGraph'

function task(name: string, dependsOn: string[] = [], finallyTask = false): GraphTask {
  return { name, label: name, dependsOn, finally: finallyTask }
}

function columnOf(layout: ReturnType<typeof layoutTaskGraph>, name: string): number {
  const node = layout.nodes.find((n) => n.name === name)!
  return Math.round(node.x / NODE_WIDTH)
}

it('places each task one column after its deepest dependency', () => {
  const layout = layoutTaskGraph([
    task('clone'),
    task('lint', ['clone']),
    task('test', ['clone']),
    // build reads lint's result and runs after test.
    task('build', ['test', 'lint']),
    task('deploy', ['build', 'clone']),
    task('notify', [], true),
  ])
  const cols = ['clone', 'lint', 'test', 'build', 'deploy'].map((n) => columnOf(layout, n))
  expect(cols[0]).toBe(0)
  expect(cols[1]).toBe(cols[2])
  expect(cols[3]).toBeGreaterThan(cols[1])
  expect(cols[4]).toBeGreaterThan(cols[3])
  // Finally tasks get their own last column, without edges.
  expect(columnOf(layout, 'notify')).toBeGreaterThan(cols[4])
  expect(layout.finallyX).toBeGreaterThan(0)
  expect(layout.edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual(
    ['build->deploy', 'clone->deploy', 'clone->lint', 'clone->test', 'lint->build', 'test->build'].sort(),
  )
})

it('survives a cycle and a dependency on a task that does not exist', () => {
  const layout = layoutTaskGraph([task('a', ['b']), task('b', ['a']), task('c', ['missing'])])
  expect(layout.nodes).toHaveLength(3)
  expect(layout.edges.every((e) => e.x2 > e.x1)).toBe(true)
})

it('shows a matrixed task by its worst state', () => {
  expect(mergeTaskState(['succeeded', 'failed', 'running'])).toBe('failed')
  expect(mergeTaskState(['succeeded', 'running'])).toBe('running')
  expect(mergeTaskState(['succeeded', 'succeeded'])).toBe('succeeded')
})
