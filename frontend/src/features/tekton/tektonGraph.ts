// Layout for a Pipeline's task graph. Tekton orders tasks by runAfter and by
// result references (the backend folds both into dependsOn); finally tasks
// run after every other task, so they get a column of their own.

export type GraphTask = {
  name: string
  label: string
  dependsOn: string[]
  finally: boolean
  state?: string
  // count is the number of TaskRuns a matrixed task fanned out to.
  count?: number
}

export type GraphNode = GraphTask & { x: number; y: number }
export type GraphEdge = { from: string; to: string; x1: number; y1: number; x2: number; y2: number }

export const NODE_WIDTH = 176
export const NODE_HEIGHT = 40
const COLUMN_GAP = 56
const ROW_GAP = 12

export type GraphLayout = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  // finallyX is the left edge of the finally column, or -1 without one.
  finallyX: number
}

// layoutTaskGraph places each task in the column after its deepest
// dependency and orders a column by the average row of what it depends on,
// which keeps most edges short and uncrossed. A dependency on an unknown task
// (a typo the controller would reject) or a cycle is ignored rather than
// breaking the layout.
export function layoutTaskGraph(tasks: GraphTask[]): GraphLayout {
  const main = tasks.filter((t) => !t.finally)
  const finallyTasks = tasks.filter((t) => t.finally)
  const byName = new Map(main.map((t) => [t.name, t]))

  const column = new Map<string, number>()
  const visiting = new Set<string>()
  const depth = (name: string): number => {
    const known = column.get(name)
    if (known !== undefined) return known
    if (visiting.has(name)) return 0
    visiting.add(name)
    const task = byName.get(name)
    let d = 0
    for (const dep of task?.dependsOn ?? []) {
      if (byName.has(dep) && dep !== name) d = Math.max(d, depth(dep) + 1)
    }
    visiting.delete(name)
    column.set(name, d)
    return d
  }
  main.forEach((t) => depth(t.name))

  const columns: GraphTask[][] = []
  for (const t of main) {
    const c = column.get(t.name) ?? 0
    ;(columns[c] ??= []).push(t)
  }
  const row = new Map<string, number>()
  columns.forEach((col, c) => {
    if (c > 0) {
      const weight = (t: GraphTask) => {
        const rows = t.dependsOn.map((d) => row.get(d)).filter((r): r is number => r !== undefined)
        return rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : Number.MAX_SAFE_INTEGER
      }
      col.sort((a, b) => weight(a) - weight(b))
    }
    col.forEach((t, r) => row.set(t.name, r))
  })

  const x = (c: number) => c * (NODE_WIDTH + COLUMN_GAP)
  const y = (r: number) => r * (NODE_HEIGHT + ROW_GAP)
  const nodes: GraphNode[] = []
  columns.forEach((col, c) => col.forEach((t, r) => nodes.push({ ...t, x: x(c), y: y(r) })))
  const finallyColumn = columns.length
  finallyTasks.forEach((t, r) => nodes.push({ ...t, x: x(finallyColumn), y: y(r) }))

  const position = new Map(nodes.map((n) => [n.name + (n.finally ? '\u0000f' : ''), n]))
  const edges: GraphEdge[] = []
  for (const n of nodes) {
    if (n.finally) continue
    for (const dep of new Set(n.dependsOn)) {
      const from = position.get(dep)
      if (!from || from === n || (column.get(dep) ?? 0) >= (column.get(n.name) ?? 0)) continue
      edges.push({
        from: dep,
        to: n.name,
        x1: from.x + NODE_WIDTH,
        y1: from.y + NODE_HEIGHT / 2,
        x2: n.x,
        y2: n.y + NODE_HEIGHT / 2,
      })
    }
  }

  const rows = Math.max(1, ...columns.map((c) => c.length), finallyTasks.length)
  const cols = columns.length + (finallyTasks.length ? 1 : 0)
  return {
    nodes,
    edges,
    width: Math.max(0, cols * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP),
    height: rows * (NODE_HEIGHT + ROW_GAP) - ROW_GAP,
    finallyX: finallyTasks.length ? x(finallyColumn) : -1,
  }
}

const STATE_RANK = ['failed', 'running', 'pending', 'cancelled', 'succeeded', 'skipped', 'notrun']

// mergeTaskState picks the state a matrixed task shows: any failure, then
// anything still running, before the rest.
export function mergeTaskState(states: string[]): string {
  let best = ''
  for (const s of states) {
    if (!best || (STATE_RANK.indexOf(s) !== -1 && STATE_RANK.indexOf(s) < STATE_RANK.indexOf(best))) best = s
  }
  return best
}
